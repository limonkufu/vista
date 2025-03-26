// File: src/lib/gitlab.ts
import axios, { AxiosError } from "axios";
import { logger, measurePerformance } from "./logger";
import { gitlabApiCache } from "./gitlabCache";

/**
 * GitLab API base URL
 */
const GITLAB_API_BASE_URL = "https://gitlab.com/api/v4";

/**
 * Interface for MR author, assignee, or reviewer
 */
export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
  web_url?: string;
}

/**
 * Interface for GitLab Merge Request
 */
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: "opened" | "closed" | "locked" | "merged";
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  target_branch: string;
  source_branch: string;
  user_notes_count: number;
  upvotes: number;
  downvotes: number;
  author: GitLabUser;
  assignees: GitLabUser[];
  assignee: GitLabUser | null;
  reviewers: GitLabUser[];
  source_project_id: number;
  target_project_id: number;
  labels: string[];
  work_in_progress: boolean;
  milestone: {
    id: number;
    iid: number;
    project_id: number;
    title: string;
    description: string;
    state: string;
    created_at: string;
    updated_at: string;
    due_date: string | null;
    start_date: string | null;
    web_url: string;
  } | null;
  merge_when_pipeline_succeeds: boolean;
  merge_status: string;
  merge_error: string | null;
  sha: string;
  merge_commit_sha: string | null;
  squash_commit_sha: string | null;
  discussion_locked: boolean | null;
  should_remove_source_branch: boolean | null;
  force_remove_source_branch: boolean | null;
  reference: string;
  references: {
    short: string;
    relative: string;
    full: string;
  };
  web_url: string;
  time_stats: {
    time_estimate: number;
    total_time_spent: number;
    human_time_estimate: string | null;
    human_total_time_spent: string | null;
  };
  squash: boolean;
  task_completion_status: {
    count: number;
    completed_count: number;
  };
  has_conflicts: boolean;
  blocking_discussions_resolved: boolean;
  draft?: boolean;
}

/**
 * Interface for fetch options for the base fetch function
 */
export interface FetchAllTeamMRsOptions {
  /** GitLab group ID */
  groupId: string;
  /** State of merge requests */
  state?: "opened" | "closed" | "locked" | "merged" | "all";
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
  /** Whether to include MRs from subgroups */
  include_subgroups?: boolean;
  /** Skip cache and fetch fresh data */
  skipCache?: boolean;
}

/**
 * Interface for API response including pagination metadata
 */
export interface GitLabMRsResponse {
  items: GitLabMR[];
  metadata: {
    totalItems?: number;
    totalPages?: number;
    currentPage: number;
    perPage: number;
    nextPage?: number;
    prevPage?: number;
    threshold?: number; // Kept for potential use in filtered responses
    lastRefreshed?: string;
  };
}

/**
 * Interface for GitLab group from API response
 */
interface GitLabGroup {
  id: number;
  name: string;
  path: string;
  description?: string;
  visibility: string;
  full_path: string;
  parent_id?: number;
  web_url: string;
}

/**
 * Interface for GitLab member from API response
 */
interface GitLabMember {
  id: number;
  name: string;
  username: string;
  state: string;
  avatar_url: string;
  web_url: string;
  access_level: number;
  expires_at: string | null;
}

/**
 * Fetch GitLab user IDs by group name
 * @param groupName Name of the group to search for
 * @param parentGroupPath Parent group path (default: 'ska-telescope/ska-dev')
 * @returns Array of user IDs and their information
 */
