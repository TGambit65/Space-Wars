const { NPC, Ship, User, Port, PortCommodity, Commodity, Sector, NpcConversationSession } = require('../models');
const { Op } = require('sequelize');
const gameSettingsService = require('./gameSettingsService');
const dialogueScriptsService = require('./dialogueScriptsService');
const dialogueCacheService = require('./dialogueCacheService');
const voiceService = require('./voiceService');
const npcPersonalityService = require('./npcPersonalityService');
const aiProviderFactory = require('./ai/aiProviderFactory');
const { getAdjacentSectorIds } = require('./sectorGraphService');
const missionService = require('./missionService');
const npcMemoryService = require('./npcMemoryService');
const worldPolicyService = require('./worldPolicyService');
const crypto = require('crypto');

// Max conversation history entries to prevent unbounded growth
const MAX_HISTORY_LENGTH = 50;

// Stale dialogue timeout (5 minutes)
const STALE_DIALOGUE_MS = 5 * 60 * 1000;

// ─── Menu Options Registry ─────────────────────────────────────────

const MENU_OPTIONS = {
  TRADER: [
    { key: 'greet', label: 'Greet', description: 'Say hello to the trader' },
    { key: 'buy', label: 'Buy Goods', description: 'Browse available merchandise' },
    { key: 'sell', label: 'Sell Cargo', description: 'Sell items from your hold' },
    { key: 'ask_rumors', label: 'Ask for Rumors', description: 'Hear the latest gossip' },
    { key: 'ask_prices', label: 'Ask About Prices', description: 'Get current trade prices' },
    { key: 'ask_routes', label: 'Ask About Routes', description: 'Get trade route suggestions' },
    { key: 'farewell', label: 'Farewell', description: 'End the conversation' }
  ],
  PATROL: [
    { key: 'greet', label: 'Greet', description: 'Hail the patrol officer' },
    { key: 'report_crime', label: 'Report Crime', description: 'Report hostile activity' },
    { key: 'ask_safety', label: 'Ask About Safety', description: 'Check sector danger levels' },
    { key: 'ask_bounties', label: 'Ask About Bounties', description: 'Learn about wanted targets' },
    { key: 'request_escort', label: 'Request Escort', description: 'Ask for protection' },
    { key: 'farewell', label: 'Farewell', description: 'End the conversation' }
  ],
  BOUNTY_HUNTER: [
    { key: 'greet', label: 'Greet', description: 'Approach the bounty hunter' },
    { key: 'ask_targets', label: 'Ask About Targets', description: 'Learn about current bounties' },
    { key: 'offer_contract', label: 'Offer Contract', description: 'Hire the bounty hunter' },
    { key: 'ask_price', label: 'Ask Price', description: 'Get a quote for services' },
    { key: 'threaten', label: 'Threaten', description: 'Try to intimidate' },
    { key: 'farewell', label: 'Farewell', description: 'End the conversation' }
  ],
  PIRATE: [
    { key: 'plead', label: 'Plead', description: 'Beg for mercy' },
    { key: 'bribe', label: 'Offer Bribe', description: 'Try to buy your way out' },
    { key: 'threaten_back', label: 'Threaten', description: 'Stand your ground' },
    { key: 'ask_mercy', label: 'Ask for Mercy', description: 'Appeal to their honor' },
    { key: 'farewell', label: 'Farewell', description: 'End the encounter' }
  ]
};
// Pirate Lords use the same options as Pirates
MENU_OPTIONS.PIRATE_LORD = MENU_OPTIONS.PIRATE;

// ─── Context Building ──────────────────────────────────────────────

/**
 * Build dialogue context for an NPC in its current sector.
 * @param {Object} npc - NPC model instance
 * @returns {Promise<Object>} context object for scripts and prompts
 */
