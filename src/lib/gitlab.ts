// File: src/lib/gitlab.ts
import axios, { AxiosError } from "axios";
import { logger, measurePerformance } from "./logger";
import { gitlabApiCache } from "./gitlabCache";

// --- Constants ---
const GITLAB_API_BASE_URL = "https://gitlab.com/api/v4";
const DEFAULT_PARENT_GROUP_PATH = "ska-telescope/ska-dev";
const DEFAULT_SEARCH_GROUP_ID = "3180705"; // Group ID for user search

// --- Interfaces ---
export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
  web_url?: string;
  state?: string; // Added state for filtering active users if needed
}

// ... (Keep existing GitLabMR, FetchAllTeamMRsOptions, GitLabMRsResponse interfaces) ...
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

export interface FetchAllTeamMRsOptions {
  groupId: string;
  state?: "opened" | "closed" | "locked" | "merged" | "all";
  maxRetries?: number;
  include_subgroups?: boolean;
  skipCache?: boolean;
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

// --- Helper Functions ---

/**
 * Makes an authenticated request to the GitLab API.
 */
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
    const response = await axios.get<T>(url, {
      headers: { "PRIVATE-TOKEN": apiToken },
      params: { per_page: 100, ...params }, // Default to max per_page
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const message =
      (axiosError.response?.data as any)?.message || axiosError.message;
    logger.error(
      "GitLab API request failed",
      { url, status, message },
      "GitLabAPI"
    );
    throw new Error(`GitLab API request failed (${status}): ${message}`);
  }
}

/**
 * Maps GitLab member data to GitLabUser.
 */
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
 * Searches for subgroups case-insensitively.
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

  if (!skipCache) {
    const cachedData = gitlabApiCache.get(cacheKey);
    if (cachedData) {
      logger.info(
        "Using cached users for group",
        { groupName, cacheKey },
        "GitLabAPI"
      );
      return cachedData.data as GitLabUser[]; // Assume data is GitLabUser[]
    }
  }

  logger.info(
    "Fetching users by group name",
    { groupName, parentGroupPath },
    "GitLabAPI"
  );

  // 1. Find the parent group ID (optional, could hardcode if stable)
  // For simplicity, we'll use the encoded path directly in the subgroup search URL

  // 2. Search for the subgroup within the parent group
  const encodedParentPath = encodeURIComponent(parentGroupPath);
  const encodedGroupName = encodeURIComponent(groupName);
  const groupSearchUrl = `${GITLAB_API_BASE_URL}/groups/${encodedParentPath}/subgroups`;

  const subgroups = await gitlabRequest<GitLabGroup[]>(groupSearchUrl, {
    search: encodedGroupName,
  });

  if (!subgroups || subgroups.length === 0) {
    logger.warn(
      "No subgroups found matching search",
      { groupName, parentGroupPath },
      "GitLabAPI"
    );
    return [];
  }

  // 3. Find the first case-insensitive match
  const targetGroup = subgroups.find(
    (group) => group.name.toLowerCase() === groupName.toLowerCase()
  );

  if (!targetGroup) {
    logger.warn(
      "No exact case-insensitive subgroup match found",
      { groupName, parentGroupPath },
      "GitLabAPI"
    );
    return [];
  }

  // 4. Fetch members of the found subgroup
  const membersUrl = `${GITLAB_API_BASE_URL}/groups/${targetGroup.id}/members/all`; // Use /all to include inherited members
  const members = await gitlabRequest<GitLabMember[]>(membersUrl);

  const users = members.map(mapMemberToUser);

  // Cache the result
  gitlabApiCache.set(cacheKey, users, {}); // Use default TTL

  logger.info(
    "Successfully fetched users by group name",
    { groupName, userCount: users.length },
    "GitLabAPI"
  );

  return users;
}

/**
 * Search for users within a specific group by name or username (case-insensitive).
 * @param searchTerm The name or username to search for.
 * @param groupId The ID of the group to search within (default: DEFAULT_SEARCH_GROUP_ID).
 * @param skipCache Skip cache and fetch fresh data.
 * @returns Array of matching user objects.
 */
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

  // GitLab's user search within a group seems less direct via documented API.
  // The Makefile uses /groups/:id/search?scope=users&search=term, which isn't standard.
  // A more reliable way is to fetch all members and filter, or use the global /users endpoint.
  // Let's use the global /users endpoint for broader search, then filter if needed.
  // Note: This might return users outside the specific group if not filtered further.
  // If strict group membership is required, fetching all group members and filtering is safer.

  // Using global search:
  const searchUrl = `${GITLAB_API_BASE_URL}/users`;
  const results = await gitlabRequest<GitLabUser[]>(searchUrl, {
    search: searchTerm,
  });

  // No need for case-insensitive check here as GitLab search handles it.
  // Filter for active users if necessary
  const activeUsers = results.filter((user) => user.state === "active");

  // Cache the result
  gitlabApiCache.set(cacheKey, activeUsers, {}); // Use default TTL

  logger.info(
    "Successfully searched users",
    { searchTerm, resultCount: activeUsers.length },
    "GitLabAPI"
  );

  return activeUsers;
}

