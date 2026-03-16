/**
 * Dialogue Cache Service Tests
 * Pure in-memory cache — no mocks, no DB.
 */
const dialogueCacheService = require('../../src/services/dialogueCacheService');

describe('Dialogue Cache Service', () => {
  beforeEach(() => {
    dialogueCacheService.clearAll();
  });

  // ─── getDefaultTTL ──────────────────────────────────────────────

  describe('getDefaultTTL', () => {
    it('should return correct TTL for known categories', () => {
      expect(dialogueCacheService.getDefaultTTL('prices')).toBe(300);
      expect(dialogueCacheService.getDefaultTTL('trade')).toBe(300);
      expect(dialogueCacheService.getDefaultTTL('lore')).toBe(86400);
      expect(dialogueCacheService.getDefaultTTL('tactical')).toBe(60);
      expect(dialogueCacheService.getDefaultTTL('greeting')).toBe(3600);
      expect(dialogueCacheService.getDefaultTTL('rumor')).toBe(1800);
      expect(dialogueCacheService.getDefaultTTL('general')).toBe(600);
    });

    it('should return general TTL (600) for unknown category', () => {
      expect(dialogueCacheService.getDefaultTTL('unknown_category')).toBe(600);
      expect(dialogueCacheService.getDefaultTTL('')).toBe(600);
    });
  });

  // ─── getCached ──────────────────────────────────────────────────

  describe('getCached', () => {
    it('should return null on cache miss', () => {
      expect(dialogueCacheService.getCached('nonexistent:key')).toBeNull();
    });

    it('should return cached response on hit', () => {
      const response = { text: 'Hello there!' };
      dialogueCacheService.setCached('TRADER:greeting:abc123', response);
      expect(dialogueCacheService.getCached('TRADER:greeting:abc123')).toEqual(response);
    });

    it('should return null and delete expired entry', () => {
      const response = { text: 'Old response' };
      // Set with 1 second TTL
      dialogueCacheService.setCached('test:key', response, 1);

      // Mock time forward by 2 seconds
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000);

      expect(dialogueCacheService.getCached('test:key')).toBeNull();

      Date.now = originalNow;
    });
  });

  // ─── setCached ──────────────────────────────────────────────────

  describe('setCached', () => {
    it('should store and retrieve a response', () => {
      const response = { text: 'Stored response' };
      dialogueCacheService.setCached('key1', response, 600);
      expect(dialogueCacheService.getCached('key1')).toEqual(response);
    });

    it('should derive TTL from key category when not specified', () => {
      const response = { text: 'Price data' };
      dialogueCacheService.setCached('TRADER:prices:hash1', response);

      // Should still be valid — prices TTL is 300s
      expect(dialogueCacheService.getCached('TRADER:prices:hash1')).toEqual(response);
    });

    it('should use explicit TTL override', () => {
      const response = { text: 'Short-lived' };
      dialogueCacheService.setCached('key2', response, 1);

      // Advance past TTL
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000);

      expect(dialogueCacheService.getCached('key2')).toBeNull();

      Date.now = originalNow;
    });

    it('should reject falsy key', () => {
      dialogueCacheService.setCached('', { text: 'test' }, 60);
      dialogueCacheService.setCached(null, { text: 'test' }, 60);
      expect(dialogueCacheService.getStats().size).toBe(0);
    });

    it('should reject falsy response', () => {
      dialogueCacheService.setCached('valid_key', null, 60);
      dialogueCacheService.setCached('valid_key', undefined, 60);
      expect(dialogueCacheService.getStats().size).toBe(0);
    });

    it('should evict oldest entry at MAX_CACHE_SIZE', () => {
      // Fill cache to capacity (1000)
      for (let i = 0; i < 1000; i++) {
        dialogueCacheService.setCached(`key:${i}`, { text: `response ${i}` }, 3600);
      }
      expect(dialogueCacheService.getStats().size).toBe(1000);

      // Adding one more should evict the first
      dialogueCacheService.setCached('key:overflow', { text: 'new' }, 3600);
      expect(dialogueCacheService.getStats().size).toBe(1000);
      expect(dialogueCacheService.getCached('key:0')).toBeNull();
      expect(dialogueCacheService.getCached('key:overflow')).toEqual({ text: 'new' });
    });
  });

  // ─── clearExpired ───────────────────────────────────────────────

  describe('clearExpired', () => {
    it('should remove expired entries and return count', () => {
      dialogueCacheService.setCached('expired1', { text: 'a' }, 1);
      dialogueCacheService.setCached('expired2', { text: 'b' }, 1);
      dialogueCacheService.setCached('valid', { text: 'c' }, 3600);

      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 2000);

      const removed = dialogueCacheService.clearExpired();
      expect(removed).toBe(2);
      expect(dialogueCacheService.getStats().size).toBe(1);

      Date.now = originalNow;
    });

    it('should keep non-expired entries', () => {
      dialogueCacheService.setCached('valid1', { text: 'a' }, 3600);
      dialogueCacheService.setCached('valid2', { text: 'b' }, 3600);

      const removed = dialogueCacheService.clearExpired();
      expect(removed).toBe(0);
      expect(dialogueCacheService.getStats().size).toBe(2);
    });
  });

  // ─── clearAll ───────────────────────────────────────────────────

  describe('clearAll', () => {
    it('should clear all entries and reset stats', () => {
      dialogueCacheService.setCached('key1', { text: 'a' }, 600);
      dialogueCacheService.getCached('key1'); // hit
      dialogueCacheService.getCached('missing'); // miss

      dialogueCacheService.clearAll();

      const stats = dialogueCacheService.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ─── getStats ───────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return correct size, hits, misses, and hitRate', () => {
      dialogueCacheService.setCached('key1', { text: 'a' }, 600);
      dialogueCacheService.setCached('key2', { text: 'b' }, 600);

      dialogueCacheService.getCached('key1'); // hit
      dialogueCacheService.getCached('key2'); // hit
      dialogueCacheService.getCached('key1'); // hit
      dialogueCacheService.getCached('missing'); // miss

      const stats = dialogueCacheService.getStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75);
    });

    it('should return 0 hitRate when no lookups have been done', () => {
      expect(dialogueCacheService.getStats().hitRate).toBe(0);
    });
  });
});
