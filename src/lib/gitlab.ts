import axios, { AxiosError } from 'axios';
import { logger, measurePerformance } from './logger';
import { gitlabApiCache } from './gitlabCache';

/**
 * GitLab API base URL
 */
const GITLAB_API_BASE_URL = 'https://gitlab.com/api/v4';

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
 * Interface for fetch options
 */
export interface FetchTeamMRsOptions {
  /** GitLab group ID */
  groupId: string;
  /** Page number for pagination */
  page?: number;
  /** Number of items per page */
  per_page?: number;
  /** State of merge requests */
  state?: "opened" | "closed" | "locked" | "merged" | "all";
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
  /** Threshold in days for filtering MRs */
  threshold?: number;
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
    threshold?: number;
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
  parentGroupPath: string = 'ska-telescope/ska-dev'
): Promise<{
  ids: number[];
  users: GitLabUser[];
}> {
  try {
    logger.info('Fetching user IDs by group name', { groupName, parentGroupPath }, 'GitLab API');
    
    // First, find the group ID by name
    const encodedParentPath = encodeURIComponent(parentGroupPath);
    const encodedGroupName = encodeURIComponent(groupName);
    const groupSearchUrl = `${GITLAB_API_BASE_URL}/groups/${encodedParentPath}/subgroups?search=${encodedGroupName}`;
    
    const groupResponse = await axios.get<GitLabGroup[]>(groupSearchUrl, {
      headers: {
        'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN || ''
      }
    });
    
    if (!groupResponse.data || groupResponse.data.length === 0) {
      logger.warn('No groups found with the given name', { groupName }, 'GitLab API');
      return { ids: [], users: [] };
    }
    
    // Filter groups that match the name case-insensitively
    const matchingGroups = groupResponse.data.filter(
      (group: GitLabGroup) => group.name.toLowerCase() === groupName.toLowerCase()
    );
    
    if (matchingGroups.length === 0) {
      logger.warn('No exact match found for group name', { groupName }, 'GitLab API');
      return { ids: [], users: [] };
    }
    
    const groupId = matchingGroups[0].id;
    
    // Now fetch members of the group
    const membersUrl = `${GITLAB_API_BASE_URL}/groups/${groupId}/members`;
    const membersResponse = await axios.get<GitLabMember[]>(membersUrl, {
      headers: {
        'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN || ''
      }
    });
    
    const users = membersResponse.data.map((member: GitLabMember) => ({
      id: member.id,
      name: member.name,
      username: member.username,
      avatar_url: member.avatar_url,
      web_url: member.web_url
    }));
    
    const ids = users.map((user: GitLabUser) => user.id);
    
    logger.info('Successfully fetched user IDs by group name', 
      { groupName, userCount: users.length }, 
      'GitLab API'
    );
    
    return { ids, users };
  } catch (error) {
    const errorMessage = error instanceof AxiosError 
      ? error.response?.data?.message || error.message
      : 'Unknown error';
    
    logger.error('Error fetching user IDs by group name', 
      { groupName, error: errorMessage }, 
      'GitLab API'
    );
    
    throw new Error(`Failed to fetch user IDs by group name: ${errorMessage}`);
  }
}

/**
 * Get GitLab user IDs for the team
 * @returns Array of user IDs
 */
