const { NpcMemory } = require('../models');

const MAX_MEMORY_BULLETS = 10;

/**
 * Get or create a memory record for an NPC-player pair.
 * @param {string} npcId
 * @param {string} userId
 * @returns {Promise<Object>} NpcMemory instance
 */
const getOrCreateMemory = async (npcId, userId) => {
  const [memory] = await NpcMemory.findOrCreate({
    where: { npc_id: npcId, user_id: userId },
    defaults: {
      trust: 0,
      fear: 0,
      respect: 0,
      interaction_count: 0,
      memories: [],
      last_interaction_at: new Date()
    }
  });
  return memory;
};

/**
 * Record an interaction and update relationship scores.
 * @param {string} npcId
 * @param {string} userId
 * @param {Object} opts
 * @param {string} opts.interactionType - e.g. 'trade', 'bribe', 'threat', 'report_crime', 'bounty_contract', 'greeting'
 * @param {string} [opts.memoryBullet] - Short text to remember (max ~100 chars)
 * @param {string} [opts.notableFact] - Override notable fact
 * @param {Object} [opts.scoreDeltas] - { trust, fear, respect } deltas (-1 to 1 range)
 * @returns {Promise<Object>} Updated NpcMemory
 */
const recordInteraction = async (npcId, userId, opts = {}) => {
  const memory = await getOrCreateMemory(npcId, userId);

  // Update interaction count and type
  const updates = {
    interaction_count: memory.interaction_count + 1,
    last_interaction_type: opts.interactionType || 'general',
    last_interaction_at: new Date()
  };

  // Apply score deltas (clamp to [-1, 1])
  if (opts.scoreDeltas) {
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    if (opts.scoreDeltas.trust !== undefined) {
      updates.trust = clamp(memory.trust + opts.scoreDeltas.trust);
    }
    if (opts.scoreDeltas.fear !== undefined) {
      updates.fear = clamp(memory.fear + opts.scoreDeltas.fear);
    }
    if (opts.scoreDeltas.respect !== undefined) {
      updates.respect = clamp(memory.respect + opts.scoreDeltas.respect);
    }
  }

  // Add memory bullet
  if (opts.memoryBullet) {
    const memories = [...(memory.memories || [])];
    memories.push({
      text: opts.memoryBullet.slice(0, 120),
      at: new Date().toISOString(),
      type: opts.interactionType || 'general'
    });
    // Keep bounded
    if (memories.length > MAX_MEMORY_BULLETS) {
      memories.splice(0, memories.length - MAX_MEMORY_BULLETS);
    }
    updates.memories = memories;
  }

  // Override notable fact
  if (opts.notableFact) {
    updates.notable_fact = opts.notableFact.slice(0, 200);
  }

  await memory.update(updates);
  return memory;
};

/**
 * Get the relationship summary label for display.
 * @param {Object} memory - NpcMemory instance or plain object with trust/fear/respect
 * @returns {string} Human-readable label
 */
const getRelationshipLabel = (memory) => {
  if (!memory) return null;

  const { trust, fear, respect, interaction_count } = memory;

  if (interaction_count <= 1) return 'Stranger';
  if (trust >= 0.6 && respect >= 0.3) return 'Trusted Ally';
  if (trust >= 0.3) return 'Friendly';
  if (trust <= -0.6) return 'Hostile';
  if (trust <= -0.3) return 'Distrusted';
  if (fear >= 0.5) return 'Intimidated';
  if (fear >= 0.3 && trust < 0) return 'Fearful';
  if (respect >= 0.5) return 'Respected';
  if (respect <= -0.5) return 'Contemptuous';
  if (interaction_count >= 5) return 'Acquaintance';
  return 'Known';
};

/**
 * Build a recognition greeting line based on relationship.
 * Returns null if the NPC has no memory of this player.
 * @param {string} npcId
 * @param {string} userId
 * @param {string} npcType
 * @returns {Promise<{ label: string, greeting: string, memory: Object } | null>}
 */
