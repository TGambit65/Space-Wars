const { GameSetting, sequelize } = require('../models');

// In-memory cache: key → { value, category, value_type, is_secret }
const cache = new Map();

const DEFAULT_SETTINGS = [
  // LLM Tactical
  { category: 'ai_llm', key: 'ai_llm.tactical.provider', value: 'none', value_type: 'string', description: 'LLM provider for tactical NPC decisions' },
  { category: 'ai_llm', key: 'ai_llm.tactical.model', value: '', value_type: 'string', description: 'Model name for tactical AI' },
  { category: 'ai_llm', key: 'ai_llm.tactical.api_key', value: '', value_type: 'string', is_secret: true, description: 'API key for tactical LLM provider' },
  { category: 'ai_llm', key: 'ai_llm.tactical.base_url', value: '', value_type: 'string', description: 'Base URL for tactical LLM (Local/OpenRouter)' },
  { category: 'ai_llm', key: 'ai_llm.tactical.temperature', value: '0.7', value_type: 'number', description: 'Temperature for tactical AI responses (0.0-2.0)' },
  { category: 'ai_llm', key: 'ai_llm.tactical.max_tokens', value: '200', value_type: 'number', description: 'Max tokens for tactical AI responses' },

  // LLM Interactive
  { category: 'ai_llm', key: 'ai_llm.interactive.provider', value: 'none', value_type: 'string', description: 'LLM provider for interactive NPC dialogue' },
  { category: 'ai_llm', key: 'ai_llm.interactive.model', value: '', value_type: 'string', description: 'Model name for interactive AI' },
  { category: 'ai_llm', key: 'ai_llm.interactive.api_key', value: '', value_type: 'string', is_secret: true, description: 'API key for interactive LLM provider' },
  { category: 'ai_llm', key: 'ai_llm.interactive.base_url', value: '', value_type: 'string', description: 'Base URL for interactive LLM (Local/OpenRouter)' },
  { category: 'ai_llm', key: 'ai_llm.interactive.temperature', value: '0.7', value_type: 'number', description: 'Temperature for interactive AI responses (0.0-2.0)' },
  { category: 'ai_llm', key: 'ai_llm.interactive.max_tokens', value: '300', value_type: 'number', description: 'Max tokens for interactive AI responses' },

  // STT
  { category: 'ai_stt', key: 'ai_stt.provider', value: 'none', value_type: 'string', description: 'Speech-to-text provider' },
  { category: 'ai_stt', key: 'ai_stt.api_key', value: '', value_type: 'string', is_secret: true, description: 'API key for STT provider' },
  { category: 'ai_stt', key: 'ai_stt.model', value: 'whisper-1', value_type: 'string', description: 'STT model name' },
  { category: 'ai_stt', key: 'ai_stt.base_url', value: '', value_type: 'string', description: 'Base URL for STT provider (required for Local)' },
  { category: 'ai_stt', key: 'ai_stt.language', value: 'en', value_type: 'string', description: 'Default language for speech recognition' },

  // TTS
  { category: 'ai_tts', key: 'ai_tts.provider', value: 'none', value_type: 'string', description: 'Text-to-speech provider' },
  { category: 'ai_tts', key: 'ai_tts.api_key', value: '', value_type: 'string', is_secret: true, description: 'API key for TTS provider' },
  { category: 'ai_tts', key: 'ai_tts.model', value: 'tts-1', value_type: 'string', description: 'TTS model name' },
  { category: 'ai_tts', key: 'ai_tts.base_url', value: '', value_type: 'string', description: 'Base URL for TTS provider (required for Local)' },
  { category: 'ai_tts', key: 'ai_tts.voice_id', value: 'alloy', value_type: 'string', description: 'Default TTS voice ID' },

  // NPC
  { category: 'npc', key: 'npc.ai_enabled', value: 'true', value_type: 'boolean', description: 'Master toggle for AI-driven NPC behavior' },
  { category: 'npc', key: 'npc.voice_enabled', value: 'false', value_type: 'boolean', description: 'Enable voice input/output for NPC dialogue' },
  { category: 'npc', key: 'npc.difficulty', value: '3', value_type: 'number', description: 'NPC difficulty level (1=Passive, 3=Normal, 5=Brutal)' },
  { category: 'npc', key: 'npc.tick_rate_seconds', value: '30', value_type: 'number', description: 'Seconds between tactical NPC decision ticks' },
  { category: 'npc', key: 'npc.combat_tick_rate_seconds', value: '15', value_type: 'number', description: 'Seconds between combat processing ticks' },
  { category: 'npc', key: 'npc.spawn_rate_multiplier', value: '1.0', value_type: 'number', description: 'Multiplier for NPC spawn rates (0.1-3.0)' },

  // Prompt Templates
  {
    category: 'ai_llm', key: 'ai_llm.prompt.PIRATE', value_type: 'string',
    value: 'You are {npc_name}, a {trait_primary} space pirate. Your speech style is {speech_style}. Your quirk: {quirk}. You are in sector {sector_name}. Your hull is at {hull_percent}%. Nearby players: {nearby_players}. Respond in character, keep responses under 2 sentences.',
    description: 'System prompt template for Pirate NPCs'
  },
  {
    category: 'ai_llm', key: 'ai_llm.prompt.TRADER', value_type: 'string',
    value: 'You are {npc_name}, a {trait_primary} space trader. Your speech style is {speech_style}. Your quirk: {quirk}. You are docked in sector {sector_name}. You deal in goods and information. Respond in character, keep responses under 2 sentences.',
    description: 'System prompt template for Trader NPCs'
  },
  {
    category: 'ai_llm', key: 'ai_llm.prompt.PATROL', value_type: 'string',
    value: 'You are {npc_name}, a {trait_primary} patrol officer. Your speech style is {speech_style}. Your quirk: {quirk}. You patrol sector {sector_name} and maintain order. Your hull is at {hull_percent}%. Respond in character, keep responses under 2 sentences.',
    description: 'System prompt template for Patrol NPCs'
  },
  {
    category: 'ai_llm', key: 'ai_llm.prompt.BOUNTY_HUNTER', value_type: 'string',
    value: 'You are {npc_name}, a {trait_primary} bounty hunter. Your speech style is {speech_style}. Your quirk: {quirk}. You are hunting targets in sector {sector_name}. Your hull is at {hull_percent}%. Respond in character, keep responses under 2 sentences.',
    description: 'System prompt template for Bounty Hunter NPCs'
  },
  {
    category: 'ai_llm', key: 'ai_llm.prompt.PIRATE_LORD', value_type: 'string',
    value: 'You are {npc_name}, a {trait_primary} pirate lord who commands a fleet. Your speech style is {speech_style}. Your quirk: {quirk}. You dominate sector {sector_name}. Your hull is at {hull_percent}%. You speak with authority. Respond in character, keep responses under 2 sentences.',
    description: 'System prompt template for Pirate Lord NPCs'
  },
];