export async function fetchUserIdsByGroupName(
  groupName: string,
  parentGroupPath: string = "ska-telescope/ska-dev"
): Promise<{
  ids: number[];
  users: GitLabUser[];
}> {
  try {
    logger.info(
      "Fetching user IDs by group name",
      { groupName, parentGroupPath },
      "GitLab API"
    );

    // First, find the group ID by name
    const encodedParentPath = encodeURIComponent(parentGroupPath);
    const encodedGroupName = encodeURIComponent(groupName);
    const groupSearchUrl = `${GITLAB_API_BASE_URL}/groups/${encodedParentPath}/subgroups?search=${encodedGroupName}`;

    const groupResponse = await axios.get<GitLabGroup[]>(groupSearchUrl, {
      headers: {
        "PRIVATE-TOKEN": process.env.GITLAB_API_TOKEN || "",
      },
    });

    if (!groupResponse.data || groupResponse.data.length === 0) {
      logger.warn(
        "No groups found with the given name",
        { groupName },
        "GitLab API"
      );
      return { ids: [], users: [] };
    }

    // Filter groups that match the name case-insensitively
    const matchingGroups = groupResponse.data.filter(
      (group: GitLabGroup) =>
        group.name.toLowerCase() === groupName.toLowerCase()
    );

    if (matchingGroups.length === 0) {
      logger.warn(
        "No exact match found for group name",
        { groupName },
        "GitLab API"
      );
      return { ids: [], users: [] };
    }

    const groupId = matchingGroups[0].id;

    // Now fetch members of the group
    const membersUrl = `${GITLAB_API_BASE_URL}/groups/${groupId}/members`;
    const membersResponse = await axios.get<GitLabMember[]>(membersUrl, {
      headers: {
        "PRIVATE-TOKEN": process.env.GITLAB_API_TOKEN || "",
      },
    });

    const users = membersResponse.data.map((member: GitLabMember) => ({
      id: member.id,
      name: member.name,
      username: member.username,
      avatar_url: member.avatar_url,
      web_url: member.web_url,
    }));

    const ids = users.map((user: GitLabUser) => user.id);

    logger.info(
      "Successfully fetched user IDs by group name",
      { groupName, userCount: users.length },
      "GitLab API"
    );

    return { ids, users };
  } catch (error) {
    const errorMessage =
      error instanceof AxiosError
        ? error.response?.data?.message || error.message
        : "Unknown error";

    logger.error(
      "Error fetching user IDs by group name",
      { groupName, error: errorMessage },
      "GitLab API"
    );

    throw new Error(`Failed to fetch user IDs by group name: ${errorMessage}`);
  }
}

/**
 * Get GitLab user IDs for the team
 * @returns Array of user IDs
 */
export function getTeamUserIds(): number[] {
  const userIds =
    process.env.GITLAB_USER_IDS ||
    process.env.NEXT_PUBLIC_GITLAB_USER_IDS ||
    "";

  try {
    // If userIds is empty, return an empty array
    if (!userIds) {
      logger.warn(
        "No user IDs found in environment variables",
        {},
        "GitLab API"
      );
      return [];
    }

    // Parse the colon-separated user IDs
    const parsedIds = userIds.split(":").map((id) => parseInt(id.trim(), 10));

    // Filter out any NaN values
    const validIds = parsedIds.filter((id) => !isNaN(id));

    if (validIds.length === 0) {
      logger.warn(
        "No valid user IDs found in environment variables",
        {},
        "GitLab API"
      );
      return [];
    }

    if (validIds.length !== parsedIds.length) {
      logger.warn(
        "Some user IDs were invalid and have been filtered out",
        {},
        "GitLab API"
      );
    }

    return validIds;
  } catch (error) {
    logger.error(
      "Error parsing team user IDs",
      { error: error instanceof Error ? error.message : "Unknown error" },
      "GitLab API"
    );
    return [];
  }
}

/**
 * Checks if a user is a team member based on GITLAB_USER_IDS
 * @param user - GitLab user object
 * @returns true if the user is a team member
 */
export function isTeamMember(user: GitLabUser): boolean {
  if (!user || !user.id) return false;
  const teamUserIds = getTeamUserIds();
  return teamUserIds.includes(user.id);
}

/**
 * Checks if a merge request is relevant to the team
 * @param mr - GitLab merge request
 * @returns true if the MR is authored by, assigned to, or reviewed by a team member
 */
export function isTeamRelevantMR(mr: GitLabMR): boolean {
  if (!mr) return false;

  // Check if author is a team member
  const isAuthorTeamMember = isTeamMember(mr.author);

  // Check if any assignee is a team member
  const hasTeamAssignee =
    mr.assignees?.some(isTeamMember) ||
    (mr.assignee && isTeamMember(mr.assignee));

  // Check if any reviewer is a team member
  const hasTeamReviewer = mr.reviewers?.some(isTeamMember);

  return isAuthorTeamMember || hasTeamAssignee || hasTeamReviewer;
}

