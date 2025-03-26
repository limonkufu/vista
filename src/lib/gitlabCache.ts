// src/lib/gitlabCache.ts
import { logger } from "./logger";
import { GitLabMR } from "./gitlab";
import { TTL_SECONDS } from "./cacheConfig";

/**
 * Interface for cached GitLab API response
 */
interface CachedGitLabResponse {
  data: GitLabMR[];
  headers: Record<string, string | number>;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache for GitLab API responses
 */
class GitLabAPICache {
  private cache: Map<string, CachedGitLabResponse> = new Map();
  private defaultTTL: number; // in milliseconds

  /**
   * Creates a new GitLab API cache
   * @param ttlSeconds Default TTL in seconds
   */
  constructor(ttlSeconds: number = TTL_SECONDS.GITLAB_API) {
    // Default TTL for GitLab API calls
    this.defaultTTL = ttlSeconds * 1000;
    logger.debug("Created GitLab API cache", { ttlSeconds }, "GitLabAPICache");
  }

  /**
   * Generate a cache key for GitLab API requests
   * @param endpoint GitLab API endpoint
   * @param params Request parameters
   * @returns Cache key
   */
  generateKey(
    endpoint: string,
    params: Record<string, string | number | boolean>
  ): string {
    // Create a stable string representation of params
    const sortedParams = Object.entries(params)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("&");

    return `${endpoint}?${sortedParams}`;
  }

  /**
   * Store GitLab API response in cache
   * @param key Cache key
   * @param data Response data
   * @param headers Response headers
   * @param ttl TTL in milliseconds (optional)
   */
  set(
    key: string,
    data: GitLabMR[],
    headers: Record<string, string | number>,
    ttl?: number
  ): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      headers,
      timestamp: now,
      expiresAt,
    });

    logger.debug(
      "Cached GitLab API response",
      { key, expiresAt: new Date(expiresAt).toISOString() },
      "GitLabAPICache"
    );
  }

  /**
   * Get cached GitLab API response
   * @param key Cache key
   * @returns Cached response or null if not found or expired
   */
  get(
    key: string
  ): { data: GitLabMR[]; headers: Record<string, string | number> } | null {
    const cached = this.cache.get(key);

    if (!cached) {
      logger.debug("GitLab API cache miss", { key }, "GitLabAPICache");
      return null;
    }

    // Check if cache is expired
    if (Date.now() > cached.expiresAt) {
      logger.debug("GitLab API cache expired", { key }, "GitLabAPICache");
      this.cache.delete(key);
      return null;
    }

    logger.debug("GitLab API cache hit", { key }, "GitLabAPICache");
    return {
      data: cached.data,
      headers: cached.headers,
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug("GitLab API cache cleared", {}, "GitLabAPICache");
  }

  /**
   * Delete specific cache entry
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug("Deleted GitLab API cache entry", { key }, "GitLabAPICache");
  }

  /**
   * Get current cache statistics
   * @returns Cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create singleton instance
export const gitlabApiCache = new GitLabAPICache();
