/**
 * In-memory LRU-style cache for AI dialogue responses.
 * Keyed by npcType:intentCategory:contextHash.
 * Each entry has a TTL; expired entries are pruned lazily or via clearExpired().
 */

// cache: Map<string, { response: Object, expiresAt: number }>
const cache = new Map();

// Maximum cache entries before oldest are evicted
const MAX_CACHE_SIZE = 1000;

// Stats counters
let hits = 0;
let misses = 0;

// Default TTL values in seconds per intent category
const DEFAULT_TTLS = {
  prices: 300,       // 5 min — prices change often
  trade: 300,        // 5 min
  lore: 86400,       // 24 hr — backstory doesn't change
  tactical: 60,      // 1 min — combat context is volatile
  greeting: 3600,    // 1 hr
  rumor: 1800,       // 30 min
  general: 600       // 10 min — default fallback
};

/**
 * Get the default TTL for a given intent category.
 * @param {string} category
 * @returns {number} TTL in seconds
 */
const getDefaultTTL = (category) => {
  return DEFAULT_TTLS[category] || DEFAULT_TTLS.general;
};

/**
 * Retrieve a cached response. Returns null if not found or expired.
 * @param {string} cacheKey
 * @returns {Object|null}
 */
const getCached = (cacheKey) => {
  const entry = cache.get(cacheKey);
  if (!entry) {
    misses++;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    misses++;
    return null;
  }

  hits++;
  return entry.response;
};

/**
 * Store a response in the cache.
 * @param {string} cacheKey
 * @param {Object} response
 * @param {number} [ttlSeconds] - TTL override; defaults based on category in key
 */
const setCached = (cacheKey, response, ttlSeconds) => {
  if (!cacheKey || !response) return;

  // Derive TTL from category portion of key if not specified
  if (ttlSeconds === undefined) {
    const parts = cacheKey.split(':');
    const category = parts.length >= 2 ? parts[1] : 'general';
    ttlSeconds = getDefaultTTL(category);
  }

  // Evict oldest entries if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  cache.set(cacheKey, {
    response,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
};

/**
 * Remove all expired entries. Called by maintenance tick.
 * @returns {number} Number of entries removed
 */
const clearExpired = () => {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      removed++;
    }
  }

  return removed;
};

/**
 * Flush all cached entries and reset stats.
 */
const clearAll = () => {
  cache.clear();
  hits = 0;
  misses = 0;
};

/**
 * Get cache statistics for admin panel.
 * @returns {{ size: number, hits: number, misses: number, hitRate: number }}
 */
const getStats = () => {
  const total = hits + misses;
  return {
    size: cache.size,
    hits,
    misses,
    hitRate: total > 0 ? Math.round((hits / total) * 10000) / 100 : 0
  };
};

module.exports = {
  getCached,
  setCached,
  clearExpired,
  clearAll,
  getStats,
  getDefaultTTL,
  DEFAULT_TTLS
};