export function getTeamUserIds(): number[] {
  const userIds = process.env.GITLAB_USER_IDS || "";

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
 * Fetches merge requests for team members from GitLab API with caching
 * @param options - Options for the API call including groupId, pagination, and state
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchTeamMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  const apiToken = process.env.GITLAB_API_TOKEN;

  if (!apiToken) {
    logger.error("GITLAB_API_TOKEN environment variable is not set");
    throw new Error("GITLAB_API_TOKEN environment variable is not set");
  }

  const teamUserIds = getTeamUserIds();
  if (teamUserIds.length === 0) {
    logger.error(
      "GITLAB_USER_IDS environment variable is not set or is invalid"
    );
    throw new Error(
      "GITLAB_USER_IDS environment variable is not set or is invalid"
    );
  }

  const {
    groupId = process.env.GITLAB_GROUP_ID,
    page = 1,
    per_page = 100,
    state = "opened", // Default to only open MRs
    maxRetries = 3,
    include_subgroups = true,
    skipCache = false, // New parameter to allow skipping cache
  } = options;

  if (!groupId) {
    logger.error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
    throw new Error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
  }

  // Generate cache key based on options
  const cacheKey = gitlabApiCache.generateKey(`groups/${groupId}/merge_requests`, {
    state,
    page,
    per_page,
    include_subgroups: include_subgroups ? 'true' : 'false',
  });

  // Try to get from cache if not explicitly skipping
  if (!skipCache) {
    const cachedResponse = gitlabApiCache.get(cacheKey);
    if (cachedResponse) {
      logger.info(
        "Using cached GitLab API response",
        { groupId, page, per_page, cacheKey },
        "GitLabAPI"
      );
      
      // Process cached data
      const teamMRs = cachedResponse.data.filter(isTeamRelevantMR);
      
      // Parse pagination info from cached headers
      const headers = cachedResponse.headers;
      const totalItems = parseInt(String(headers["x-total"] || "0"), 10);
      const totalPages = parseInt(String(headers["x-total-pages"] || "0"), 10);
      const nextPage = parseInt(String(headers["x-next-page"] || "0"), 10) || undefined;
      const prevPage = parseInt(String(headers["x-prev-page"] || "0"), 10) || undefined;
      
      return {
        items: teamMRs,
        metadata: {
          totalItems,
          totalPages,
          currentPage: page,
          perPage: per_page,
          nextPage,
          prevPage,
          lastRefreshed: new Date().toISOString(),
        },
      };
    }
  }

  let retries = 0;

  // Retry logic for API calls
  const fetchWithRetry = async (): Promise<GitLabMRsResponse> => {
    try {
      logger.info(
        "Fetching GitLab MRs (cache miss or skipped)",
        { groupId, page, per_page, state, include_subgroups, skipCache },
        "GitLabAPI"
      );

      const response = await measurePerformance("GitLab API Request", () =>
        axios.get(`${GITLAB_API_BASE_URL}/groups/${groupId}/merge_requests`, {
          headers: {
            "PRIVATE-TOKEN": apiToken,
          },
          params: {
            state,
            page,
            per_page,
            scope: "all",
            include_subgroups,
          },
        })
      );

      // Store response in cache (only if not skipping cache)
      if (!skipCache) {
        // Extract important headers for caching
        const headersToCache: Record<string, string> = {
          "x-total": String(response.headers["x-total"] || "0"),
          "x-total-pages": String(response.headers["x-total-pages"] || "0"),
          "x-next-page": String(response.headers["x-next-page"] || "0"),
          "x-prev-page": String(response.headers["x-prev-page"] || "0"),
          link: String(response.headers.link || response.headers.Link || ""),
        };
        
        gitlabApiCache.set(cacheKey, response.data, headersToCache);
      }

      const headers = response.headers;
      const totalItems = parseInt(headers["x-total"] || "0", 10);
      const totalPages = parseInt(headers["x-total-pages"] || "0", 10);
      const nextPage = parseInt(headers["x-next-page"] || "0", 10) || undefined;
      const prevPage = parseInt(headers["x-prev-page"] || "0", 10) || undefined;

      // Parse Link header for more reliable pagination
      const linkHeader = headers.link || headers.Link;
      const parsedLinks: Record<string, number> = {};

      if (linkHeader && typeof linkHeader === "string") {
        // Extract page numbers from the Link header
        const linkMatches = linkHeader.match(
          /<[^>]+\?page=(\d+)[^>]*>;\s*rel="([^"]+)"/g
        );
        if (linkMatches) {
          linkMatches.forEach((link) => {
            const match = link.match(
              /<[^>]+\?page=(\d+)[^>]*>;\s*rel="([^"]+)"/
            );
            if (match && match[1] && match[2]) {
              parsedLinks[match[2]] = parseInt(match[1], 10);
            }
          });
        }
      }

      // Filter merge requests that are relevant to team members
      const allMRs = response.data;
      logger.debug(
        "Received MRs from GitLab",
        {
          total: allMRs.length,
          page,
          totalPages,
          links: parsedLinks,
        },
        "GitLabAPI"
      );

      const teamMRs = await measurePerformance("Filter Team MRs", async () =>
        allMRs.filter(isTeamRelevantMR)
      );

      logger.info(
        "Filtered team MRs",
        {
          total: teamMRs.length,
          filtered: allMRs.length - teamMRs.length,
        },
        "GitLabAPI"
      );

      return {
        items: teamMRs,
        metadata: {
          totalItems,
          totalPages,
          currentPage: page,
          perPage: per_page,
          nextPage: parsedLinks.next || nextPage,
          prevPage: parsedLinks.prev || prevPage,
          lastRefreshed: new Date().toISOString(),
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Log the error with appropriate context
      logger.error(
        "GitLab API error",
        {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          retry: retries + 1,
          maxRetries,
          message: axiosError.message,
        },
        "GitLabAPI"
      );

      // Retry if we haven't exceeded max retries
      if (retries < maxRetries) {
        retries++;
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        logger.info(
          `Retrying in ${delay}ms (${retries}/${maxRetries})`,
          {},
          "GitLabAPI"
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry();
      }

      throw error;
    }
  };

  return fetchWithRetry();
}

