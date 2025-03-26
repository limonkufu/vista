// File: src/lib/cacheManager.ts
import { gitlabApiCache } from "./gitlabCache";
import { jiraApiCache } from "./jiraCache";
// Removed: import { tooOldCache, notUpdatedCache, pendingReviewCache } from "./cache";
import { clientCache } from "./clientCache";
import { logger } from "./logger";
import { unifiedDataService } from "@/services/UnifiedDataService"; // Import for invalidation

/**
 * Cache management utilities
 */
export const cacheManager = {
  /**
   * Clear all relevant caches (GitLab API, Jira API, Unified Data Service, Client Cache)
   */
  clearAll: () => {
    // Clear Unified Data Service processed cache
    unifiedDataService.refreshAllData(); // This now handles invalidating its own cache and potentially base caches

    // Clear raw Jira API cache
    jiraApiCache.clear();

    // Clear client cache
    clientCache.clear();

    logger.info("All relevant caches cleared", {}, "CacheManager");
  },

  /**
   * Clear only the GitLab API cache (raw responses)
   */
  clearGitLabCache: () => {
    gitlabApiCache.clear();
    // Also clear UnifiedDataService cache as it depends on GitLab data
    unifiedDataService.refreshAllData();
    logger.info(
      "GitLab API cache cleared (and dependent processed data)",
      {},
      "CacheManager"
    );
  },

  /**
   * Clear only the Jira API cache (raw responses)
   */
  clearJiraCache: () => {
    jiraApiCache.clear();
    // Also clear UnifiedDataService cache as it depends on Jira data
    unifiedDataService.refreshAllData();
    logger.info(
      "Jira API cache cleared (and dependent processed data)",
      {},
      "CacheManager"
    );
  },

  /**
   * Clear only the Unified Data Service's processed data cache
   */
  clearProcessedDataCache: () => {
    unifiedDataService.refreshAllData(); // Use the service's method
    logger.info("Processed data cache cleared", {}, "CacheManager");
  },

  /**
   * Clear only the client cache
   */
  clearClientCache: () => {
    clientCache.clear();
    logger.info("Client cache cleared", {}, "CacheManager");
  },

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  getStats: () => {
    // Note: UnifiedDataService internal cache size is not exposed directly
    return {
      unifiedDataServiceCache: { size: "N/A (Internal)" },
      gitlabApiCache: gitlabApiCache.getStats(),
      jiraApiCache: jiraApiCache.getStats(),
      clientCache: { size: clientCache.getSize() }, // Add getSize method to clientCache if needed
    };
  },
};