const buildDialogueContext = async (npc) => {
  const context = {
    sectorInfo: {},
    adjacentSectors: [],
    portCommodities: null
  };

  // Get current sector hostile count
  try {
    const currentHostiles = await NPC.count({
      where: {
        current_sector_id: npc.current_sector_id,
        is_alive: true,
        aggression_level: { [Op.gte]: 0.7 },
        npc_id: { [Op.ne]: npc.npc_id } // exclude self
      }
    });
    context.sectorInfo.hostileCount = currentHostiles;
  } catch (err) {
    console.error('Error counting current sector hostiles:', err.message);
  }

  // Get adjacent sector info
  try {
    const adjacentIds = await getAdjacentSectorIds(npc.current_sector_id);

    if (adjacentIds.length > 0) {
      const adjacentSectors = await Sector.findAll({
        where: { sector_id: { [Op.in]: adjacentIds } },
        attributes: ['sector_id', 'name']
      });

      const portSectorIds = new Set();
      const ports = await Port.findAll({
        where: { sector_id: { [Op.in]: adjacentIds }, is_active: true },
        attributes: ['sector_id']
      });
      ports.forEach(p => portSectorIds.add(p.sector_id));

      const hostileNpcs = await NPC.findAll({
        where: {
          current_sector_id: { [Op.in]: adjacentIds },
          is_alive: true,
          aggression_level: { [Op.gte]: 0.7 }
        },
        attributes: ['current_sector_id']
      });
      const hostileCounts = {};
      hostileNpcs.forEach(n => {
        hostileCounts[n.current_sector_id] = (hostileCounts[n.current_sector_id] || 0) + 1;
      });

      context.adjacentSectors = adjacentSectors.map(s => ({
        sector_id: s.sector_id,
        name: s.name,
        hasPort: portSectorIds.has(s.sector_id),
        hostileCount: hostileCounts[s.sector_id] || 0
      }));
    }
  } catch (err) {
    console.error('Error building adjacent sector context:', err.message);
  }

  // Fetch sector metadata and compute territory pressure
  try {
    const sector = await Sector.findByPk(npc.current_sector_id, {
      attributes: ['sector_id', 'name', 'zone_class', 'security_class']
    });
    if (sector) {
      context.sectorInfo.zone_class = sector.zone_class;
      context.sectorInfo.security_class = sector.security_class;
      context.sectorInfo.name = sector.name;

      // Count patrols and players for pressure calculation
      const patrolCount = await NPC.count({
        where: {
          current_sector_id: npc.current_sector_id,
          is_alive: true,
          npc_type: 'PATROL',
          npc_id: { [Op.ne]: npc.npc_id }
        }
      });
      const playerCount = await Ship.count({
        where: { current_sector_id: npc.current_sector_id, is_active: true }
      });

      const pressure = worldPolicyService.computeSectorPressure({
        zone_class: sector.zone_class,
        security_class: sector.security_class,
        hostileNPCCount: context.sectorInfo.hostileCount || 0,
        patrolNPCCount: patrolCount,
        playerCount
      });
      context.sectorInfo.pressure = pressure.pressure;
      context.sectorInfo.pressureLabel = pressure.label;
    }
  } catch (err) {
    console.error('Error building sector pressure context:', err.message);
  }

  // Get port commodities if NPC is at a port (relevant for traders)
  try {
    const port = await Port.findOne({
      where: { sector_id: npc.current_sector_id, is_active: true }
    });
    if (port) {
      context.sectorInfo.hasPort = true;
      context.portName = port.name || 'Local Port';
      const portCommodities = await PortCommodity.findAll({
        where: { port_id: port.port_id },
        include: [{ model: Commodity, as: 'commodity', attributes: ['name', 'base_price'] }],
        attributes: ['buy_price_modifier', 'sell_price_modifier', 'quantity', 'max_quantity'],
        limit: 10
      });
      context.portCommodities = portCommodities.map(pc => {
        const basePrice = pc.commodity ? pc.commodity.base_price : 100;
        return {
          commodity_name: pc.commodity ? pc.commodity.name : 'Unknown',
          buy_price: Math.round(basePrice * (pc.buy_price_modifier || 1.0)),
          sell_price: Math.round(basePrice * (pc.sell_price_modifier || 1.0)),
          supply: pc.quantity || 0,
          demand: pc.max_quantity || 0
        };
      });
    }
  } catch (err) {
    console.error('Error building port context:', err.message);
  }

  return context;
};

