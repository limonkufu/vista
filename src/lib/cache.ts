import { logger } from "./logger";

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private ttl: number; // Time-to-live in milliseconds

  /**
   * Creates a new cache instance
   * @param ttlSeconds Time-to-live in seconds
   */
  constructor(ttlSeconds: number = 60) {
    this.ttl = ttlSeconds * 1000;
    logger.debug("Created cache instance", { ttlSeconds }, "Cache");
  }

  /**
   * Gets an item from the cache
   * @param key Cache key
   * @returns The cached item or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);

    if (!item) {
      logger.debug("Cache miss", { key }, "Cache");
      return undefined;
    }

    const isExpired = Date.now() - item.timestamp > this.ttl;

    if (isExpired) {
      logger.debug("Cache expired", { key }, "Cache");
      this.cache.delete(key);
      return undefined;
    }

    logger.debug("Cache hit", { key }, "Cache");
    return item.data;
  }

  /**
   * Sets an item in the cache
   * @param key Cache key
   * @param data Data to cache
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    logger.debug("Cache set", { key }, "Cache");
  }

  /**
   * Clears all items from the cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug("Cache cleared", {}, "Cache");
  }

  /**
   * Removes a specific item from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug("Cache item deleted", { key }, "Cache");
  }
}

// Create singleton instances for each endpoint
export const tooOldCache = new Cache();
export const notUpdatedCache = new Cache();
export const pendingReviewCache = new Cache();
