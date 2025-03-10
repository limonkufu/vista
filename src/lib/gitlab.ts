import axios, { AxiosError } from 'axios';

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
  state: 'opened' | 'closed' | 'locked' | 'merged';
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
  state?: 'opened' | 'closed' | 'locked' | 'merged' | 'all';
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
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
  };
}

/**
 * Gets the user IDs from environment variables
 * @returns Array of user IDs
 */
export function getTeamUserIds(): number[] {
  return process.env.GITLAB_USER_IDS?.split(':')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id)) || [];
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
  const hasTeamAssignee = mr.assignees?.some(isTeamMember) || 
                         (mr.assignee && isTeamMember(mr.assignee));
  
  // Check if any reviewer is a team member
  const hasTeamReviewer = mr.reviewers?.some(isTeamMember);
  
  return isAuthorTeamMember || hasTeamAssignee || hasTeamReviewer;
}

/**
 * Fetches merge requests for team members from GitLab API
 * @param options - Options for the API call including groupId, pagination, and state
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchTeamMRs(options: FetchTeamMRsOptions): Promise<GitLabMRsResponse> {
  const apiToken = process.env.GITLAB_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('GITLAB_API_TOKEN environment variable is not set');
  }
  
  const teamUserIds = getTeamUserIds();
  if (teamUserIds.length === 0) {
    throw new Error('GITLAB_USER_IDS environment variable is not set or is invalid');
  }
  
  const { 
    groupId, 
    page = 1, 
    per_page = 100, 
    state = 'all',
    maxRetries = 3 
  } = options;
  
  let retries = 0;
  
  // Retry logic for API calls
  const fetchWithRetry = async (): Promise<GitLabMRsResponse> => {
    try {
      const response = await axios.get(
        `${GITLAB_API_BASE_URL}/groups/${groupId}/merge_requests`, {
          headers: {
            'PRIVATE-TOKEN': apiToken
          },
          params: {
            state,
            page,
            per_page,
            scope: 'all'
          }
        });
      
      const headers = response.headers;
      const totalItems = parseInt(headers['x-total'] || '0', 10);
      const totalPages = parseInt(headers['x-total-pages'] || '0', 10);
      const nextPage = parseInt(headers['x-next-page'] || '0', 10) || undefined;
      const prevPage = parseInt(headers['x-prev-page'] || '0', 10) || undefined;
      
      // Filter merge requests that are relevant to team members
      const teamMRs = response.data.filter(isTeamRelevantMR);
      
      return {
        items: teamMRs,
        metadata: {
          totalItems,
          totalPages,
          currentPage: page,
          perPage: per_page,
          nextPage,
          prevPage
        }
      };
    } catch (error) {
      // Handle retry logic for certain errors
      if (retries < maxRetries) {
        retries++;
        
        const axiosError = error as AxiosError;
        
        // Only retry on 5xx errors or network errors
        if (!axiosError.response || (axiosError.response.status >= 500 && axiosError.response.status < 600)) {
          // Exponential backoff
          const delay = Math.pow(2, retries) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry();
        }
      }
      
      // Re-throw the error after max retries or for non-retryable errors
      throw error;
    }
  };
  
  return fetchWithRetry();
}

/**
 * Default group ID for the SKA Observatory project
 */
export const DEFAULT_GROUP_ID = '3180705'; // Example from the spec

/**
 * Export a convenience function with the default group ID
 * @param options - Optional overrides for pagination and state
 * @returns Promise with GitLab MRs and pagination metadata
 */
export async function fetchDefaultTeamMRs(options: Omit<FetchTeamMRsOptions, 'groupId'> = {}): Promise<GitLabMRsResponse> {
  return fetchTeamMRs({ groupId: DEFAULT_GROUP_ID, ...options });
} 