// ─── Dialogue Service Methods ──────────────────────────────────────

/**
 * Start a dialogue with an NPC.
 * @param {string} userId - Player's user ID
 * @param {string} npcId - NPC ID to talk to
 * @returns {Promise<Object>} Dialogue start data
 */
const startDialogue = async (userId, npcId) => {
  const npc = await NPC.findByPk(npcId);
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });
  if (!npc.is_alive) throw Object.assign(new Error('Cannot talk to a destroyed NPC'), { statusCode: 400 });

  // Verify player's ship is in the same sector
  const ship = await Ship.findOne({
    where: { owner_user_id: userId, is_active: true }
  });
  if (!ship) throw Object.assign(new Error('You need an active ship'), { statusCode: 400 });
  if (ship.current_sector_id !== npc.current_sector_id) {
    throw Object.assign(new Error('NPC is not in your sector'), { statusCode: 400 });
  }

  // Verify NPC type supports dialogue
  if (!MENU_OPTIONS[npc.npc_type]) {
    throw Object.assign(new Error('This NPC type does not support dialogue'), { statusCode: 400 });
  }

  // Close any stale sessions for this user+NPC pair
  await NpcConversationSession.update(
    { is_active: false },
    {
      where: {
        user_id: userId,
        npc_id: npcId,
        is_active: true,
        last_message_at: { [Op.lt]: new Date(Date.now() - STALE_DIALOGUE_MS) }
      }
    }
  );

  // Check for existing active session (resume it)
  let session = await NpcConversationSession.findOne({
    where: { user_id: userId, npc_id: npcId, is_active: true }
  });

  if (!session) {
    // Create new session
    session = await NpcConversationSession.create({
      npc_id: npcId,
      user_id: userId,
      started_at: new Date(),
      last_message_at: new Date(),
      history: [],
      is_active: true
    });
  }

  // Check voice access
  const user = await User.findByPk(userId, { attributes: ['user_id', 'subscription_tier'] });
  const voiceEnabled = voiceService.isVoiceEnabledForUser(user);

  const personality = npc.ai_personality || {};
  const personalitySummary = personality.trait_primary
    ? `${personality.trait_primary}, ${personality.speech_style || 'normal'}`
    : 'unknown';

  // Check for existing relationship memory — recognition greeting + full relationship
  let recognition = null;
  let relationship = null;
  try {
    recognition = await npcMemoryService.getRecognition(npcId, userId, npc.npc_type);
    const rel = await npcMemoryService.getRelationship(npcId, userId);
    if (rel && rel.interaction_count > 0) {
      relationship = {
        trust: rel.trust,
        fear: rel.fear,
        respect: rel.respect,
        interaction_count: rel.interaction_count,
        label: rel.label,
        notable_fact: rel.notable_fact,
        last_interaction_type: rel.last_interaction_type
      };
    }
  } catch (err) {
    // Non-critical — skip recognition if memory lookup fails
  }

  // Record greeting interaction
  npcMemoryService.recordStandardInteraction(npcId, userId, 'greeting').catch(() => {});

  return {
    conversation_id: npc.npc_id,
    session_id: session.session_id,
    npc: {
      name: npc.name,
      npc_type: npc.npc_type,
      personality_summary: personalitySummary
    },
    menu_options: MENU_OPTIONS[npc.npc_type],
    voice_enabled: voiceEnabled,
    subscription_tier: user ? user.subscription_tier : 'free',
    recognition: recognition ? {
      greeting: recognition.greeting,
      relationship_label: recognition.label
    } : null,
    relationship
  };
};

/**
 * Execute server-side effects for dialogue action payloads.
 * Handles bribes (credit deduction), intimidation (NPC disengage), etc.
 */
