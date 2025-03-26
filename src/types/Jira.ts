/**
 * Jira data types for GitLab MR Dashboard
 */

/**
 * Jira ticket status
 */
export enum JiraTicketStatus {
  TO_DO = 'To Do',
  IN_PROGRESS = 'In Progress',
  IN_REVIEW = 'In Review',
  DONE = 'Done',
  BLOCKED = 'Blocked',
}

/**
 * Jira ticket priority
 */
export enum JiraTicketPriority {
  HIGHEST = 'Highest',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
  LOWEST = 'Lowest',
}

/**
 * Jira ticket type
 */
export enum JiraTicketType {
  BUG = 'Bug',
  STORY = 'Story',
  TASK = 'Task',
  EPIC = 'Epic',
  SUBTASK = 'Sub-task',
}

/**
 * Jira user information
 */
export interface JiraUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Jira ticket interface
 */
export interface JiraTicket {
  // Basic ticket information
  id: string;
  key: string;
  title: string;
  description?: string;
  url: string;
  
  // Status information
  status: JiraTicketStatus;
  priority: JiraTicketPriority;
  type: JiraTicketType;
  
  // Dates
  created: string;
  updated: string;
  dueDate?: string;
  
  // People
  assignee?: JiraUser;
  reporter?: JiraUser;
  
  // Additional metadata
  labels?: string[];
  epicKey?: string;
  epicName?: string;
  storyPoints?: number;
  sprintName?: string;
}

/**
 * Interface for GitLab MR with associated Jira ticket
 * This extends the existing GitLabMR type from the current application
 */
export interface GitLabMRWithJira {
  // Basic GitLab MR fields
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string;
  state: string;
  created_at: string;
  updated_at: string;
  web_url: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
  
  // Additional GitLab MR fields needed by DevView
  source_branch: string;
  target_branch: string;
  merge_status: string;
  user_notes_count: number;
  upvotes: number;
  downvotes: number;
  reviewers: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
  }[];
  
  // Jira-specific fields
  jiraTicket?: JiraTicket;
  jiraTicketKey?: string; // If we have the key but not full ticket data
}

/**
 * Jira ticket with associated GitLab MRs
 */
export interface JiraTicketWithMRs {
  ticket: JiraTicket;
  mrs: GitLabMRWithJira[];
  
  // Optional metrics for the Team View (making these optional)
  totalMRs?: number;
  openMRs?: number;
  overdueMRs?: number;
  stalledMRs?: number;
}

/**
 * Type for Jira queries and filtering
 */
export interface JiraQueryOptions {
  statuses?: JiraTicketStatus[];
  types?: JiraTicketType[];
  priorities?: JiraTicketPriority[];
  assignees?: string[];
  sprintName?: string;
  epicKey?: string;
  search?: string;
  labels?: string[];
  skipCache?: boolean;
}

/**
 * Extract a Jira ticket key from text
 * (e.g., "PROJECT-123" from "Fix bug [PROJECT-123]")
 */
export function extractJiraKeyFromText(text: string): string | null {
  // Common Jira ticket key pattern: PROJECT-123
  const jiraKeyRegex = /([A-Z][A-Z0-9_]+-[0-9]+)/g;
  const matches = text.match(jiraKeyRegex);
  
  return matches && matches.length > 0 ? matches[0] : null;
} 