/**
 * Fetch user details for a list of user IDs.
 * @param userIds Array of user IDs.
 * @param skipCache Skip cache and fetch fresh data.
 * @returns Array of user objects.
 */
export async function fetchUsersByIds(
  userIds: number[],
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const operation = "fetchUsersByIds";
  // Sort IDs for consistent cache key
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

  // Fetch users one by one (GitLab API doesn't have a bulk fetch by multiple IDs easily)
  // Consider using Promise.allSettled for resilience if one ID fails
  const userPromises = userIds.map(async (id) => {
    try {
      const userUrl = `${GITLAB_API_BASE_URL}/users/${id}`;
      // Use a separate cache key for individual user fetches
      const userCacheKey = gitlabApiCache.generateKey("fetchUserById", { id });
      if (!skipCache) {
        const cachedUser = gitlabApiCache.get(userCacheKey);
        if (cachedUser) return cachedUser.data as GitLabUser;
      }
      const user = await gitlabRequest<GitLabUser>(userUrl);
      if (!skipCache) {
        gitlabApiCache.set(userCacheKey, user, {}); // Cache individual user
      }
      return user;
    } catch (error) {
      logger.error("Failed to fetch user details for ID", { id, error });
      return null; // Return null for failed fetches
    }
  });

  const results = await Promise.all(userPromises);
  const validUsers = results.filter(
    (user): user is GitLabUser => user !== null
  );

  // Cache the combined result for the specific set of IDs
  gitlabApiCache.set(cacheKey, validUsers, {});

  logger.info(
    "Successfully fetched user details by IDs",
    { requested: userIds.length, found: validUsers.length },
    "GitLabAPI"
  );

  return validUsers;
}

/**
 * Get the list of default team user IDs from environment variables.
 * @returns Array of user IDs.
 */
export function getTeamUserIds(): number[] {
  const userIds =
    process.env.GITLAB_USER_IDS ||
    process.env.NEXT_PUBLIC_GITLAB_USER_IDS ||
    "";
  try {
    if (!userIds) return [];
    const parsedIds = userIds.split(":").map((id) => parseInt(id.trim(), 10));
    const validIds = parsedIds.filter((id) => !isNaN(id));
    if (validIds.length !== parsedIds.length) {
      logger.warn(
        "Some default user IDs were invalid and filtered out",
        {},
        "GitLabAPI"
      );
    }
    return validIds;
  } catch (error) {
    logger.error(
      "Error parsing default team user IDs",
      { error: error instanceof Error ? error.message : "Unknown error" },
      "GitLabAPI"
    );
    return [];
  }
}

/**
 * Get the full user objects for the default team.
 * @param skipCache Skip cache and fetch fresh data.
 * @returns Array of default team user objects.
 */
export async function getDefaultTeamUsers(
  skipCache: boolean = false
): Promise<GitLabUser[]> {
  const defaultIds = getTeamUserIds();
  if (defaultIds.length === 0) {
    logger.warn("No default team IDs configured.");
    return [];
  }
  return fetchUsersByIds(defaultIds, skipCache);
}

// --- Team Relevance Checks (Keep as is) ---
export function isTeamMember(
  user: GitLabUser,
  teamUsers: GitLabUser[]
): boolean {
  if (!user || !user.id || !teamUsers) return false;
  return teamUsers.some((teamMember) => teamMember.id === user.id);
}

export function isTeamRelevantMR(
  mr: GitLabMR,
  teamUsers: GitLabUser[]
): boolean {
  if (!mr || !teamUsers) return false;
  const isAuthorTeamMember = isTeamMember(mr.author, teamUsers);
  const hasTeamAssignee =
    mr.assignees?.some((assignee) => isTeamMember(assignee, teamUsers)) ||
    (mr.assignee && isTeamMember(mr.assignee, teamUsers));
  const hasTeamReviewer = mr.reviewers?.some((reviewer) =>
    isTeamMember(reviewer, teamUsers)
  );
  return isAuthorTeamMember || hasTeamAssignee || hasTeamReviewer;
}

// --- MR Fetching (fetchAllTeamMRs - Modified to accept teamUsers) ---
/**
 * Fetches all pages of merge requests relevant to the provided team from GitLab API.
 * Handles pagination internally and uses caching.
 * @param options - Options for the API call including groupId, state, etc.
 * @param teamUsers - The list of users defining the current team.
 * @returns Promise with all relevant merge requests across all pages.
 */