const executeActionPayload = async (userId, npc, data) => {
  if (!data) return {};

  // Pirate bribe accepted — deduct credits from player
  if (data.bribe_accepted && data.bribe_amount) {
    const player = await User.findByPk(userId);
    if (player && player.credits >= data.bribe_amount) {
      await player.update({ credits: player.credits - data.bribe_amount });
      // Disengage the pirate
      await npc.update({
        behavior_state: 'idle',
        target_ship_id: null,
        target_user_id: null
      });
      return { credits_deducted: data.bribe_amount, npc_disengaged: true };
    }
    // Not enough credits — bribe fails
    return { bribe_failed: true, reason: 'insufficient_credits' };
  }

  // Pirate backed down from intimidation — disengage
  if (data.backed_down === true) {
    await npc.update({
      behavior_state: 'idle',
      target_ship_id: null,
      target_user_id: null
    });
    return { npc_disengaged: true };
  }

  // Patrol report crime — boost patrol aggression in sector temporarily
  if (data.action === 'report_crime') {
    const patrols = await NPC.findAll({
      where: {
        current_sector_id: npc.current_sector_id,
        npc_type: 'PATROL',
        is_alive: true
      }
    });
    for (const patrol of patrols) {
      if (patrol.aggression_level < 0.8) {
        await patrol.update({ aggression_level: Math.min(1.0, patrol.aggression_level + 0.2) });
      }
    }
    return { patrols_alerted: patrols.length };
  }

  // Patrol/bounty hunter bounty offer — create a bounty mission for the player
  if (data.action === 'bounty_info' && data.create_mission && data.targets && data.targets.length > 0) {
    try {
      const target = data.targets[0];
      const { mission, playerMission } = await missionService.createNPCBountyMission(
        npc.npc_id, userId,
        { kills: target.hostile_count, sectorName: target.sector_name, rewardCredits: data.reward_credits }
      );
      return {
        action: 'mission_accepted',
        mission_id: mission.mission_id,
        mission_title: mission.title,
        reward_credits: mission.reward_credits,
        reward_xp: mission.reward_xp
      };
    } catch (err) {
      return { action: 'mission_failed', reason: err.message };
    }
  }

  // Bounty hunter contract — create a bounty mission when player confirms
  if (data.action === 'accept_contract') {
    try {
      const sector = await Sector.findByPk(npc.current_sector_id, { attributes: ['name'] });
      const sectorName = sector ? sector.name : 'this sector';
      const { mission, playerMission } = await missionService.createNPCBountyMission(
        npc.npc_id, userId,
        { kills: data.kills || 2, sectorName, rewardCredits: data.reward_credits }
      );
      return {
        action: 'mission_accepted',
        mission_id: mission.mission_id,
        mission_title: mission.title,
        reward_credits: mission.reward_credits,
        reward_xp: mission.reward_xp
      };
    } catch (err) {
      return { action: 'mission_failed', reason: err.message };
    }
  }

  // Patrol escort request — create a patrol mission instead of flat denial
  if (data.action === 'patrol_mission_offer') {
    try {
      const { mission, playerMission } = await missionService.createNPCPatrolMission(
        npc.npc_id, userId,
        { sectorsToVisit: data.sectors || 4, rewardCredits: data.reward_credits }
      );
      return {
        action: 'mission_accepted',
        mission_id: mission.mission_id,
        mission_title: mission.title,
        reward_credits: mission.reward_credits,
        reward_xp: mission.reward_xp
      };
    } catch (err) {
      return { action: 'mission_failed', reason: err.message };
    }
  }

  return {};
};

/**
 * Handle a menu option selection.
 * @param {string} userId
 * @param {string} npcId
 * @param {string} optionKey - The menu option selected
 * @returns {Promise<Object>}
 */
