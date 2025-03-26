// File: src/lib/gitlab.ts
import axios, { AxiosError } from "axios";
import { logger, measurePerformance } from "./logger";
import { gitlabApiCache } from "./gitlabCache";

// --- Constants ---
const GITLAB_API_BASE_URL = "https://gitlab.com/api/v4";
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
      params: { per_page: 100, ...params },
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

export async function fetchAllTeamMRs(
  options: FetchAllTeamMRsOptions,
  teamUsers: GitLabUser[]
): Promise<{ items: GitLabMR[]; totalItems: number }> {
  const apiToken =
    process.env.GITLAB_API_TOKEN || process.env.NEXT_PUBLIC_GITLAB_API_TOKEN;
  if (!apiToken) {
    logger.error("GITLAB_API_TOKEN environment variable is not set");
    throw new Error("GITLAB_API_TOKEN environment variable is not set");
  }

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

  const fullDatasetCacheKey = gitlabApiCache.generateKey(
    `${baseEndpoint}-all-raw`,
    baseCacheKeyParams
  );

  let allMRs: GitLabMR[] = [];

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

      if (!skipCache) {
        const cachedPage = gitlabApiCache.get(pageCacheKey);
        if (cachedPage) {
          pageData = cachedPage.data as GitLabMR[];
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
          const responseData = await measurePerformance(
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
          pageData = responseData;

          if (!skipCache) {
            gitlabApiCache.set(pageCacheKey, pageData || [], {});
          }
          retries = 0;
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
            continue;
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
        if (pageData.length === per_page) {
          if (totalPages === currentPage) totalPages++;
        } else {
          totalPages = currentPage;
        }
      } else {
        totalPages = currentPage - 1;
      }
      currentPage++;
    }

    logger.info(
      "Finished fetching all GitLab MR pages (Raw)",
      { totalPagesFetched: currentPage - 1, rawMRsCount: allMRs.length },
      "GitLabAPI"
    );

    if (!skipCache) {
      gitlabApiCache.set(fullDatasetCacheKey, allMRs, {});
    }
  }

  const teamMRs = allMRs.filter((mr) => isTeamRelevantMR(mr, teamUsers));
  logger.info(
    "Filtered MRs for team relevance",
    { teamMRsCount: teamMRs.length },
    "GitLabAPI"
  );

  return {
    items: teamMRs,
    totalItems: teamMRs.length,
  };
}

// --- Deprecated Functions ---
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
