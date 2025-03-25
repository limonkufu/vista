/**
 * Unified Data Service
 *
 * Centralizes data fetching for both GitLab MRs and Jira tickets.
 * Implements efficient caching and provides data transformation
 * methods for different views while maintaining backward compatibility.
 */

import {
  fetchTeamMRs,
  fetchTooOldMRs,
  fetchNotUpdatedMRs,
  fetchPendingReviewMRs,
  GitLabMR,
  GitLabMRsResponse,
  FetchTeamMRsOptions,
} from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { jiraService } from "./JiraServiceFactory";
import { logger } from "@/lib/logger";

// Type for unified response data
export interface UnifiedDataResponse<T> {
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastRefreshed?: string;
  refetch: () => Promise<void>;
}

// Cache for the unified data
const dataCache: Record<
  string,
  {
    data: any;
    timestamp: number;
    validUntil: number;
  }
> = {};

// Default cache TTL in milliseconds (5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

// Generate a consistent cache key based on operation and options
function generateCacheKey(operation: string, options?: any): string {
  const optionsStr = options ? JSON.stringify(options) : "";
  return `${operation}:${optionsStr}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(key: string): boolean {
  const cached = dataCache[key];
  if (!cached) return false;
  return Date.now() < cached.validUntil;
}

/**
 * Get data from cache
 */
function getFromCache<T>(key: string): T | null {
  if (isCacheValid(key)) {
    return dataCache[key].data as T;
  }
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
  dataCache[key] = {
    data,
    timestamp: now,
    validUntil: now + ttl,
  };
}

/**
 * Clear cache for a specific key or pattern
 */
function invalidateCache(keyPattern: string): void {
  Object.keys(dataCache).forEach((key) => {
    if (key.includes(keyPattern)) {
      delete dataCache[key];
    }
  });
}

class UnifiedDataService {
  /**
   * Fetch MRs that are too old
   */
  async fetchTooOldMRs(
    options?: Omit<FetchTeamMRsOptions, "groupId">
  ): Promise<GitLabMRsResponse> {
    const groupId = process.env.GITLAB_GROUP_ID || "";
    const mergedOptions: FetchTeamMRsOptions = { groupId, ...options };
    const cacheKey = generateCacheKey("tooOldMRs", mergedOptions);

    const cached = getFromCache<GitLabMRsResponse>(cacheKey);
    if (cached) {
      logger.info("Using cached too old MRs data", { cacheKey });
      return cached;
    }

    try {
      const response = await fetchTooOldMRs(mergedOptions);
      setInCache(cacheKey, response);
      return response;
    } catch (error) {
      logger.error("Error fetching too old MRs", { error });
      throw error;
    }
  }

  /**
   * Fetch MRs that haven't been updated recently
   */
  async fetchNotUpdatedMRs(
    options?: Omit<FetchTeamMRsOptions, "groupId">
  ): Promise<GitLabMRsResponse> {
    const groupId = process.env.GITLAB_GROUP_ID || "";
    const mergedOptions: FetchTeamMRsOptions = { groupId, ...options };
    const cacheKey = generateCacheKey("notUpdatedMRs", mergedOptions);

    const cached = getFromCache<GitLabMRsResponse>(cacheKey);
    if (cached) {
      logger.info("Using cached not updated MRs data", { cacheKey });
      return cached;
    }

    try {
      const response = await fetchNotUpdatedMRs(mergedOptions);
      setInCache(cacheKey, response);
      return response;
    } catch (error) {
      logger.error("Error fetching not updated MRs", { error });
      throw error;
    }
  }

  /**
   * Fetch MRs that are pending review
   */
  async fetchPendingReviewMRs(
    options?: Omit<FetchTeamMRsOptions, "groupId">
  ): Promise<GitLabMRsResponse> {
    const groupId = process.env.GITLAB_GROUP_ID || "";
    const mergedOptions: FetchTeamMRsOptions = { groupId, ...options };
    const cacheKey = generateCacheKey("pendingReviewMRs", mergedOptions);

    const cached = getFromCache<GitLabMRsResponse>(cacheKey);
    if (cached) {
      logger.info("Using cached pending review MRs data", { cacheKey });
      return cached;
    }

    try {
      const response = await fetchPendingReviewMRs(mergedOptions);
      setInCache(cacheKey, response);
      return response;
    } catch (error) {
      logger.error("Error fetching pending review MRs", { error });
      throw error;
    }
  }

  /**
   * Fetch Jira tickets
   */
  async fetchJiraTickets(options?: JiraQueryOptions): Promise<JiraTicket[]> {
    const cacheKey = generateCacheKey("jiraTickets", options);

    const cached = getFromCache<JiraTicket[]>(cacheKey);
    if (cached) {
      logger.info("Using cached Jira tickets data", { cacheKey });
      return cached;
    }

    try {
      const tickets = await jiraService.getTickets(options);
      setInCache(cacheKey, tickets);
      return tickets;
    } catch (error) {
      logger.error("Error fetching Jira tickets", { error });
      throw error;
    }
  }

  /**
   * Get MRs with associated Jira tickets
   */
  async getMRsWithJiraTickets(
    options?: Omit<FetchTeamMRsOptions, "groupId">
  ): Promise<GitLabMRWithJira[]> {
    const groupId = process.env.GITLAB_GROUP_ID || "";
    const mergedOptions: FetchTeamMRsOptions = { groupId, ...options };
    const cacheKey = generateCacheKey("mrsWithJira", mergedOptions);

    const cached = getFromCache<GitLabMRWithJira[]>(cacheKey);
    if (cached) {
      logger.info("Using cached MRs with Jira data", { cacheKey });
      return cached;
    }

    try {
      // Fetch MRs
      const mrsResponse = await fetchTeamMRs(mergedOptions);

      // Map Jira tickets to MRs
      const mrsWithJira = await jiraService.mapMRsToTickets(mrsResponse.items);

      setInCache(cacheKey, mrsWithJira);
      return mrsWithJira;
    } catch (error) {
      logger.error("Error fetching MRs with Jira tickets", { error });
      throw error;
    }
  }

  /**
   * Get Jira tickets with associated MRs
   */
  async getJiraTicketsWithMRs(
    options?: Omit<FetchTeamMRsOptions, "groupId">,
    jiraOptions?: JiraQueryOptions
  ): Promise<JiraTicketWithMRs[]> {
    const groupId = process.env.GITLAB_GROUP_ID || "";
    const mergedOptions: FetchTeamMRsOptions = { groupId, ...options };
    const cacheKey = generateCacheKey("jiraWithMRs", {
      gitlabOptions: mergedOptions,
      jiraOptions,
    });

    const cached = getFromCache<JiraTicketWithMRs[]>(cacheKey);
    if (cached) {
      logger.info("Using cached Jira tickets with MRs data", { cacheKey });
      return cached;
    }

    try {
      // Fetch MRs
      const mrsResponse = await fetchTeamMRs(mergedOptions);

      // Group MRs by Jira ticket
      const ticketsWithMRs = await jiraService.getMRsGroupedByTicket(
        mrsResponse.items
      );

      // Apply Jira filters if provided
      let filteredTickets = ticketsWithMRs;
      if (jiraOptions) {
        filteredTickets = this.filterJiraTicketsWithMRs(
          ticketsWithMRs,
          jiraOptions
        );
      }

      setInCache(cacheKey, filteredTickets);
      return filteredTickets;
    } catch (error) {
      logger.error("Error fetching Jira tickets with MRs", { error });
      throw error;
    }
  }

  /**
   * Filter JiraTicketWithMRs based on Jira query options
   */
  filterJiraTicketsWithMRs(
    tickets: JiraTicketWithMRs[],
    options: JiraQueryOptions
  ): JiraTicketWithMRs[] {
    return tickets.filter((ticketWithMRs) => {
      const ticket = ticketWithMRs.ticket;

      // Filter by status
      if (options.statuses && options.statuses.length > 0) {
        if (!options.statuses.includes(ticket.status)) return false;
      }

      // Filter by type
      if (options.types && options.types.length > 0) {
        if (!options.types.includes(ticket.type)) return false;
      }

      // Filter by priority
      if (options.priorities && options.priorities.length > 0) {
        if (!options.priorities.includes(ticket.priority)) return false;
      }

      // Filter by assignee
      if (options.assignees && options.assignees.length > 0) {
        if (!ticket.assignee || !options.assignees.includes(ticket.assignee.id))
          return false;
      }

      // Filter by sprint
      if (options.sprintName && ticket.sprintName !== options.sprintName) {
        return false;
      }

      // Filter by epic
      if (options.epicKey && ticket.epicKey !== options.epicKey) {
        return false;
      }

      // Filter by search term
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const inTitle = ticket.title.toLowerCase().includes(searchLower);
        const inKey = ticket.key.toLowerCase().includes(searchLower);
        if (!inTitle && !inKey) return false;
      }

      // Filter by labels
      if (options.labels && options.labels.length > 0) {
        if (!ticket.labels) return false;
        const hasAnyLabel = options.labels.some((label) =>
          ticket.labels?.includes(label)
        );
        if (!hasAnyLabel) return false;
      }

      return true;
    });
  }

  /**
   * Force refresh all data
   */
  refreshAllData(): void {
    invalidateCache("");
    logger.info("All cached data invalidated");
  }

  /**
   * Force refresh specific data type
   */
  refreshData(dataType: string): void {
    invalidateCache(dataType);
    logger.info(`Cached data for ${dataType} invalidated`);
  }
}

// Export a singleton instance
export const unifiedDataService = new UnifiedDataService();