const selectMenuOption = async (userId, npcId, optionKey) => {
  const npc = await NPC.findByPk(npcId);
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });

  // Find active session for this user+NPC
  const session = await NpcConversationSession.findOne({
    where: { user_id: userId, npc_id: npcId, is_active: true }
  });
  if (!session) {
    throw Object.assign(new Error('No active dialogue with this NPC'), { statusCode: 400 });
  }

  // Validate option exists for this NPC type
  const validOptions = MENU_OPTIONS[npc.npc_type] || [];
  if (!validOptions.some(o => o.key === optionKey)) {
    throw Object.assign(new Error(`Invalid dialogue option: ${optionKey}`), { statusCode: 400 });
  }

  // Build context for scripts
  const context = await buildDialogueContext(npc);

  // Attach relationship data so scripts can scale rewards
  try {
    const rel = await npcMemoryService.getRelationship(npcId, userId);
    if (rel) {
      context.relationship = {
        trust: rel.trust,
        fear: rel.fear,
        respect: rel.respect,
        interaction_count: rel.interaction_count,
        label: rel.label
      };
    }
  } catch { /* non-critical */ }

  // Get scripted response
  const response = dialogueScriptsService.getScriptedResponse(npc.npc_type, optionKey, npc, context);
  if (!response) {
    throw Object.assign(new Error('Script not found for this option'), { statusCode: 500 });
  }

  // Append to conversation history (capped)
  const history = session.history || [];
  history.push(
    { role: 'user', content: `[${optionKey}]` },
    { role: 'assistant', content: response.text }
  );
  trimHistory(history);

  // Update session
  await session.update({ history, last_message_at: new Date() });

  // Execute server-side action payloads
  const actionResult = await executeActionPayload(userId, npc, response.data);

  // Record interaction in NPC memory (fire and forget)
  const memoryType = mapOptionToInteractionType(optionKey, response.data, actionResult);
  if (memoryType) {
    npcMemoryService.recordStandardInteraction(npcId, userId, memoryType).catch(() => {});
  }

  // Generate TTS if voice enabled for user
  let responseAudio = null;
  const user = await User.findByPk(userId, { attributes: ['user_id', 'subscription_tier'] });
  if (voiceService.isVoiceEnabledForUser(user)) {
    responseAudio = await voiceService.synthesizeSpeech(response.text, npc.ai_personality || {});
  }

  return {
    response_text: response.text,
    response_audio: responseAudio,
    new_menu_options: MENU_OPTIONS[npc.npc_type],
    data: response.data ? { ...response.data, ...actionResult } : null
  };
};

/**
 * Process free-text input from the player.
 * Uses cache → AI → scripted fallback.
 * @param {string} userId
 * @param {string} npcId
 * @param {string} text - Player's message
 * @returns {Promise<Object>}
 */