const getRecognition = async (npcId, userId, npcType) => {
  const memory = await NpcMemory.findOne({
    where: { npc_id: npcId, user_id: userId }
  });

  if (!memory || memory.interaction_count < 2) return null;

  const label = getRelationshipLabel(memory);
  const lastType = memory.last_interaction_type;
  let greeting = null;

  // Build recognition line based on relationship and NPC type
  if (memory.trust >= 0.3) {
    const lines = {
      TRADER: "Ah, a returning customer! Always good to see a familiar face.",
      PATROL: "Good to see you again. You've been helpful in keeping the peace.",
      BOUNTY_HUNTER: "Back again? I remember you — reliable.",
      PIRATE: "You again... At least you know how to survive."
    };
    greeting = lines[npcType] || "I remember you. Welcome back.";
  } else if (memory.trust <= -0.3) {
    const lines = {
      TRADER: "You... I remember our last dealing. Let's keep this professional.",
      PATROL: "I've got my eye on you. Watch yourself.",
      BOUNTY_HUNTER: "You. I haven't forgotten. Tread carefully.",
      PIRATE: "Back for more? You've got nerve, I'll give you that."
    };
    greeting = lines[npcType] || "I remember you. Don't push your luck.";
  } else if (memory.fear >= 0.3) {
    greeting = "You... I-I remember you. Let's keep this civil.";
  } else if (memory.respect >= 0.3) {
    greeting = "I know you. You've earned some standing around here.";
  } else if (lastType === 'trade') {
    greeting = "I recall we've done business before. What brings you back?";
  } else if (lastType === 'bounty_contract') {
    greeting = "Ah yes, we've worked together before. Another job?";
  } else {
    greeting = "We've crossed paths before, haven't we?";
  }

  // Add notable fact reference if available
  if (memory.notable_fact && Math.random() < 0.5) {
    greeting += ` ${memory.notable_fact}`;
  }

  return { label, greeting, memory };
};

/**
 * Get relationship scores for a player-NPC pair.
 * @param {string} npcId
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
const getRelationship = async (npcId, userId) => {
  const memory = await NpcMemory.findOne({
    where: { npc_id: npcId, user_id: userId }
  });
  if (!memory) return null;
  return {
    trust: memory.trust,
    fear: memory.fear,
    respect: memory.respect,
    interaction_count: memory.interaction_count,
    label: getRelationshipLabel(memory),
    notable_fact: memory.notable_fact,
    last_interaction_type: memory.last_interaction_type,
    last_interaction_at: memory.last_interaction_at
  };
};

/**
 * Interaction type → score delta mapping.
 */
const INTERACTION_DELTAS = {
  greeting: { trust: 0.02, respect: 0.01 },
  trade: { trust: 0.05, respect: 0.02 },
  bribe_accepted: { trust: -0.05, respect: -0.1 },
  bribe_refused: { trust: -0.1, respect: -0.05 },
  threat: { fear: 0.15, trust: -0.1, respect: -0.05 },
  threat_backed_down: { fear: 0.25, trust: -0.05 },
  report_crime: { trust: 0.1, respect: 0.05 },
  bounty_contract: { trust: 0.08, respect: 0.1 },
  patrol_mission: { trust: 0.05, respect: 0.08 },
  price_inquiry: { trust: 0.02 },
  rumor_shared: { trust: 0.03 },
  farewell: { trust: 0.01 }
};

/**
 * Convenience: record an interaction using standard delta mapping.
 */
const recordStandardInteraction = async (npcId, userId, interactionType, memoryBullet) => {
  return recordInteraction(npcId, userId, {
    interactionType,
    scoreDeltas: INTERACTION_DELTAS[interactionType] || {},
    memoryBullet
  });
};

module.exports = {
  getOrCreateMemory,
  recordInteraction,
  recordStandardInteraction,
  getRelationshipLabel,
  getRecognition,
  getRelationship,
  INTERACTION_DELTAS
};
