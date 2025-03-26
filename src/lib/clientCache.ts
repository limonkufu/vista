// File: src/lib/clientCache.ts
/**
 * Client-side cache for MR data to prevent unnecessary API calls
 * This is separate from the server-side cache in cache.ts
 */

import { GitLabMR } from "@/lib/gitlab";
import { TTL_MS } from "./cacheConfig";

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface MRResponseData {
  items: GitLabMR[];
  metadata: {
    threshold: number;
    lastRefreshed: string;
    currentPage: number;
    totalPages: number;
    perPage: number;
  };
}

// Cache TTL in milliseconds (e.g., 60 minute for client-side)
const CACHE_TTL = TTL_MS.CLIENT;

// Global cache storage (will persist between page navigations within the same session)
const globalCache: Record<string, CachedData<any>> = {};

export const clientCache = {
  /**
   * Get data from cache if available and not expired
   */
  get<T>(key: string): T | null {
    const cachedItem = globalCache[key];

    if (!cachedItem) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() > cachedItem.expiresAt) {
      // Remove expired item
      delete globalCache[key];
      return null;
    }

    return cachedItem.data;
  },

  /**
   * Store data in cache with expiration
   */
  set<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    const now = Date.now();

    globalCache[key] = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    };
  },

  /**
   * Clear an item from cache
   */
  remove(key: string): void {
    delete globalCache[key];
  },

  /**
   * Clear all cache
   */
  clear(): void {
    Object.keys(globalCache).forEach((key) => {
      delete globalCache[key];
    });
  },

  /**
   * Get the current number of items in the cache
   */
  getSize(): number {
    // Clean up expired items before counting
    const now = Date.now();
    Object.keys(globalCache).forEach((key) => {
      if (globalCache[key].expiresAt < now) {
        delete globalCache[key];
      }
    });
    return Object.keys(globalCache).length;
  },
};

// Generate a consistent cache key for MR data (remains the same)
export function getMRCacheKey(endpoint: string, page: number): string {
  return `mrs-${endpoint}-page-${page}`;
}
