import axios, { AxiosError } from 'axios';
import { logger, measurePerformance } from './logger';

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
 * Gets the user IDs from environment variables
 * @returns Array of user IDs
 */
export function getTeamUserIds(): number[] {
  return (
    process.env.GITLAB_USER_IDS?.split(":")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id)) || []
  );
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
 * Fetches merge requests for team members from GitLab API
 * @param options - Options for the API call including groupId, pagination, and state
 * @returns Promise with GitLab MRs and pagination metadata
 *
 * By default, this function will include merge requests from subgroups.
 * Set options.include_subgroups = false to disable this behavior.
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
    state = "all",
    maxRetries = 3,
    include_subgroups = true,
  } = options;

  if (!groupId) {
    logger.error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
    throw new Error(
      "groupId is not provided and GITLAB_GROUP_ID environment variable is not set"
    );
  }

  let retries = 0;

  // Retry logic for API calls
  const fetchWithRetry = async (): Promise<GitLabMRsResponse> => {
    try {
      logger.info(
        "Fetching GitLab MRs",
        { groupId, page, per_page, state, include_subgroups },
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

      const headers = response.headers;
      const totalItems = parseInt(headers["x-total"] || "0", 10);
      const totalPages = parseInt(headers["x-total-pages"] || "0", 10);
      const nextPage = parseInt(headers["x-next-page"] || "0", 10) || undefined;
      const prevPage = parseInt(headers["x-prev-page"] || "0", 10) || undefined;

      // Filter merge requests that are relevant to team members
      const allMRs = response.data;
      logger.debug(
        "Received MRs from GitLab",
        {
          total: allMRs.length,
          page,
          totalPages,
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
          nextPage,
          prevPage,
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
  return fetchTeamMRs({ groupId: defaultGroupId, ...options });
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
      state: options.state || "all",
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
      state: options.state || "all",
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
      state: options.state || "all",
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
 * Fetches all pages of merge requests from GitLab API
 * @param options - Base options for fetching
 * @returns Promise with all merge requests across all pages
 */
async function fetchAllGitLabMRs(
  options: FetchTeamMRsOptions
): Promise<{ items: GitLabMR[]; totalItems: number; totalPages: number }> {
  const {
    groupId = process.env.GITLAB_GROUP_ID,
    state = "all",
    include_subgroups = true, // Default to true to include subgroups
  } = options;

  // Always use maximum per_page to minimize number of requests
  const per_page = 100;

  logger.info(
    "Fetching all GitLab MRs",
    {
      groupId,
      state,
      include_subgroups,
    },
    "GitLabAPI"
  );

  // Fetch first page to get pagination info
  const firstPageResponse = await fetchTeamMRs({
    ...options,
    page: 1,
    per_page,
    include_subgroups, // Explicitly set include_subgroups
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

  // Prepare requests for all other pages
  const totalPages = firstPageResponse.metadata.totalPages;
  const pagePromises = [];

  // Start from page 2 since we already have page 1
  for (let page = 2; page <= totalPages; page++) {
    pagePromises.push(
      fetchTeamMRs({
        ...options,
        page,
        per_page,
        include_subgroups, // Explicitly set include_subgroups
      })
    );
  }

  // Execute all requests in parallel
  const pageResponses = await Promise.all(pagePromises);

  // Combine all items
  const allItems = [
    ...firstPageResponse.items,
    ...pageResponses.flatMap((response) => response.items),
  ];

  logger.info(
    "Fetched all GitLab MRs",
    {
      totalPages,
      totalItems: allItems.length,
    },
    "GitLabAPI"
  );

  return {
    items: allItems,
    totalItems: firstPageResponse.metadata.totalItems || allItems.length,
    totalPages,
  };
} 