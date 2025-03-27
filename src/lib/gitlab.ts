// File: src/lib/gitlab.ts
import axios, { AxiosError } from "axios";
import { logger, measurePerformance } from "./logger";
import { gitlabApiCache } from "./gitlabCache";

// --- Constants ---
export const GITLAB_API_BASE_URL = "https://gitlab.com/api/v4"; // Export for test
const DEFAULT_PARENT_GROUP_PATH = "ska-telescope/ska-dev";
const DEFAULT_SEARCH_GROUP_ID = "3180705"; // Group ID for user search

// --- Interfaces (Keep existing interfaces: GitLabUser, GitLabMR, etc.) ---
export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
  web_url?: string;
  state?: string;
}

export interface GitLabMR {
  // Keep full interface definition
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

export interface FetchAllTeamMRsOptions {
  groupId: string;
  state?: "opened" | "closed" | "locked" | "merged" | "all";
  maxRetries?: number;
  include_subgroups?: boolean;
  skipCache?: boolean;
  teamUserIds?: number[]; // <-- Add optional teamUserIds
}

export interface FetchTeamMRsOptions extends FetchAllTeamMRsOptions {
  page?: number;
  per_page?: number;
}

export interface GitLabMRsResponse {
  items: GitLabMR[];
  metadata: {
    totalItems?: number;
    totalPages?: number;
    currentPage: number;
    perPage: number;
    nextPage?: number;
    prevPage?: number;
    threshold?: number;
    lastRefreshed?: string;
  };
}

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

// --- Helper Functions (Keep gitlabRequest, mapMemberToUser) ---
async function gitlabRequest<T>(
  url: string,
  params: Record<string, any> = {}
): Promise<T> {
  const apiToken =
    process.env.GITLAB_API_TOKEN || process.env.NEXT_PUBLIC_GITLAB_API_TOKEN;
  if (!apiToken) {
    throw new Error("GITLAB_API_TOKEN environment variable is not set");
  }
  try {
    logger.debug(
      "Making GitLab API request",
      { url, params },
      "GitLabAPI:Request"
    );
    const response = await axios.get<T>(url, {
      headers: { "PRIVATE-TOKEN": apiToken },
      params: { per_page: 100, ...params }, // Ensure per_page is set
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;
    const message = (responseData as any)?.message || axiosError.message;
    logger.error(
      "GitLab API request failed",
      { url, params, status, message, responseData },
      "GitLabAPI:Request"
    );
    throw new Error(`GitLab API request failed (${status}): ${message}`);
  }
}

function mapMemberToUser(member: GitLabMember): GitLabUser {
  return {
    id: member.id,
    name: member.name,
    username: member.username,
    avatar_url: member.avatar_url,
    web_url: member.web_url,
    state: member.state,
  };
}

// --- Core Functions ---

/**
 * Fetch GitLab users by group name under a specific parent group.
 * Uses the first result from GitLab's subgroup search.
 * @param groupName Name of the subgroup to search for.
 * @param parentGroupPath Path of the parent group (default: 'ska-telescope/ska-dev').
 * @param skipCache Skip cache and fetch fresh data.
 * @returns Array of user objects in the found group.
 */
export async function fetchUsersByGroupName(
  groupName: string,
  parentGroupPath: string = DEFAULT_PARENT_GROUP_PATH,
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  const operation = "fetchUsersByGroupName";
  const cacheKeyParams = { groupName, parentGroupPath };
  const cacheKey = gitlabApiCache.generateKey(operation, cacheKeyParams);

  // --- Cache Check ---
  if (!skipCache) {
    const cachedData = gitlabApiCache.get(cacheKey);
    if (cachedData) {
      logger.info(
        "[Cache] Using cached users for group",
        { groupName, cacheKey },
        "GitLabAPI:fetchUsersByGroupName"
      );
      return cachedData.data as GitLabUser[];
    }
    logger.info(
      "[Cache] Cache miss for group users",
      { groupName, cacheKey },
      "GitLabAPI:fetchUsersByGroupName"
    );
  } else {
    logger.info(
      "[Cache] Skipping cache for group users",
      { groupName },
      "GitLabAPI:fetchUsersByGroupName"
    );
  }

  logger.info(
    "Fetching users by group name",
    { groupName, parentGroupPath },
    "GitLabAPI:fetchUsersByGroupName"
  );

  try {
    // 1. Search for the subgroup within the parent group
    const encodedParentPath = encodeURIComponent(parentGroupPath);
    // No need to encode groupName here, axios handles query param encoding
    const groupSearchUrl = `${GITLAB_API_BASE_URL}/groups/${encodedParentPath}/subgroups`;
    const searchParams = { search: groupName };

    logger.debug(
      "Searching for subgroup",
      { url: groupSearchUrl, params: searchParams },
      "GitLabAPI:fetchUsersByGroupName"
    );
    const subgroups = await gitlabRequest<GitLabGroup[]>(
      groupSearchUrl,
      searchParams
    );
    logger.debug(
      "Subgroup search result",
      {
        count: subgroups?.length,
        subgroups: subgroups?.map((g) => ({
          id: g.id,
          name: g.name,
          path: g.path,
        })),
      },
      "GitLabAPI:fetchUsersByGroupName"
    );

    if (!subgroups || subgroups.length === 0) {
      logger.warn(
        "No subgroups found matching search term", // Changed log message
        { groupName, parentGroupPath },
        "GitLabAPI:fetchUsersByGroupName"
      );
      return [];
    }

    // 2. Use the FIRST result returned by the search
    const targetGroup = subgroups[0];
    // Log which group was selected, especially if multiple were returned
    if (subgroups.length > 1) {
      logger.info(
        `Multiple subgroups found for search term "${groupName}". Using the first result: "${targetGroup.name}" (ID: ${targetGroup.id})`,
        { allFound: subgroups.map((g) => g.name) },
        "GitLabAPI:fetchUsersByGroupName"
      );
    } else {
      logger.info(
        `Found target subgroup: "${targetGroup.name}" (ID: ${targetGroup.id})`,
        {},
        "GitLabAPI:fetchUsersByGroupName"
      );
    }

    // 3. Fetch members of the found subgroup
    const membersUrl = `${GITLAB_API_BASE_URL}/groups/${targetGroup.id}/members`; // REMOVED /all to get only DIRECT members
    logger.debug(
      "Fetching group members",
      { url: membersUrl },
      "GitLabAPI:fetchUsersByGroupName"
    );
    const members = await gitlabRequest<GitLabMember[]>(membersUrl);
    logger.debug(
      "Group members fetch result",
      { count: members?.length },
      "GitLabAPI:fetchUsersByGroupName"
    );

    const users = members.map(mapMemberToUser);
    const activeUsers = users.filter((u) => u.state === "active"); // Filter for active users

    // Cache the result (only active users)
    gitlabApiCache.set(cacheKey, activeUsers, {}); // Use default TTL

    logger.info(
      "Successfully fetched and filtered users by group name",
      {
        groupName: targetGroup.name,
        totalMembers: users.length,
        activeMembers: activeUsers.length,
      },
      "GitLabAPI:fetchUsersByGroupName"
    );

    return activeUsers;
  } catch (error) {
    logger.error(
      "Error occurred during fetchUsersByGroupName",
      { groupName, error: error instanceof Error ? error.message : error },
      "GitLabAPI:fetchUsersByGroupName"
    );
    return []; // Return empty on error
  }
}

// --- Keep other functions (searchUsersByNameOrUsername, fetchUsersByIds, getTeamUserIds, getDefaultTeamUsers, isTeamMember, isTeamRelevantMR, fetchAllTeamMRs, deprecated functions) ---
export async function searchUsersByNameOrUsername(
  searchTerm: string,
  groupId: string = DEFAULT_SEARCH_GROUP_ID,
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  const operation = "searchUsersByNameOrUsername";
  const cacheKeyParams = { searchTerm, groupId };
  const cacheKey = gitlabApiCache.generateKey(operation, cacheKeyParams);

  if (!skipCache) {
    const cachedData = gitlabApiCache.get(cacheKey);
    if (cachedData) {
      logger.info(
        "Using cached user search results",
        { searchTerm, cacheKey },
        "GitLabAPI"
      );
      return cachedData.data as GitLabUser[];
    }
  }

  logger.info(
    "Searching users by name/username",
    { searchTerm, groupId },
    "GitLabAPI"
  );

  const searchUrl = `${GITLAB_API_BASE_URL}/users`;
  const results = await gitlabRequest<GitLabUser[]>(searchUrl, {
    search: searchTerm,
  });

  const activeUsers = results.filter((user) => user.state === "active");

  gitlabApiCache.set(cacheKey, activeUsers, {});

  logger.info(
    "Successfully searched users",
    { searchTerm, resultCount: activeUsers.length },
    "GitLabAPI"
  );

  return activeUsers;
}

export async function fetchUsersByIds(
  userIds: number[],
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const operation = "fetchUsersByIds";
  const sortedIds = [...userIds].sort((a, b) => a - b);
  const cacheKeyParams = { ids: sortedIds.join(",") };
  const cacheKey = gitlabApiCache.generateKey(operation, cacheKeyParams);

  if (!skipCache) {
    const cachedData = gitlabApiCache.get(cacheKey);
    if (cachedData) {
      logger.info(
        "Using cached user details by IDs",
        { count: userIds.length, cacheKey },
        "GitLabAPI"
      );
      return cachedData.data as GitLabUser[];
    }
  }

  logger.info(
    "Fetching user details by IDs",
    { count: userIds.length },
    "GitLabAPI"
  );

  const userPromises = userIds.map(async (id) => {
    try {
      const userUrl = `${GITLAB_API_BASE_URL}/users/${id}`;
      const userCacheKey = gitlabApiCache.generateKey("fetchUserById", { id });
      if (!skipCache) {
        const cachedUser = gitlabApiCache.get(userCacheKey);
        if (cachedUser) return cachedUser.data as GitLabUser;
      }
      const user = await gitlabRequest<GitLabUser>(userUrl);
      if (!skipCache) {
        gitlabApiCache.set(userCacheKey, user, {});
      }
      return user;
    } catch (error) {
      logger.error("Failed to fetch user details for ID", { id, error });
      return null;
    }
  });

  const results = await Promise.all(userPromises);
  const validUsers = results.filter(
    (user): user is GitLabUser => user !== null && user.state === "active"
  );

  gitlabApiCache.set(cacheKey, validUsers, {});

  logger.info(
    "Successfully fetched user details by IDs",
    { requested: userIds.length, found: validUsers.length },
    "GitLabAPI"
  );

  return validUsers;
}

/**
 * Gets the default team user IDs from the environment variable.
 * Optionally accepts a string to parse instead (useful for testing or alternative sources).
 */
export function getTeamUserIds(idsString?: string | null): number[] {
  const userIds =
    idsString ?? // Use provided string if available
    process.env.GITLAB_USER_IDS ??
    process.env.NEXT_PUBLIC_GITLAB_USER_IDS ??
    "";
  try {
    if (!userIds) return [];
    const parsedIds = userIds.split(":").map((id) => parseInt(id.trim(), 10));
    const validIds = parsedIds.filter((id) => !isNaN(id));
    if (validIds.length !== parsedIds.length) {
      logger.warn(
        "Some user IDs were invalid and filtered out",
        { original: userIds },
        "GitLabAPI"
      );
    }
    return validIds;
  } catch (error) {
    logger.error(
      "Error parsing team user IDs",
      {
        input: userIds,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "GitLabAPI"
    );
    return [];
  }
}

export async function getDefaultTeamUsers(
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  const defaultIds = getTeamUserIds(); // Gets IDs from ENV
  if (defaultIds.length === 0) {
    logger.warn("No default team IDs configured.");
    return [];
  }
  return fetchUsersByIds(defaultIds, skipCache);
}

/**
 * Checks if a user ID belongs to the provided list of team IDs.
 */
export function isTeamMember(userId: number, teamUserIds: number[]): boolean {
  if (!userId || !teamUserIds) return false;
  return teamUserIds.includes(userId);
}

/**
 * Checks if an MR is relevant to the team based on author, assignee, or reviewer IDs.
 */
export function isTeamRelevantMR(mr: GitLabMR, teamUserIds: number[]): boolean {
  if (!mr || !teamUserIds || teamUserIds.length === 0) return false;

  const isAuthorTeamMember = isTeamMember(mr.author.id, teamUserIds);

  const hasTeamAssignee =
    mr.assignees?.some((assignee) => isTeamMember(assignee.id, teamUserIds)) ||
    (mr.assignee && isTeamMember(mr.assignee.id, teamUserIds));

  const hasTeamReviewer = mr.reviewers?.some((reviewer) =>
    isTeamMember(reviewer.id, teamUserIds)
  );

  return isAuthorTeamMember || hasTeamAssignee || hasTeamReviewer;
}

/**
 * Fetches all merge requests for a group, optionally including subgroups,
 * and then filters them based on relevance to the provided team user IDs.
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

  const {
    groupId = process.env.GITLAB_GROUP_ID,
    state = "opened",
    maxRetries = 3,
    include_subgroups = true,
    skipCache = false,
    teamUserIds: providedTeamUserIds, // Get optional team IDs from options
  } = options;

  // Determine which team IDs to use for filtering
  const filterTeamUserIds = providedTeamUserIds ?? getTeamUserIds(); // Use provided IDs or default from ENV

  if (!groupId) {
    logger.error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
    throw new Error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
  }

  // If no team IDs are available for filtering, return empty early
  if (filterTeamUserIds.length === 0) {
    logger.warn(
      "No team user IDs provided or configured, returning empty MR list."
    );
    return { items: [], totalItems: 0 };
  }

  const per_page = 100;
  // Include teamUserIds in the cache key if they were provided, otherwise use 'default'
  const teamIdCacheSegment = providedTeamUserIds
    ? providedTeamUserIds.sort().join(",")
    : "default";
  const baseCacheKeyParams = {
    state,
    per_page,
    include_subgroups: include_subgroups ? "true" : "false",
    teamIds: teamIdCacheSegment, // Add team info to cache key
  };
  const baseEndpoint = `groups/${groupId}/merge_requests`;

  // Cache key for the *final filtered* result for this team
  const filteredDatasetCacheKey = gitlabApiCache.generateKey(
    `${baseEndpoint}-filtered`,
    baseCacheKeyParams
  );

  if (!skipCache) {
    const cachedFilteredData = gitlabApiCache.get(filteredDatasetCacheKey);
    if (cachedFilteredData) {
      logger.info(
        "Using cached FILTERED dataset for GitLab MRs",
        {
          groupId,
          state,
          include_subgroups,
          teamIdCacheSegment,
          cacheKey: filteredDatasetCacheKey,
        },
        "GitLabAPI"
      );
      const items = cachedFilteredData.data as GitLabMR[];
      return { items, totalItems: items.length };
    }
    logger.info(
      "FILTERED dataset cache miss, will fetch raw data.",
      { cacheKey: filteredDatasetCacheKey },
      "GitLabAPI"
    );
  }

  // --- Fetch Raw Data (Page by Page) ---
  // Cache key for the raw, unfiltered data
  const rawDataCacheKeyParams = { ...baseCacheKeyParams };
  delete rawDataCacheKeyParams.teamIds; // Raw data cache doesn't depend on team
  const fullRawDatasetCacheKey = gitlabApiCache.generateKey(
    `${baseEndpoint}-all-raw`,
    rawDataCacheKeyParams
  );

  let allMRs: GitLabMR[] = [];

  if (!skipCache) {
    const cachedRawData = gitlabApiCache.get(fullRawDatasetCacheKey);
    if (cachedRawData) {
      logger.info(
        "Using cached full RAW dataset for GitLab MRs",
        { groupId, state, include_subgroups, cacheKey: fullRawDatasetCacheKey },
        "GitLabAPI"
      );
      allMRs = cachedRawData.data as GitLabMR[];
    } else {
      logger.info(
        "Full RAW dataset cache miss, fetching page by page.",
        { cacheKey: fullRawDatasetCacheKey },
        "GitLabAPI"
      );
    }
  }

  if (allMRs.length === 0) {
    // (Keep the existing pagination loop from the previous fix to fetch all raw MRs)
    let currentPage = 1;
    let nextUrl: string | null = `${GITLAB_API_BASE_URL}/${baseEndpoint}`; // Start with the base URL for page 1
    let retries = 0;

    logger.info(
      "Starting fetch for all GitLab MR pages (Raw)",
      { groupId, state, include_subgroups },
      "GitLabAPI"
    );

    while (nextUrl) {
      // Use a cache key specific to the raw page fetch
      const rawPageCacheKeyParams = {
        ...rawDataCacheKeyParams,
        page: currentPage,
      };
      const pageCacheKey = gitlabApiCache.generateKey(
        baseEndpoint,
        rawPageCacheKeyParams
      );

      let pageData: GitLabMR[] | null = null;
      let responseHeaders: Record<string, string | number> = {}; // Store headers

      if (!skipCache) {
        const cachedPage = gitlabApiCache.get(pageCacheKey);
        if (cachedPage) {
          pageData = cachedPage.data as GitLabMR[];
          responseHeaders = cachedPage.headers; // Get headers from cache
          logger.debug(
            `Using cached raw page ${currentPage}`,
            { cacheKey: pageCacheKey },
            "GitLabAPI"
          );
        }
      }

      if (!pageData) {
        try {
          logger.debug(
            `Fetching raw page ${currentPage}`,
            { url: nextUrl, cacheKey: pageCacheKey }, // Log the actual URL being fetched
            "GitLabAPI"
          );
          // Use axios directly to get headers easily
          const response = await axios.get<GitLabMR[]>(nextUrl, {
            headers: { "PRIVATE-TOKEN": apiToken },
            params: {
              // Params are already in nextUrl if it's from Link header,
              // but ensure base params are included for the first request
              ...(currentPage === 1 && {
                state,
                per_page,
                scope: "all",
                include_subgroups,
              }),
            },
          });

          pageData = response.data;
          responseHeaders = response.headers; // Store headers from the response

          if (!skipCache) {
            // Cache raw page data and headers
            gitlabApiCache.set(pageCacheKey, pageData || [], responseHeaders);
          }
          retries = 0; // Reset retries on success
        } catch (error) {
          // ... (keep existing retry logic) ...
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
            continue; // Retry the current loop iteration (same nextUrl)
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

      if (pageData && pageData.length > 0) {
        allMRs.push(...pageData);
      }

      // Determine the next URL from the 'Link' header or 'x-next-page'
      const linkHeader = responseHeaders["link"] as string;
      let foundNextUrl: string | null = null;
      if (linkHeader) {
        const links = linkHeader.split(", ");
        const nextLink = links.find((link) => link.includes('rel="next"'));
        if (nextLink) {
          foundNextUrl = nextLink.substring(
            nextLink.indexOf("<") + 1,
            nextLink.indexOf(">")
          );
        }
      }
      // Fallback or alternative: check x-next-page
      if (!foundNextUrl && responseHeaders["x-next-page"]) {
        // Construct full URL if only page number is given
        const nextPageNum = parseInt(
          String(responseHeaders["x-next-page"]),
          10
        );
        if (!isNaN(nextPageNum)) {
          const url = new URL(`${GITLAB_API_BASE_URL}/${baseEndpoint}`);
          url.searchParams.set("page", String(nextPageNum));
          url.searchParams.set("per_page", String(per_page));
          if (state) url.searchParams.set("state", state);
          if (include_subgroups)
            url.searchParams.set("include_subgroups", "true");
          url.searchParams.set("scope", "all");
          foundNextUrl = url.toString();
        }
      }

      nextUrl = foundNextUrl; // Update nextUrl for the next iteration
      currentPage++; // Increment page counter (mainly for logging/cache key)

      // Break if no more data or no next link/page
      if (!pageData || pageData.length === 0 || !nextUrl) {
        break;
      }
    }
    // --- End of pagination loop ---

    logger.info(
      "Finished fetching all GitLab MR pages (Raw)",
      { totalPagesFetched: currentPage - 1, rawMRsCount: allMRs.length },
      "GitLabAPI"
    );

    // Cache the full raw dataset
    if (!skipCache) {
      gitlabApiCache.set(fullRawDatasetCacheKey, allMRs, {});
    }
  }

  // --- Filter Raw Data ---
  const teamMRs = allMRs.filter((mr) =>
    isTeamRelevantMR(mr, filterTeamUserIds)
  );
  logger.info(
    "Filtered MRs for team relevance",
    { teamMRsCount: teamMRs.length, teamIdsUsed: filterTeamUserIds },
    "GitLabAPI"
  );

  // Cache the *filtered* result
  if (!skipCache) {
    gitlabApiCache.set(filteredDatasetCacheKey, teamMRs, {});
  }

  return {
    items: teamMRs,
    totalItems: teamMRs.length,
  };
}

// --- Deprecated Functions ---
/** @deprecated Use UnifiedDataService instead */
export async function fetchTeamMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn(
    "fetchTeamMRs is deprecated. Use UnifiedDataService or fetchAllTeamMRs.",
    {},
    "GitLabAPI"
  );
  // Basic implementation for backward compatibility if needed, but ideally remove calls
  // This now correctly uses the default team IDs for filtering via fetchAllTeamMRs
  const allData = await fetchAllTeamMRs(options); // Pass options directly
  const { page = 1, per_page = 25 } = options;
  const totalItems = allData.totalItems;
  const totalPages = Math.ceil(totalItems / per_page);
  const startIndex = (page - 1) * per_page;
  const endIndex = startIndex + per_page;
  const paginatedItems = allData.items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    metadata: {
      totalItems,
      totalPages,
      currentPage: page,
      perPage: per_page,
      nextPage: page < totalPages ? page + 1 : undefined,
      prevPage: page > 1 ? page - 1 : undefined,
      lastRefreshed: new Date().toISOString(),
    },
  };
}

/** @deprecated */
export async function fetchTooOldMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchTooOldMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}
/** @deprecated */
export async function fetchNotUpdatedMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchNotUpdatedMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}
/** @deprecated */
export async function fetchPendingReviewMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchPendingReviewMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}
