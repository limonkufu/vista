// File: src/services/UnifiedDataService.ts
import {
  fetchAllTeamMRs,
  GitLabMR,
  GitLabMRsResponse,
  FetchAllTeamMRsOptions,
  getTeamUserIds, // <--- ADD THIS IMPORT
} from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { jiraService } from "./JiraServiceFactory";
import { mrJiraAssociationService } from "./MRJiraAssociationService";
import { logger } from "@/lib/logger";
import { thresholds } from "@/lib/config";
import { gitlabApiCache } from "@/lib/gitlabCache";
import { TTL_MS } from "@/lib/cacheConfig";

// Type for unified response data (kept for hook compatibility)
export interface UnifiedDataResponse<T> {
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastRefreshed?: string;
  refetch: (options?: { skipCache?: boolean }) => Promise<void>; // Allow forcing refresh
}

// Internal cache for processed/filtered data within this service
const processedDataCache: Record<
  string,
  {
    data: any;
    timestamp: number;
    validUntil: number;
  }
> = {};

// Default cache TTL in milliseconds (5 minutes)
const DEFAULT_CACHE_TTL = TTL_MS.PROCESSED_DATA;

// Generate a consistent cache key based on operation and options
function generateCacheKey(operation: string, options?: any): string {
  const sortedOptions = options
    ? Object.keys(options)
        .sort()
        .reduce((obj, key) => {
          // Exclude skipCache from the key itself
          if (key !== "skipCache") {
            obj[key] = options[key];
          }
          return obj;
        }, {} as any)
    : {};
  const optionsStr = JSON.stringify(sortedOptions);
  return `${operation}:${optionsStr}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(key: string): boolean {
  const cached = processedDataCache[key];
  if (!cached) return false;
  return Date.now() < cached.validUntil;
}

/**
 * Get data from cache
 */
function getFromCache<T>(key: string): T | null {
  if (isCacheValid(key)) {
    logger.debug("Processed data cache hit", { key }, "UnifiedDataService");
    return processedDataCache[key].data as T;
  }
  logger.debug("Processed data cache miss", { key }, "UnifiedDataService");
  return null;
}

/**
 * Store data in cache
 */
function setInCache<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): void {
  const now = Date.now();
  processedDataCache[key] = {
    data,
    timestamp: now,
    validUntil: now + ttl,
  };
  logger.debug("Stored processed data in cache", { key }, "UnifiedDataService");
}

/**
 * Clear cache for a specific key or pattern
 */
function invalidateCache(keyPattern?: string): void {
  if (keyPattern) {
    Object.keys(processedDataCache).forEach((key) => {
      if (key.startsWith(keyPattern)) {
        delete processedDataCache[key];
      }
    });
    logger.info(`Invalidated processed data cache for pattern: ${keyPattern}`);
  } else {
    Object.keys(processedDataCache).forEach((key) => {
      delete processedDataCache[key];
    });
    logger.info("Invalidated all processed data cache");
  }
  // Also invalidate the association service cache as base data changed
  mrJiraAssociationService.invalidateCache();
}

class UnifiedDataService {
  // --- Private Helper Methods ---

  /**
   * Fetches the base set of all relevant team MRs, using GitLab cache.
   */
  private async _getBaseMRs(
    options: Omit<FetchAllTeamMRsOptions, "groupId"> & {
      skipCache?: boolean;
    } = {}
  ): Promise<GitLabMR[]> {
    const groupId =
      process.env.NEXT_PUBLIC_GITLAB_GROUP_ID ||
      process.env.GITLAB_GROUP_ID ||
      "";
    if (!groupId) throw new Error("GITLAB_GROUP_ID not set");

    const fetchOptions: FetchAllTeamMRsOptions = {
      groupId,
      state: options.state || "opened",
      include_subgroups: options.include_subgroups ?? true,
      skipCache: options.skipCache ?? false, // Pass skipCache to the underlying fetch
    };

    // Use a cache key specific to the base fetch operation within this service
    // This service cache is for the *result* of fetchAllTeamMRs, which itself uses gitlabApiCache
    const cacheKey = generateCacheKey("baseMRs", fetchOptions);

    if (!fetchOptions.skipCache) {
      const cached = getFromCache<GitLabMR[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // fetchAllTeamMRs handles its own caching via gitlabApiCache
      const result = await fetchAllTeamMRs(fetchOptions);
      setInCache(cacheKey, result.items); // Cache the base items in this service's cache
      return result.items;
    } catch (error) {
      logger.error("Failed to fetch base MRs", { error }, "UnifiedDataService");
      throw error;
    }
  }

  /**
   * Fetches or retrieves cached base MRs and enriches them with Jira data.
   */
  private async _getEnrichedMRs(
    options: Omit<FetchAllTeamMRsOptions, "groupId"> & {
      skipCache?: boolean;
    } = {}
  ): Promise<GitLabMRWithJira[]> {
    const cacheKey = generateCacheKey("enrichedMRs", options);

    if (!options.skipCache) {
      const cached = getFromCache<GitLabMRWithJira[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Pass skipCache down to get fresh base MRs if needed
      const baseMRs = await this._getBaseMRs(options);
      const enrichedMRs = await mrJiraAssociationService.enhanceMRsWithJira(
        baseMRs
      );
      setInCache(cacheKey, enrichedMRs);
      return enrichedMRs;
    } catch (error) {
      logger.error(
        "Failed to get enriched MRs",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Applies pagination to a list of items.
   */
  private _paginateItems<T>(
    items: T[],
    page: number = 1,
    per_page: number = 25
  ): { paginatedItems: T[]; totalItems: number; totalPages: number } {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / per_page));
    const startIdx = (page - 1) * per_page;
    const endIdx = Math.min(startIdx + per_page, totalItems);
    const paginatedItems = items.slice(startIdx, endIdx);
    return { paginatedItems, totalItems, totalPages };
  }

  // --- Public Data Fetching Methods ---

  /**
   * Fetch MRs that are too old (filtered internally).
   */
  async fetchTooOldMRs(
    options: {
      page?: number;
      per_page?: number;
      skipCache?: boolean; // Added skipCache option
    } = {}
  ): Promise<GitLabMRsResponse> {
    const { page = 1, per_page = 25, skipCache = false } = options;
    const threshold = thresholds.TOO_OLD_THRESHOLD;
    // Cache key for the *filtered* result
    const cacheKey = generateCacheKey("filteredTooOldMRs", { threshold });

    if (!skipCache) {
      const cached = getFromCache<GitLabMR[]>(cacheKey);
      if (cached) {
        const { paginatedItems, totalItems, totalPages } = this._paginateItems(
          cached,
          page,
          per_page
        );
        return {
          items: paginatedItems,
          metadata: {
            threshold,
            currentPage: page,
            perPage: per_page,
            totalItems,
            totalPages,
            lastRefreshed: new Date().toISOString(), // Reflects cache time
          },
        };
      }
    }

    try {
      // Pass skipCache to get fresh base data if needed
      const baseMRs = await this._getBaseMRs({ skipCache });
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - threshold);

      const filteredMRs = baseMRs.filter((mr) => {
        const createdDate = new Date(mr.created_at);
        return createdDate < thresholdDate;
      });

      setInCache(cacheKey, filteredMRs); // Cache the filtered list

      const { paginatedItems, totalItems, totalPages } = this._paginateItems(
        filteredMRs,
        page,
        per_page
      );

      return {
        items: paginatedItems,
        metadata: {
          threshold,
          currentPage: page,
          perPage: per_page,
          totalItems,
          totalPages,
          lastRefreshed: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(
        "Error fetching too old MRs",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Fetch MRs that haven't been updated recently (filtered internally).
   */
  async fetchNotUpdatedMRs(
    options: {
      page?: number;
      per_page?: number;
      skipCache?: boolean; // Added skipCache option
    } = {}
  ): Promise<GitLabMRsResponse> {
    const { page = 1, per_page = 25, skipCache = false } = options;
    const threshold = thresholds.NOT_UPDATED_THRESHOLD;
    const cacheKey = generateCacheKey("filteredNotUpdatedMRs", { threshold });

    if (!skipCache) {
      const cached = getFromCache<GitLabMR[]>(cacheKey);
      if (cached) {
        const { paginatedItems, totalItems, totalPages } = this._paginateItems(
          cached,
          page,
          per_page
        );
        return {
          items: paginatedItems,
          metadata: {
            threshold,
            currentPage: page,
            perPage: per_page,
            totalItems,
            totalPages,
            lastRefreshed: new Date().toISOString(),
          },
        };
      }
    }

    try {
      const baseMRs = await this._getBaseMRs({ skipCache });
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - threshold);

      const filteredMRs = baseMRs.filter((mr) => {
        const updatedDate = new Date(mr.updated_at);
        return updatedDate < thresholdDate;
      });

      setInCache(cacheKey, filteredMRs);

      const { paginatedItems, totalItems, totalPages } = this._paginateItems(
        filteredMRs,
        page,
        per_page
      );

      return {
        items: paginatedItems,
        metadata: {
          threshold,
          currentPage: page,
          perPage: per_page,
          totalItems,
          totalPages,
          lastRefreshed: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(
        "Error fetching not updated MRs",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Fetch MRs that are pending review (filtered internally).
   */
  async fetchPendingReviewMRs(
    options: {
      page?: number;
      per_page?: number;
      skipCache?: boolean; // Added skipCache option
    } = {}
  ): Promise<GitLabMRsResponse> {
    const { page = 1, per_page = 25, skipCache = false } = options;
    const threshold = thresholds.PENDING_REVIEW_THRESHOLD;
    const cacheKey = generateCacheKey("filteredPendingReviewMRs", {
      threshold,
    });

    if (!skipCache) {
      const cached = getFromCache<GitLabMR[]>(cacheKey);
      if (cached) {
        const { paginatedItems, totalItems, totalPages } = this._paginateItems(
          cached,
          page,
          per_page
        );
        return {
          items: paginatedItems,
          metadata: {
            threshold,
            currentPage: page,
            perPage: per_page,
            totalItems,
            totalPages,
            lastRefreshed: new Date().toISOString(),
          },
        };
      }
    }

    try {
      const baseMRs = await this._getBaseMRs({ skipCache });
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - threshold);
      const teamUserIds = getTeamUserIds(); // Now defined due to import

      const filteredMRs = baseMRs.filter((mr) => {
        const isTeamReviewer = mr.reviewers.some((reviewer) =>
          teamUserIds.includes(reviewer.id)
        );
        const updatedDate = new Date(mr.updated_at);
        const isOldUpdate = updatedDate < thresholdDate;
        return isTeamReviewer && isOldUpdate;
      });

      setInCache(cacheKey, filteredMRs);

      const { paginatedItems, totalItems, totalPages } = this._paginateItems(
        filteredMRs,
        page,
        per_page
      );

      return {
        items: paginatedItems,
        metadata: {
          threshold,
          currentPage: page,
          perPage: per_page,
          totalItems,
          totalPages,
          lastRefreshed: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(
        "Error fetching pending review MRs",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Fetch Jira tickets (delegated to JiraService).
   */
  async fetchJiraTickets(
    options: JiraQueryOptions = {}
  ): Promise<JiraTicket[]> {
    // Pass skipCache option to the underlying service if needed
    try {
      return await jiraService.getTickets(options);
    } catch (error) {
      logger.error(
        "Error fetching Jira tickets",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Get MRs enriched with associated Jira tickets.
   */
  async getMRsWithJiraTickets(
    options: { skipCache?: boolean } = {} // Added skipCache option
  ): Promise<GitLabMRWithJira[]> {
    // Caching is handled within _getEnrichedMRs, pass skipCache
    try {
      return await this._getEnrichedMRs(options);
    } catch (error) {
      logger.error(
        "Error getting MRs with Jira tickets",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Get Jira tickets grouped with their associated MRs.
   */
  async getJiraTicketsWithMRs(
    options: {
      gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId">;
      jiraOptions?: JiraQueryOptions;
      skipCache?: boolean; // Added skipCache option
    } = {}
  ): Promise<JiraTicketWithMRs[]> {
    const { gitlabOptions = {}, jiraOptions = {}, skipCache = false } = options;
    // Pass skipCache to generate key correctly if needed, or handle inside
    const cacheKey = generateCacheKey("groupedJiraTicketsWithMRs", {
      gitlabOptions,
      jiraOptions,
    });

    if (!skipCache) {
      const cached = getFromCache<JiraTicketWithMRs[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Pass skipCache down to ensure fresh data if requested
      const enrichedMRs = await this._getEnrichedMRs({
        ...gitlabOptions,
        skipCache,
      });

      // Grouping logic remains the same
      const groupedByJira: Record<string, GitLabMRWithJira[]> = {};
      const ticketsMap: Record<string, JiraTicket> = {};

      enrichedMRs.forEach((mr) => {
        if (mr.jiraTicketKey && mr.jiraTicket) {
          if (!groupedByJira[mr.jiraTicketKey]) {
            groupedByJira[mr.jiraTicketKey] = [];
            ticketsMap[mr.jiraTicketKey] = mr.jiraTicket;
          }
          groupedByJira[mr.jiraTicketKey].push(mr);
        }
      });

      let result: JiraTicketWithMRs[] = Object.entries(groupedByJira).map(
        ([key, mrs]) => ({
          ticket: ticketsMap[key],
          mrs: mrs,
          totalMRs: mrs.length,
          openMRs: mrs.filter((mr) => mr.state === "opened").length,
          overdueMRs: mrs.filter((mr) => {
            const created = new Date(mr.created_at);
            return (
              (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24) > 28
            );
          }).length,
          stalledMRs: mrs.filter((mr) => {
            const updated = new Date(mr.updated_at);
            return (
              (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24) > 14
            );
          }).length,
        })
      );

      // Apply Jira-specific filters if provided
      result = this.filterJiraTicketsWithMRs(result, jiraOptions);

      setInCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error(
        "Error getting Jira tickets with MRs",
        { error },
        "UnifiedDataService"
      );
      throw error;
    }
  }

  /**
   * Filter JiraTicketWithMRs based on Jira query options.
   */
  filterJiraTicketsWithMRs(
    tickets: JiraTicketWithMRs[],
    options: JiraQueryOptions
  ): JiraTicketWithMRs[] {
    // Implementation remains the same
    return tickets.filter((ticketWithMRs) => {
      const ticket = ticketWithMRs.ticket;
      if (!ticket) return false;

      if (
        options.statuses &&
        options.statuses.length > 0 &&
        !options.statuses.includes(ticket.status)
      )
        return false;
      if (
        options.types &&
        options.types.length > 0 &&
        !options.types.includes(ticket.type)
      )
        return false;
      if (
        options.priorities &&
        options.priorities.length > 0 &&
        !options.priorities.includes(ticket.priority)
      )
        return false;
      if (
        options.assignees &&
        options.assignees.length > 0 &&
        (!ticket.assignee || !options.assignees.includes(ticket.assignee.id))
      )
        return false;
      if (options.sprintName && ticket.sprintName !== options.sprintName)
        return false;
      if (options.epicKey && ticket.epicKey !== options.epicKey) return false;
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        if (
          !ticket.title.toLowerCase().includes(searchLower) &&
          !ticket.key.toLowerCase().includes(searchLower)
        )
          return false;
      }
      if (options.labels && options.labels.length > 0) {
        if (
          !ticket.labels ||
          !options.labels.some((label) => ticket.labels?.includes(label))
        )
          return false;
      }
      return true;
    });
  }

  /**
   * Force refresh all data by invalidating caches.
   */
  refreshAllData(): void {
    invalidateCache(); // Clear processed data cache
    // Invalidate the base GitLab fetch cache held by gitlabApiCache
    gitlabApiCache.clear(); // Clear all raw GitLab API responses
    // Optionally clear Jira cache if a full refresh implies that too
    // jiraApiCache.clear();
    logger.info("All data caches invalidated for refresh.");
  }

  /**
   * Force refresh specific data type (invalidates relevant processed cache).
   * This might need refinement based on dependencies. If refreshing 'tooOld'
   * requires fresh base data, we might need to invalidate more broadly.
   */
  refreshData(dataType: string): void {
    // Invalidate specific processed data cache entry/pattern
    invalidateCache(dataType);
    // Consider if base data also needs invalidation for this specific refresh
    // For now, assume base data cache (gitlabApiCache) has its own TTL or is handled by refreshAllData
    logger.info(`Processed cache for ${dataType} invalidated.`);
  }
}

// Export a singleton instance
export const unifiedDataService = new UnifiedDataService();