export async function fetchAllTeamMRs(
  options: FetchAllTeamMRsOptions,
  teamUsers: GitLabUser[] // Accept teamUsers directly
): Promise<{ items: GitLabMR[]; totalItems: number }> {
  const apiToken =
    process.env.GITLAB_API_TOKEN || process.env.NEXT_PUBLIC_GITLAB_API_TOKEN;
  if (!apiToken) {
    logger.error("GITLAB_API_TOKEN environment variable is not set");
    throw new Error("GITLAB_API_TOKEN environment variable is not set");
  }

  // Use the provided teamUsers list
  if (!teamUsers || teamUsers.length === 0) {
    logger.warn("No team users provided, returning empty MR list.");
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

  const per_page = 100;
  const baseCacheKeyParams = {
    state,
    per_page,
    include_subgroups: include_subgroups ? "true" : "false",
  };
  const baseEndpoint = `groups/${groupId}/merge_requests`;

  // Cache key for the *entire* dataset (raw, before team filtering)
  const fullDatasetCacheKey = gitlabApiCache.generateKey(
    `${baseEndpoint}-all-raw`, // Key for raw data
    baseCacheKeyParams
  );

  let allMRs: GitLabMR[] = [];

  // --- Cache Check for RAW data ---
  if (!skipCache) {
    const cachedRawData = gitlabApiCache.get(fullDatasetCacheKey);
    if (cachedRawData) {
      logger.info(
        "Using cached full RAW dataset for GitLab MRs",
        { groupId, state, include_subgroups, cacheKey: fullDatasetCacheKey },
        "GitLabAPI"
      );
      allMRs = cachedRawData.data as GitLabMR[];
    } else {
      logger.info(
        "Full RAW dataset cache miss, fetching page by page.",
        { cacheKey: fullDatasetCacheKey },
        "GitLabAPI"
      );
    }
  }

  // --- Fetching Logic (Only if raw data not cached) ---
  if (allMRs.length === 0) {
    let currentPage = 1;
    let totalPages = 1;
    let retries = 0;

    logger.info(
      "Starting fetch for all GitLab MR pages (Raw)",
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

      if (!skipCache) {
        const cachedPage = gitlabApiCache.get(pageCacheKey);
        if (cachedPage) {
          pageData = cachedPage.data;
          responseHeaders = cachedPage.headers;
          logger.debug(
            `Using cached raw page ${currentPage}/${totalPages}`,
            { cacheKey: pageCacheKey },
            "GitLabAPI"
          );
        }
      }

      if (!pageData) {
        try {
          logger.debug(
            `Fetching raw page ${currentPage}/${totalPages || "?"}`,
            { cacheKey: pageCacheKey },
            "GitLabAPI"
          );
          const response = await measurePerformance(
            `GitLab API Request Page ${currentPage}`,
            () =>
              gitlabRequest<GitLabMR[]>(
                `${GITLAB_API_BASE_URL}/${baseEndpoint}`,
                {
                  state,
                  page: currentPage,
                  per_page,
                  scope: "all",
                  include_subgroups,
                }
              )
          );
          pageData = response; // Assuming gitlabRequest returns the data array directly
          // We need headers if we want totalPages, but gitlabRequest doesn't return them.
          // For simplicity, we might have to fetch page 1 separately to get headers,
          // or just keep fetching until an empty page is returned.
          // Let's try the latter approach for now.

          if (!skipCache) {
            // Cache the raw page data
            gitlabApiCache.set(pageCacheKey, pageData || [], {});
          }
          retries = 0;
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

      if (pageData && pageData.length > 0) {
        allMRs.push(...pageData);
        // If we don't have totalPages, assume there might be more
        if (totalPages === 1 && pageData.length === per_page) {
          totalPages = currentPage + 1; // Guess there's at least one more page
        } else if (pageData.length < per_page) {
          totalPages = currentPage; // This must be the last page
        }
      } else {
        totalPages = currentPage - 1; // Empty page means we're done
      }
      currentPage++;
    }

    logger.info(
      "Finished fetching all GitLab MR pages (Raw)",
      { totalPagesFetched: currentPage - 1, rawMRsCount: allMRs.length },
      "GitLabAPI"
    );

    // Cache the full raw dataset if fetched
    if (!skipCache) {
      gitlabApiCache.set(fullDatasetCacheKey, allMRs, {});
    }
  }

  // --- Team Filtering ---
  const teamMRs = allMRs.filter((mr) => isTeamRelevantMR(mr, teamUsers));
  logger.info(
    "Filtered MRs for team relevance",
    { teamMRsCount: teamMRs.length },
    "GitLabAPI"
  );

  // Note: We are NOT caching the team-filtered result here, as the team can change.
  // The caching happens at the raw data level (pages and full raw dataset).

  return {
    items: teamMRs,
    totalItems: teamMRs.length,
  };
}

// --- Deprecated Functions (Keep as is) ---
/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchTooOldMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchTooOldMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}

/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchNotUpdatedMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchNotUpdatedMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}

/**
 * @deprecated Filtering logic moved to UnifiedDataService. Use fetchAllTeamMRs and filter there.
 */
export async function fetchPendingReviewMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  logger.warn("fetchPendingReviewMRs is deprecated", {}, "GitLabAPI");
  return { items: [], metadata: { currentPage: 1, perPage: 25 } };
}
