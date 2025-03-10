/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private cache: Map<string, { data: T; timestamp: number }>;
  private ttl: number;

  /**
   * Create a new cache instance
   * @param ttlSeconds - Time to live in seconds
   */
  constructor(ttlSeconds: number = 60) {
    this.cache = new Map();
    this.ttl = ttlSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.data;
  }

  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Create singleton instances for each endpoint
export const tooOldCache = new Cache();
export const notUpdatedCache = new Cache();
export const pendingReviewCache = new Cache(); 