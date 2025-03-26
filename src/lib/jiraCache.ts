import { logger } from "./logger";

/**
 * Interface for cached Jira API response
 */
interface CachedJiraResponse {
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache for Jira API responses
 */
class JiraAPICache {
  private cache: Map<string, CachedJiraResponse> = new Map();
  private defaultTTL: number; // in milliseconds

  /**
   * Creates a new Jira API cache
   * @param ttlSeconds Default TTL in seconds
   */
  constructor(ttlSeconds: number = 900) {
    // Default 5 minute TTL for Jira API calls
    this.defaultTTL = ttlSeconds * 1000;
    logger.debug("Created Jira API cache", { ttlSeconds }, "JiraAPICache");
  }

  /**
   * Generate a cache key for a Jira API request
   * @param action The API action (getTicket, searchTickets)
   * @param params Additional parameters for the request
   */
  generateKey(
    action: string,
    params: Record<string, string | number | boolean> = {}
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, string | number | boolean>);

    return `jira:${action}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Store Jira API response in cache
   * @param key Cache key
   * @param data Response data
   * @param ttl TTL in milliseconds (optional)
   */
  set(key: string, data: unknown, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });

    logger.debug(
      "Cached Jira API response",
      { key, expiresAt: new Date(expiresAt).toISOString() },
      "JiraAPICache"
    );
  }

  /**
   * Get cached Jira API response
   * @param key Cache key
   * @returns Cached response or null if not found or expired
   */
  get(key: string): unknown | null {
    const cached = this.cache.get(key);

    if (!cached) {
      logger.debug("Jira API cache miss", { key }, "JiraAPICache");
      return null;
    }

    // Check if cache is expired
    if (Date.now() > cached.expiresAt) {
      logger.debug("Jira API cache expired", { key }, "JiraAPICache");
      this.cache.delete(key);
      return null;
    }

    logger.debug("Jira API cache hit", { key }, "JiraAPICache");
    return cached.data;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug("Jira API cache cleared", {}, "JiraAPICache");
  }

  /**
   * Delete specific cache entry
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug("Deleted Jira API cache entry", { key }, "JiraAPICache");
  }

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  getStats(): { size: number } {
    return {
      size: this.cache.size,
    };
  }
}

// Create a singleton instance
export const jiraApiCache = new JiraAPICache();