const processFreeText = async (userId, npcId, text) => {
  const npc = await NPC.findByPk(npcId);
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });

  // Find active session
  const session = await NpcConversationSession.findOne({
    where: { user_id: userId, npc_id: npcId, is_active: true }
  });
  if (!session) {
    throw Object.assign(new Error('No active dialogue with this NPC'), { statusCode: 400 });
  }

  const history = session.history || [];
  const personality = npc.ai_personality || {};

  // Add player message to history
  history.push({ role: 'user', content: text });

  // Fetch user once for voice checks (avoid repeated queries)
  const user = await User.findByPk(userId, { attributes: ['user_id', 'subscription_tier'] });
  const canVoice = voiceService.isVoiceEnabledForUser(user);

  // Helper to finalize response: update session, generate TTS, return result
  const finalizeResponse = async (responseText, isAI) => {
    history.push({ role: 'assistant', content: responseText });
    trimHistory(history);
    await session.update({ history, last_message_at: new Date() });

    let responseAudio = null;
    if (canVoice && isAI) {
      responseAudio = await voiceService.synthesizeSpeech(responseText, personality);
    }

    return {
      response_text: responseText,
      response_audio: responseAudio,
      is_ai_generated: isAI
    };
  };

  // Fetch relationship early so cache key is context-aware (cheap indexed lookup)
  let relLabel = '';
  let relData = null;
  try {
    relData = await npcMemoryService.getRelationship(npcId, userId);
    if (relData) relLabel = relData.label || '';
  } catch { /* non-critical */ }

  // Check cache — include NPC type, behavior state, and relationship for context-aware keying
  const cacheKey = `${npc.npc_type}:${npc.behavior_state || 'idle'}:${relLabel}:${hashContext(npc.npc_id, text, npc.current_sector_id)}`;
  const cached = dialogueCacheService.getCached(cacheKey);
  if (cached) {
    return finalizeResponse(cached.text, true);
  }

  // Try AI if enabled and NPC qualifies
  const aiEnabled = gameSettingsService.getSetting('npc.ai_enabled', true);
  const intelligenceTier = npc.intelligence_tier || 1;
  const interactiveProvider = gameSettingsService.getSetting('ai_llm.interactive.provider', 'none');

  if (aiEnabled && intelligenceTier >= 2 && interactiveProvider !== 'none') {
    try {
      const provider = aiProviderFactory.getProvider('interactive');
      // Build context for richer AI responses
      const context = await buildDialogueContext(npc);

      // Enrich context with relationship memory (reuse early fetch)
      if (relData) {
        context.relationship = {
          label: relData.label,
          trust: relData.trust,
          respect: relData.respect,
          fear: relData.fear,
          notable_facts: relData.notable_fact ? [relData.notable_fact] : []
        };
      }

      const messages = npcPersonalityService.buildInteractivePrompt(npc, personality, history, context);
      const result = await provider.generateText(messages);

      if (result && result.text) {
        const responseText = result.text.trim();
        dialogueCacheService.setCached(cacheKey, { text: responseText });
        return finalizeResponse(responseText, true);
      }
    } catch (err) {
      console.error('AI dialogue generation failed, falling back to script:', err.message);
    }
  }

  // Fallback: scripted "I don't understand" response
  const availableScripts = dialogueScriptsService.getAvailableScripts(npc.npc_type);
  const topicList = availableScripts
    .filter(k => k !== 'farewell')
    .join(', ');
  const fallbackText = `I don't quite follow. Perhaps try asking about: ${topicList}.`;

  return finalizeResponse(fallbackText, false);
};

/**
 * Process voice input from the player.
 * Pipeline: STT → processFreeText → TTS
 * @param {string} userId
 * @param {string} npcId
 * @param {Buffer} audioBuffer
 * @param {string} format - 'webm', 'mp3', 'wav'
 * @returns {Promise<Object>}
 */
const processVoiceInput = async (userId, npcId, audioBuffer, format) => {
  // Check subscription tier
  const user = await User.findByPk(userId, { attributes: ['user_id', 'subscription_tier'] });
  if (!user || user.subscription_tier === 'free') {
    return {
      error: 'premium_required',
      message: 'Voice input requires a premium account. Upgrade to unlock voice features!'
    };
  }

  // Transcribe audio
  const transcription = await voiceService.transcribeAudio(audioBuffer, format);
  if (!transcription || !transcription.text) {
    return {
      error: 'voice_unavailable',
      message: 'Voice unavailable, please type your message'
    };
  }

  // Process as free text
  const result = await processFreeText(userId, npcId, transcription.text);

  return {
    transcribed_text: transcription.text,
    response_text: result.response_text,
    response_audio: result.response_audio,
    is_ai_generated: result.is_ai_generated
  };
};

/**
 * End a dialogue with an NPC.
 * @param {string} userId
 * @param {string} npcId
 * @returns {Promise<Object>}
 */
const endDialogue = async (userId, npcId) => {
  const npc = await NPC.findByPk(npcId);
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });

  // Find and close active session
  const session = await NpcConversationSession.findOne({
    where: { user_id: userId, npc_id: npcId, is_active: true }
  });
  if (!session) {
    throw Object.assign(new Error('No active dialogue with this NPC'), { statusCode: 400 });
  }

  // Get farewell text
  const farewell = dialogueScriptsService.getScriptedResponse(npc.npc_type, 'farewell', npc, {});
  const farewellText = farewell ? farewell.text : 'Goodbye.';

  // Close session
  await session.update({ is_active: false });

  // Generate TTS if voice enabled for user
  let responseAudio = null;
  const user = await User.findByPk(userId, { attributes: ['user_id', 'subscription_tier'] });
  if (voiceService.isVoiceEnabledForUser(user)) {
    responseAudio = await voiceService.synthesizeSpeech(farewellText, npc.ai_personality || {});
  }

  return { response_text: farewellText, response_audio: responseAudio };
};