/**
 * Parse a stored value based on its value_type
 */
const parseValue = (rawValue, valueType) => {
  if (rawValue === null || rawValue === undefined) return null;
  switch (valueType) {
    case 'number': {
      if (rawValue === '') return null;
      const num = Number(rawValue);
      return Number.isNaN(num) ? null : num;
    }
    case 'boolean': return rawValue === 'true' || rawValue === true;
    case 'json':
      try { return JSON.parse(rawValue); }
      catch { return null; }
    default: return String(rawValue);
  }
};

/**
 * Serialize a value for storage
 */
const serializeValue = (value, valueType) => {
  if (value === null || value === undefined) return null;
  if (valueType === 'json') return JSON.stringify(value);
  return String(value);
};

/**
 * Seed default settings into the database
 */
const seedDefaults = async () => {
  console.log('  Seeding default game settings...');
  const rows = DEFAULT_SETTINGS.map(s => ({
    category: s.category,
    key: s.key,
    value: s.value !== undefined ? String(s.value) : null,
    value_type: s.value_type || 'string',
    is_secret: s.is_secret || false,
    description: s.description || null
  }));
  await GameSetting.bulkCreate(rows);
  console.log(`  Seeded ${DEFAULT_SETTINGS.length} default settings`);
};

/**
 * Load all settings from DB into in-memory cache.
 * Seeds defaults if table is empty.
 */