/**
 * Fetches all pages of merge requests relevant to the team from GitLab API.
 * Handles pagination internally and uses caching.
 * @param options - Options for the API call including groupId, state, etc.
 * @returns Promise with all relevant merge requests across all pages.
 */
export async function fetchAllTeamMRs(
  options: FetchAllTeamMRsOptions
): Promise<{ items: GitLabMR[]; totalItems: number }> {
  const apiToken =
    process.env.GITLAB_API_TOKEN || process.env.NEXT_PUBLIC_GITLAB_API_TOKEN;
  if (!apiToken) {
    logger.error("GITLAB_API_TOKEN environment variable is not set");
    throw new Error("GITLAB_API_TOKEN environment variable is not set");
  }

  const teamUserIds = getTeamUserIds();
  if (teamUserIds.length === 0) {
    logger.warn("No team user IDs configured, returning empty MR list.");
    return { items: [], totalItems: 0 };
  }

  const {
    groupId = process.env.GITLAB_GROUP_ID,
    state = "opened",
    maxRetries = 3,
    include_subgroups = true,
    skipCache = false,
  } = options;

  if (!groupId) {
    logger.error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
    throw new Error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
  }

  const per_page = 100; // Use max per_page for efficiency
  const baseCacheKeyParams = {
    state,
    per_page, // Include per_page in key as it affects total pages
    include_subgroups: include_subgroups ? "true" : "false",
  };
  const baseEndpoint = `groups/${groupId}/merge_requests`;

  // --- Cache Check ---
  // Generate a cache key for the *entire* dataset based on base parameters
  const fullDatasetCacheKey = gitlabApiCache.generateKey(
    `${baseEndpoint}-all`,
    baseCacheKeyParams
  );

  if (!skipCache) {
    const cachedFullDataset = gitlabApiCache.get(fullDatasetCacheKey);
    if (cachedFullDataset) {
      logger.info(
        "Using cached full dataset for GitLab MRs",
        { groupId, state, include_subgroups, cacheKey: fullDatasetCacheKey },
        "GitLabAPI"
      );
      // The cached data should already be filtered for team relevance
      return {
        items: cachedFullDataset.data,
        totalItems: cachedFullDataset.data.length, // Or get from headers if stored
      };
    }
    // If full dataset not cached, proceed to fetch page by page
    logger.info(
      "Full dataset cache miss, fetching page by page.",
      { cacheKey: fullDatasetCacheKey },
      "GitLabAPI"
    );
  }

  // --- Fetching Logic ---
  let allMRs: GitLabMR[] = [];
  let currentPage = 1;
  let totalPages = 1; // Assume 1 page initially
  let totalItems = 0;
  let retries = 0;

  logger.info(
    "Starting fetch for all GitLab MR pages",
    { groupId, state, include_subgroups },
    "GitLabAPI"
  );

  while (currentPage <= totalPages) {
    const pageCacheKey = gitlabApiCache.generateKey(baseEndpoint, {
      ...baseCacheKeyParams,
      page: currentPage,
    });

    let pageData: GitLabMR[] | null = null;
    let responseHeaders: Record<string, string | number> = {};

    // Try cache first for the specific page (unless skipping)
    if (!skipCache) {
      const cachedPage = gitlabApiCache.get(pageCacheKey);
      if (cachedPage) {
        pageData = cachedPage.data;
        responseHeaders = cachedPage.headers;
        logger.debug(
          `Using cached page ${currentPage}/${totalPages}`,
          { cacheKey: pageCacheKey },
          "GitLabAPI"
        );
      }
    }

    // Fetch if not found in cache or skipping cache
    if (!pageData) {
      try {
        logger.debug(
          `Fetching page ${currentPage}/${totalPages || "?"}`,
          { cacheKey: pageCacheKey },
          "GitLabAPI"
        );
        const response = await measurePerformance(
          `GitLab API Request Page ${currentPage}`,
          () =>
            axios.get(`${GITLAB_API_BASE_URL}/${baseEndpoint}`, {
              headers: { "PRIVATE-TOKEN": apiToken },
              params: {
                state,
                page: currentPage,
                per_page,
                scope: "all",
                include_subgroups,
              },
            })
        );

        pageData = response.data;
        responseHeaders = {
          "x-total": String(response.headers["x-total"] || "0"),
          "x-total-pages": String(response.headers["x-total-pages"] || "0"),
          // Add other headers if needed for caching
        };

        // Store fetched page in cache (only if not skipping)
        if (!skipCache) {
          gitlabApiCache.set(pageCacheKey, pageData || [], responseHeaders);
        }
        retries = 0; // Reset retries on success
      } catch (error) {
        const axiosError = error as AxiosError;
        logger.error(
          `GitLab API error fetching page ${currentPage}`,
          {
            status: axiosError.response?.status,
            message: axiosError.message,
            retry: retries + 1,
            maxRetries,
          },
          "GitLabAPI"
        );

        if (retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000;
          logger.info(
            `Retrying page ${currentPage} in ${delay}ms (${retries}/${maxRetries})`,
            {},
            "GitLabAPI"
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue; // Retry the current page
        } else {
          logger.error(
            `Max retries reached for page ${currentPage}. Aborting fetch.`,
            {},
            "GitLabAPI"
          );
          throw new Error(
            `Failed to fetch GitLab MRs after ${maxRetries} retries.`
          );
        }
      }
    }

    // Process fetched/cached page data
    if (pageData) {
      allMRs.push(...pageData);
    }

    // Update total pages and items from headers (only needed on first page really)
    if (currentPage === 1) {
      totalPages = parseInt(
        String(responseHeaders["x-total-pages"] || "1"),
        10
      );
      totalItems = parseInt(String(responseHeaders["x-total"] || "0"), 10);
      // If totalPages is 0, set it to 1 to avoid infinite loop if totalItems is also 0
      if (totalPages === 0 && totalItems === 0) {
        totalPages = 1;
      }
    }

    currentPage++;
  }

  logger.info(
    "Finished fetching all GitLab MR pages",
    { totalPagesFetched: currentPage - 1, rawMRsCount: allMRs.length },
    "GitLabAPI"
  );

  // Filter for team relevance *after* fetching all MRs
  const teamMRs = allMRs.filter(isTeamRelevantMR);
  logger.info(
    "Filtered MRs for team relevance",
    { teamMRsCount: teamMRs.length },
    "GitLabAPI"
  );

  // Cache the *entire filtered* dataset if it wasn't fully cached initially
  if (!skipCache) {
    // Check again if the full dataset was cached during page fetches
    const cachedFullDataset = gitlabApiCache.get(fullDatasetCacheKey);
    if (!cachedFullDataset) {
      logger.info(
        "Caching full filtered dataset",
        { cacheKey: fullDatasetCacheKey, count: teamMRs.length },
        "GitLabAPI"
      );
      // Store the filtered team MRs with minimal headers
      gitlabApiCache.set(fullDatasetCacheKey, teamMRs, {
        "x-total-filtered": teamMRs.length,
      });
    }
  }

  return {
    items: teamMRs,
    totalItems: teamMRs.length, // Return the count of *team-relevant* MRs
  };
}

// --- Deprecated Functions ---
// These functions are kept temporarily for reference but should be removed
// once UnifiedDataService fully handles the filtering.

/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchTooOldMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchTooOldMRs is deprecated", {}, "GitLabAPI");
  // This function should no longer be used directly.
  // The filtering logic is now handled within UnifiedDataService.
  // Kept for reference during refactoring.
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}

/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchNotUpdatedMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchNotUpdatedMRs is deprecated", {}, "GitLabAPI");
  // This function should no longer be used directly.
  // The filtering logic is now handled within UnifiedDataService.
  // Kept for reference during refactoring.
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}

/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchPendingReviewMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchPendingReviewMRs is deprecated", {}, "GitLabAPI");
  // This function should no longer be used directly.
  // The filtering logic is now handled within UnifiedDataService.
  // Kept for reference during refactoring.
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}
