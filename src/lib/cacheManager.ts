import { gitlabApiCache } from "./gitlabCache";
import { jiraApiCache } from "./jiraCache";
import { tooOldCache, notUpdatedCache, pendingReviewCache } from "./cache";
import { clientCache } from "./clientCache";
import { logger } from "./logger";

/**
 * Cache management utilities
 */
export const cacheManager = {
  /**
   * Clear all caches (API response cache, GitLab API cache, Jira API cache, and client cache)
   */
  clearAll: () => {
    // Clear API response caches
    tooOldCache.clear();
    notUpdatedCache.clear();
    pendingReviewCache.clear();

    // Clear GitLab API cache
    gitlabApiCache.clear();

    // Clear Jira API cache
    jiraApiCache.clear();

    // Clear client cache
    clientCache.clear();

    logger.info("All caches cleared", {}, "CacheManager");
  },

  /**
   * Clear only the GitLab API cache
   */
  clearGitLabCache: () => {
    gitlabApiCache.clear();
    logger.info("GitLab API cache cleared", {}, "CacheManager");
  },

  /**
   * Clear only the Jira API cache
   */
  clearJiraCache: () => {
    jiraApiCache.clear();
    logger.info("Jira API cache cleared", {}, "CacheManager");
  },

  /**
   * Clear only the API response caches
   */
  clearApiResponseCaches: () => {
    tooOldCache.clear();
    notUpdatedCache.clear();
    pendingReviewCache.clear();
    logger.info("API response caches cleared", {}, "CacheManager");
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
    return {
      tooOldCache: { size: "N/A" }, // We don't have a direct way to access the size
      notUpdatedCache: { size: "N/A" },
      pendingReviewCache: { size: "N/A" },
      gitlabApiCache: gitlabApiCache.getStats(),
      jiraApiCache: jiraApiCache.getStats(),
      clientCache: { size: "N/A" },
    };
  },
};