const loadAllSettings = async () => {
  const count = await GameSetting.count();
  if (count === 0) {
    await seedDefaults();
  }

  const rows = await GameSetting.findAll();
  cache.clear();
  for (const row of rows) {
    cache.set(row.key, {
      value: parseValue(row.value, row.value_type),
      category: row.category,
      value_type: row.value_type,
      is_secret: row.is_secret,
      description: row.description
    });
  }
  console.log(`  Game settings loaded (${cache.size} entries)`);
};

/**
 * Get a single setting value from cache
 */
const getSetting = (key, defaultValue = null) => {
  const entry = cache.get(key);
  if (!entry) return defaultValue;
  return entry.value !== null && entry.value !== undefined ? entry.value : defaultValue;
};

/**
 * Set a single setting — writes to DB and updates cache.
 * Accepts optional transaction for atomic bulk updates.
 */
const setSetting = async (key, value, opts = {}) => {
  const txnOpts = opts.transaction ? { transaction: opts.transaction } : {};
  const existing = await GameSetting.findOne({ where: { key }, ...txnOpts });

  const valueType = opts.value_type || (existing ? existing.value_type : 'string');
  const serialized = serializeValue(value, valueType);

  if (existing) {
    existing.value = serialized;
    if (opts.value_type) existing.value_type = opts.value_type;
    if (opts.is_secret !== undefined) existing.is_secret = opts.is_secret;
    if (opts.description) existing.description = opts.description;
    if (opts.category) existing.category = opts.category;
    await existing.save(txnOpts);
  } else {
    await GameSetting.create({
      category: opts.category || 'general',
      key,
      value: serialized,
      value_type: valueType,
      is_secret: opts.is_secret || false,
      description: opts.description || null
    }, txnOpts);
  }

  // Update cache
  cache.set(key, {
    value: parseValue(serialized, valueType),
    category: opts.category || (existing ? existing.category : 'general'),
    value_type: valueType,
    is_secret: opts.is_secret !== undefined ? opts.is_secret : (existing ? existing.is_secret : false),
    description: opts.description || (existing ? existing.description : null)
  });
};

/**
 * Bulk update multiple settings (used by admin PUT).
 * Wrapped in a transaction so partial updates are rolled back on failure.
 */
const setSettings = async (keyValueMap) => {
  const t = await sequelize.transaction();
  const cacheBackup = new Map(cache);
  try {
    for (const [key, value] of Object.entries(keyValueMap)) {
      await setSetting(key, value, { transaction: t });
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    // Restore cache to pre-transaction state since DB was rolled back
    cache.clear();
    for (const [k, v] of cacheBackup) cache.set(k, v);
    throw err;
  }
};

/**
 * Get all settings in a category from cache
 */
const getSettingsByCategory = (category) => {
  const result = {};
  for (const [key, entry] of cache.entries()) {
    if (entry.category === category) {
      result[key] = entry.value;
    }
  }
  return result;
};

/**
 * Get all settings with secret values masked
 */
const getPublicSettings = (category) => {
  const result = {};
  for (const [key, entry] of cache.entries()) {
    if (category && entry.category !== category) continue;
    if (entry.is_secret && entry.value) {
      const val = String(entry.value);
      result[key] = val.length > 4
        ? '***' + val.slice(-4)
        : '****';
    } else {
      result[key] = entry.value;
    }
  }
  return result;
};

/**
 * Clear the in-memory cache. Must be called alongside cleanDatabase()
 * in tests to prevent stale cached values.
 */
const clearCache = () => {
  cache.clear();
};

module.exports = {
  loadAllSettings,
  getSetting,
  setSetting,
  setSettings,
  getSettingsByCategory,
  getPublicSettings,
  clearCache
};