/**
 * Fetches merge requests from the default group ID
 * @param options - Options for the API call excluding groupId
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchDefaultTeamMRs(
  options: Omit<FetchTeamMRsOptions, "groupId"> = {}
): Promise<GitLabMRsResponse> {
  const defaultGroupId = process.env.GITLAB_GROUP_ID;
  if (!defaultGroupId) {
    throw new Error("GITLAB_GROUP_ID environment variable is not set");
  }
  return fetchTeamMRs({
    groupId: defaultGroupId,
    state: "opened", // Default to only open MRs
    ...options,
  });
}

/**
 * Fetches merge requests that are too old (created more than X days ago)
 * @param options - Options for the API call including threshold in days
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchTooOldMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  const {
    threshold = 28,
    page = 1,
    per_page = 25,
    include_subgroups = true, // Default to include subgroups
    ...fetchOptions
  } = options;

  try {
    // Define the threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - threshold);

    // Fetch all MRs across all pages from GitLab
    const allMRsResponse = await fetchAllGitLabMRs({
      ...fetchOptions,
      state: options.state || "opened", // Default to only open MRs
      include_subgroups, // Explicitly pass include_subgroups parameter
    });

    // Filter MRs that were created before the threshold date
    const filteredMRs = allMRsResponse.items.filter((mr) => {
      const createdDate = new Date(mr.created_at);
      return createdDate < thresholdDate;
    });

    logger.info(
      "Filtered too old MRs",
      {
        totalFiltered: filteredMRs.length,
        totalItems: allMRsResponse.items.length,
        threshold,
      },
      "GitLabAPI"
    );

    // Calculate pagination
    const totalItems = filteredMRs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / per_page));
    const nextPage = page < totalPages ? page + 1 : undefined;
    const prevPage = page > 1 ? page - 1 : undefined;

    // Apply pagination to the filtered results
    const startIdx = (page - 1) * per_page;
    const endIdx = Math.min(startIdx + per_page, filteredMRs.length);
    const paginatedMRs = filteredMRs.slice(startIdx, endIdx);

    return {
      items: paginatedMRs,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: per_page,
        nextPage,
        prevPage,
        threshold,
        lastRefreshed: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Error in fetchTooOldMRs", { error }, "GitLabAPI");
    throw error;
  }
}

/**
 * Fetches merge requests that haven't been updated in X days
 * @param options - Options for the API call including threshold in days
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchNotUpdatedMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  const {
    threshold = 14,
    page = 1,
    per_page = 25,
    include_subgroups = true, // Default to include subgroups
    ...fetchOptions
  } = options;

  try {
    // Define the threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - threshold);

    // Fetch all MRs across all pages from GitLab
    const allMRsResponse = await fetchAllGitLabMRs({
      ...fetchOptions,
      state: options.state || "opened", // Default to only open MRs
      include_subgroups, // Explicitly pass include_subgroups parameter
    });

    // Filter MRs that haven't been updated in X days
    const filteredMRs = allMRsResponse.items.filter((mr) => {
      const updatedDate = new Date(mr.updated_at);
      return updatedDate < thresholdDate;
    });

    logger.info(
      "Filtered not updated MRs",
      {
        totalFiltered: filteredMRs.length,
        totalItems: allMRsResponse.items.length,
        threshold,
      },
      "GitLabAPI"
    );

    // Calculate pagination
    const totalItems = filteredMRs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / per_page));
    const nextPage = page < totalPages ? page + 1 : undefined;
    const prevPage = page > 1 ? page - 1 : undefined;

    // Apply pagination to the filtered results
    const startIdx = (page - 1) * per_page;
    const endIdx = Math.min(startIdx + per_page, filteredMRs.length);
    const paginatedMRs = filteredMRs.slice(startIdx, endIdx);

    return {
      items: paginatedMRs,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: per_page,
        nextPage,
        prevPage,
        threshold,
        lastRefreshed: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Error in fetchNotUpdatedMRs", { error }, "GitLabAPI");
    throw error;
  }
}

/**
 * Fetches merge requests where team members are reviewers and haven't been updated in X days
 * @param options - Options for the API call including threshold in days
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchPendingReviewMRs(
  options: FetchTeamMRsOptions
): Promise<GitLabMRsResponse> {
  const {
    threshold = 7,
    page = 1,
    per_page = 25,
    include_subgroups = true, // Default to include subgroups
    ...fetchOptions
  } = options;

  try {
    // Define the threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - threshold);

    const teamUserIds = getTeamUserIds();

    // Fetch all MRs across all pages from GitLab
    const allMRsResponse = await fetchAllGitLabMRs({
      ...fetchOptions,
      state: options.state || "opened", // Default to only open MRs
      include_subgroups, // Explicitly pass include_subgroups parameter
    });

    // Filter MRs where team members are reviewers and that haven't been updated in X days
    const filteredMRs = allMRsResponse.items.filter((mr) => {
      // Check if any reviewer is a team member
      const isTeamReviewer = mr.reviewers.some((reviewer) =>
        teamUserIds.includes(reviewer.id)
      );

      // Check if the MR hasn't been updated in X days
      const updatedDate = new Date(mr.updated_at);
      const isOldUpdate = updatedDate < thresholdDate;

      return isTeamReviewer && isOldUpdate;
    });

    logger.info(
      "Filtered pending review MRs",
      {
        totalFiltered: filteredMRs.length,
        totalItems: allMRsResponse.items.length,
        threshold,
      },
      "GitLabAPI"
    );

    // Calculate pagination
    const totalItems = filteredMRs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / per_page));
    const nextPage = page < totalPages ? page + 1 : undefined;
    const prevPage = page > 1 ? page - 1 : undefined;

    // Apply pagination to the filtered results
    const startIdx = (page - 1) * per_page;
    const endIdx = Math.min(startIdx + per_page, filteredMRs.length);
    const paginatedMRs = filteredMRs.slice(startIdx, endIdx);

    return {
      items: paginatedMRs,
      metadata: {
        totalItems,
        totalPages,
        currentPage: page,
        perPage: per_page,
        nextPage,
        prevPage,
        threshold,
        lastRefreshed: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Error in fetchPendingReviewMRs", { error }, "GitLabAPI");
    throw error;
  }
}

/**
 * Fetches all pages of merge requests from GitLab API with improved caching
 * @param options - Base options for fetching
 * @returns Promise with all merge requests across all pages
 */
