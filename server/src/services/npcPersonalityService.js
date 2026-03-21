const config = require('../config');
const gameSettingsService = require('./gameSettingsService');

const { npcAI } = config;

/**
 * Pick a random item from an array using optional weighted bias.
 * @param {string[]} pool - Available options
 * @param {Object} [weights] - Map of option → weight (default weight = 1)
 * @returns {string}
 */
const weightedRandom = (pool, weights = {}) => {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const weighted = pool.map(item => ({
    item,
    weight: weights[item] || 1
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const { item, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return weighted[weighted.length - 1].item;
};

/**
 * Generate a personality for an NPC based on its type.
 * Called once at spawn time and stored in ai_personality JSON field.
 * @param {string} npcType - PIRATE, TRADER, PATROL, BOUNTY_HUNTER, PIRATE_LORD
 * @returns {{ trait_primary: string, trait_secondary: string, speech_style: string, quirk: string, voice_profile: string }}
 */
const generatePersonality = (npcType) => {
  const bias = npcAI.traitBias[npcType] || {};

  const trait_primary = weightedRandom(npcAI.traits.primary, bias.primary);
  const trait_secondary = weightedRandom(npcAI.traits.secondary);
  const speech_style = weightedRandom(npcAI.traits.speechStyles, bias.speechStyle);
  const quirk = npcAI.traits.quirks[Math.floor(Math.random() * npcAI.traits.quirks.length)];
  const voice_profile = weightedRandom(npcAI.traits.voiceProfiles, bias.voiceProfile);

  return { trait_primary, trait_secondary, speech_style, quirk, voice_profile };
};

/**
 * Build a tactical AI prompt for ambiguous NPC decisions.
 * Used when the behavior tree can't determine the best action (needsAI: true).
 * @param {Object} npc - NPC model instance
 * @param {Object} context - { playersInSector, npcsInSector, adjacentSectors, sectorHasPort, difficulty }
 * @param {Object} personality - ai_personality JSON
 * @returns {Array<{ role: string, content: string }>} Messages array for LLM
 */
const buildTacticalPrompt = (npc, context, personality) => {
  const defaultTemplate = 'You are {npc_name}, a {trait_primary} NPC. Your speech style is {speech_style}. Your quirk: {quirk}. You are in sector {sector_name}. Your hull is at {hull_percent}%. Nearby players: {nearby_players}. Respond in character, keep responses under 2 sentences.';
  const template = gameSettingsService.getSetting(`ai_llm.prompt.${npc.npc_type}`, '') || defaultTemplate;

  const hullPercent = npc.max_hull_points > 0
    ? Math.round((npc.hull_points / npc.max_hull_points) * 100)
    : 0;
  const shieldPercent = npc.max_shield_points > 0
    ? Math.round((npc.shield_points / npc.max_shield_points) * 100)
    : 0;

  // Build system prompt from template with variable substitution
  const systemPrompt = template
    .replace(/{npc_name}/g, npc.name)
    .replace(/{trait_primary}/g, personality.trait_primary || 'unknown')
    .replace(/{speech_style}/g, personality.speech_style || 'normal')
    .replace(/{quirk}/g, personality.quirk || 'none')
    .replace(/{sector_name}/g, context.sectorName || 'unknown sector')
    .replace(/{hull_percent}/g, String(hullPercent))
    .replace(/{nearby_players}/g, context.playersInSector
      ? context.playersInSector.map(p => p.username || 'Unknown').join(', ')
      : 'none');

  // Build tactical context for the user message
  const playersSummary = (context.playersInSector || []).map(p =>
    `${p.username || 'Unknown'} (${p.ship_type || 'unknown ship'}, hull:${p.hull_points}/${p.max_hull_points}, shield:${p.shield_points}/${p.max_shield_points})`
  ).join('; ') || 'none';

  const adjacentInfo = (context.adjacentSectors || []).map(s =>
    `${s.name}${s.hasPort ? ' [PORT]' : ''}${s.hostileCount ? ` (${s.hostileCount} hostile)` : ''}`
  ).join('; ') || 'none';

  const userContent = [
    'TACTICAL SITUATION:',
    `Your stats: hull ${hullPercent}%, shields ${shieldPercent}%, attack ${npc.attack_power}, defense ${npc.defense_rating}`,
    `Current state: ${npc.behavior_state}`,
    `Players in sector: ${playersSummary}`,
    `Port available: ${context.sectorHasPort ? 'yes' : 'no'}`,
    `Adjacent sectors: ${adjacentInfo}`,
    `Difficulty level: ${context.difficulty || 3}`,
    '',
    'Choose your action. Respond with ONLY valid JSON:',
    '{ "action": "attack_player"|"flee"|"patrol"|"guard"|"trade"|"idle", "target_id": "player_id or null", "reason": "brief explanation" }'
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];
};

/**
 * Build an interactive dialogue prompt for NPC conversation.
 * Used when a player sends free-text to an NPC.
 * @param {Object} npc - NPC model instance
 * @param {Object} personality - ai_personality JSON
 * @param {Array<{ role: string, content: string }>} conversationHistory - Previous messages (max 10)
 * @param {Object} context - Optional game context (port prices, sector info, etc.)
 * @returns {Array<{ role: string, content: string }>} Messages array for LLM
 */
const buildInteractivePrompt = (npc, personality, conversationHistory = [], context = {}) => {
  const hullPercent = npc.max_hull_points > 0
    ? Math.round((npc.hull_points / npc.max_hull_points) * 100)
    : 0;

  const systemParts = [
    `You are ${npc.name}, a ${personality.trait_primary} ${config.npcTypes[npc.npc_type]?.name || npc.npc_type}.`,
    `Your personality: ${personality.trait_primary} with a ${personality.trait_secondary} streak.`,
    `Speech style: ${personality.speech_style}.`,
    `Quirk: ${personality.quirk}.`,
    `Your hull is at ${hullPercent}%.`
  ];

  // Add type-specific context from buildDialogueContext()
  if (npc.npc_type === 'TRADER' && context.portCommodities && context.portCommodities.length > 0) {
    const priceStr = context.portCommodities.slice(0, 5).map(c =>
      `${c.commodity_name}: buy ${c.buy_price}cr, sell ${c.sell_price}cr`
    ).join('; ');
    systemParts.push(`Trade prices at this port: ${priceStr}.`);
  }
  if (npc.npc_type === 'PATROL') {
    const hostiles = context.sectorInfo?.hostileCount || 0;
    systemParts.push(`Hostile activity in sector: ${hostiles} threats. You maintain order here.`);
  }
  if (context.adjacentSectors && context.adjacentSectors.length > 0) {
    const nearby = context.adjacentSectors.slice(0, 3).map(s => {
      const notes = [];
      if (s.hasPort) notes.push('has port');
      if (s.hostileCount > 0) notes.push(`${s.hostileCount} hostiles`);
      return `${s.name}${notes.length ? ` (${notes.join(', ')})` : ''}`;
    }).join('; ');
    systemParts.push(`Nearby sectors: ${nearby}.`);
  }

  systemParts.push('Stay in character. Keep responses under 2 sentences. Never break character or mention being an AI.');

  const messages = [
    { role: 'system', content: systemParts.join(' ') }
  ];

  // Add conversation history (last 10 messages, only user/assistant roles)
  const allowedRoles = new Set(['user', 'assistant']);
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    if (allowedRoles.has(msg.role)) {
      messages.push({ role: msg.role, content: String(msg.content).slice(0, 2000) });
    }
  }

  return messages;
};

module.exports = {
  generatePersonality,
  buildTacticalPrompt,
  buildInteractivePrompt
};