/**
 * Get the current conversation state for an NPC.
 * @param {string} userId
 * @param {string} npcId
 * @returns {Promise<Object>}
 */
const getConversationState = async (userId, npcId) => {
  const npc = await NPC.findByPk(npcId, {
    attributes: ['npc_id', 'name', 'npc_type', 'dialogue_state', 'ai_personality']
  });
  if (!npc) throw Object.assign(new Error('NPC not found'), { statusCode: 404 });

  // Check session-based state first
  const session = await NpcConversationSession.findOne({
    where: { user_id: userId, npc_id: npcId, is_active: true }
  });

  if (!session) {
    return { active: false };
  }

  // Include relationship info if available
  let relationship = null;
  try {
    relationship = await npcMemoryService.getRelationship(npcId, userId);
  } catch { /* non-critical */ }

  return {
    active: true,
    session_id: session.session_id,
    npc_name: npc.name,
    npc_type: npc.npc_type,
    started_at: session.started_at,
    history: session.history || [],
    menu_options: MENU_OPTIONS[npc.npc_type] || [],
    relationship: relationship ? {
      label: relationship.label,
      trust: relationship.trust,
      respect: relationship.respect
    } : null
  };
};

/**
 * Get menu options for an NPC type.
 * @param {string} npcType
 * @returns {Array<{ key: string, label: string, description: string }>}
 */
const getMenuOptions = (npcType) => {
  return MENU_OPTIONS[npcType] || [];
};

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Trim conversation history to MAX_HISTORY_LENGTH.
 * Removes oldest entries to stay within bounds.
 * @param {Array} history - Mutable history array
 */
const trimHistory = (history) => {
  if (history.length > MAX_HISTORY_LENGTH) {
    history.splice(0, history.length - MAX_HISTORY_LENGTH);
  }
};

/**
 * Map a dialogue option + action result to an interaction type for memory.
 */
const mapOptionToInteractionType = (optionKey, responseData, actionResult) => {
  if (optionKey === 'farewell') return 'farewell';
  if (optionKey === 'greet') return 'greeting';
  if (optionKey === 'buy' || optionKey === 'sell') return 'trade';
  if (optionKey === 'ask_rumors') return 'rumor_shared';
  if (optionKey === 'ask_prices' || optionKey === 'ask_price') return 'price_inquiry';
  if (optionKey === 'report_crime') return 'report_crime';
  if (optionKey === 'threaten' || optionKey === 'threaten_back') {
    if (responseData && responseData.backed_down) return 'threat_backed_down';
    return 'threat';
  }
  if (optionKey === 'bribe') {
    if (actionResult && actionResult.credits_deducted) return 'bribe_accepted';
    return 'bribe_refused';
  }
  if (optionKey === 'offer_contract' || optionKey === 'ask_bounties') {
    if (actionResult && actionResult.action === 'mission_accepted') return 'bounty_contract';
    return 'price_inquiry';
  }
  if (optionKey === 'request_escort') {
    if (actionResult && actionResult.action === 'mission_accepted') return 'patrol_mission';
    return null;
  }
  return null;
};

/**
 * Generate a short hash for cache keying.
 */
const hashContext = (npcId, text, sectorId) => {
  return crypto
    .createHash('md5')
    .update(`${npcId}:${sectorId || ''}:${text.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 12);
};

module.exports = {
  startDialogue,
  selectMenuOption,
  processFreeText,
  processVoiceInput,
  endDialogue,
  getConversationState,
  getMenuOptions
};