async function fetchAllGitLabMRs(
  options: FetchTeamMRsOptions
): Promise<{ items: GitLabMR[]; totalItems: number; totalPages: number }> {
  const {
    groupId = process.env.GITLAB_GROUP_ID,
    state = "opened", // Default to only open MRs
    include_subgroups = true, // Default to true to include subgroups
    skipCache = false, // Add option to skip cache
  } = options;

  // Always use maximum per_page to minimize number of requests
  const per_page = 100;

  logger.info(
    "Fetching all GitLab MRs",
    {
      groupId,
      state,
      include_subgroups,
      skipCache,
    },
    "GitLabAPI"
  );

  // Check if we have a complete set of data in cache already
  let cachedItemsByPage: Map<number, GitLabMR[]> | null = null;
  let totalItemsFromCache = 0;
  let totalPagesFromCache = 0;
  
  // Only attempt to use cache if not explicitly skipping
  if (!skipCache) {
    cachedItemsByPage = new Map();
    
    // Try to determine the total pages from the cache first
    // We'll look for any cached page to get the total info
    // Try page 1 first as it's most likely to be cached
    const page1CacheKey = gitlabApiCache.generateKey(`groups/${groupId}/merge_requests`, {
      state,
      page: 1,
      per_page,
      include_subgroups: include_subgroups ? 'true' : 'false',
    });
    
    const page1Cache = gitlabApiCache.get(page1CacheKey);
    
    if (page1Cache) {
      totalItemsFromCache = parseInt(String(page1Cache.headers["x-total"] || "0"), 10);
      totalPagesFromCache = parseInt(String(page1Cache.headers["x-total-pages"] || "0"), 10);
      
      // If we have the total pages info, try to get all cached pages
      if (totalPagesFromCache > 0) {
        let hasAllCachedPages = true;
        
        for (let page = 1; page <= totalPagesFromCache; page++) {
          const pageCacheKey = gitlabApiCache.generateKey(`groups/${groupId}/merge_requests`, {
            state,
            page,
            per_page,
            include_subgroups: include_subgroups ? 'true' : 'false',
          });
          
          const pageCache = gitlabApiCache.get(pageCacheKey);
          
          if (pageCache) {
            cachedItemsByPage.set(page, pageCache.data);
          } else {
            hasAllCachedPages = false;
            break;
          }
        }
        
        // If we have all the pages in cache, we can return early
        if (hasAllCachedPages) {
          logger.info(
            "Found all GitLab MR pages in cache",
            {
              totalPages: totalPagesFromCache,
              totalItems: totalItemsFromCache,
            },
            "GitLabAPI"
          );
          
          // Combine all items from all pages
          let allItems: GitLabMR[] = [];
          for (let page = 1; page <= totalPagesFromCache; page++) {
            const pageItems = cachedItemsByPage.get(page) || [];
            allItems = allItems.concat(pageItems);
          }
          
          // Filter for team-relevant MRs
          const teamMRs = allItems.filter(isTeamRelevantMR);
          
          return {
            items: teamMRs,
            totalItems: totalItemsFromCache,
            totalPages: totalPagesFromCache,
          };
        }
      }
    }
  }

  // If we can't use the cache completely, fetch the first page to get pagination info
  const firstPageResponse = await fetchTeamMRs({
    ...options,
    page: 1,
    per_page,
    state, // Ensure consistent state parameter
    include_subgroups, // Explicitly set include_subgroups
    skipCache, // Pass the skip cache option
  });

  // If only one page exists or no items, return early
  if (
    !firstPageResponse.metadata.totalPages ||
    firstPageResponse.metadata.totalPages <= 1
  ) {
    return {
      items: firstPageResponse.items,
      totalItems:
        firstPageResponse.metadata.totalItems || firstPageResponse.items.length,
      totalPages: firstPageResponse.metadata.totalPages || 1,
    };
  }

  // Prepare for fetching all pages
  const allItems = [...firstPageResponse.items];
  const totalPages = firstPageResponse.metadata.totalPages;

  // Fetch all remaining pages, using cache where possible
  const pagesToFetch: number[] = [];
  for (let page = 2; page <= totalPages; page++) {
    // If we have this page in our cache map, use it
    if (cachedItemsByPage?.has(page)) {
      const pageItems = cachedItemsByPage.get(page) || [];
      allItems.push(...pageItems.filter(isTeamRelevantMR));
    } else {
      // Otherwise, mark for fetching
      pagesToFetch.push(page);
    }
  }

  // Now fetch all the pages we couldn't get from cache
  if (pagesToFetch.length > 0) {
    logger.info(
      "Fetching remaining GitLab MR pages",
      {
        cachedPages: totalPages - pagesToFetch.length,
        pagesToFetch: pagesToFetch.length,
      },
      "GitLabAPI"
    );

    // Use Promise.all to fetch remaining pages in parallel
    const pagePromises = pagesToFetch.map(page => 
      fetchTeamMRs({
        ...options,
        page,
        per_page,
        state,
        include_subgroups,
        skipCache,
      })
    );

    const pageResponses = await Promise.all(pagePromises);
    
    // Add all items from fetched pages
    for (const pageResponse of pageResponses) {
      allItems.push(...pageResponse.items);
    }
  }

  logger.info(
    "Fetched all GitLab MRs",
    {
      totalPages,
      totalItems: allItems.length,
      cachedPages: totalPages - pagesToFetch.length,
      fetchedPages: pagesToFetch.length,
    },
    "GitLabAPI"
  );

  return {
    items: allItems,
    totalItems: firstPageResponse.metadata.totalItems || allItems.length,
    totalPages,
  };
}