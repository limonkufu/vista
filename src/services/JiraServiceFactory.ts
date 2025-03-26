/**
 * Jira Service Factory
 *
 * This factory returns either the mock or real Jira service based on configuration.
 * It provides a consistent interface for working with Jira data regardless of
 * which implementation is being used.
 */

import { MockJiraService } from "./mockJira";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  JiraUser,
  GitLabMRWithJira,
} from "@/types/Jira";
import jiraClient from "@/lib/jira";

/**
 * Interface for Jira service implementations
 */
export interface JiraService {
  getTickets(options?: JiraQueryOptions): Promise<JiraTicket[]>;
  getTicket(key: string): Promise<JiraTicket | null>;
  mapMRsToTickets(mrs: unknown[]): Promise<unknown[]>;
  getMRsGroupedByTicket(mrs: unknown[]): Promise<JiraTicketWithMRs[]>;
  getUsers(): Promise<JiraUser[]>;
  getTicketsWithMRs(options?: JiraQueryOptions): Promise<JiraTicketWithMRs[]>;
  getMergeRequestsWithJira(options?: {
    skipCache?: boolean;
    projectId?: number;
    authorId?: number;
  }): Promise<GitLabMRWithJira[]>;
}

/**
 * Configuration options for the Jira service
 */
export interface JiraServiceConfig {
  // Whether to use mock data instead of real API
  useMock?: boolean;

  // API URL for real implementation
  apiUrl?: string;

  // Authentication token for real implementation
  authToken?: string;

  // Default JQL query for fetching tickets
  defaultJql?: string;
}

/**
 * Default configuration
 */
const defaultConfig: JiraServiceConfig = {
  useMock: false, // Default to real implementation
};

/**
 * Create a real Jira service using the jiraClient
 */
function createRealJiraService(config: JiraServiceConfig): JiraService {
  return {
    async getTickets(options?: JiraQueryOptions): Promise<JiraTicket[]> {
      return jiraClient.searchTickets(options?.search || "");
    },

    async getTicket(key: string): Promise<JiraTicket | null> {
      return jiraClient.getTicket(key);
    },

    async mapMRsToTickets(mrs: unknown[]): Promise<unknown[]> {
      // This is a placeholder implementation
      // The actual implementation should be handled by the MRService
      return mrs;
    },

    async getMRsGroupedByTicket(mrs: unknown[]): Promise<JiraTicketWithMRs[]> {
      // This is a placeholder implementation
      // The actual implementation should be handled by the MRService
      return [];
    },

    async getUsers(): Promise<JiraUser[]> {
      // This is a placeholder implementation
      // The actual implementation should be handled by the MRService
      return [];
    },

    async getTicketsWithMRs(
      options?: JiraQueryOptions
    ): Promise<JiraTicketWithMRs[]> {
      // This is a placeholder implementation
      // The actual implementation should be handled by the MRService
      return [];
    },

    async getMergeRequestsWithJira(options?: {
      skipCache?: boolean;
      projectId?: number;
      authorId?: number;
    }): Promise<GitLabMRWithJira[]> {
      // This is a placeholder implementation
      // The actual implementation should be handled by the MRService
      return [];
    },
  };
}

/**
 * Get the Jira service instance
 */
export function getJiraService(
  config?: Partial<JiraServiceConfig>
): JiraService {
  // Merge provided config with defaults
  const mergedConfig = { ...defaultConfig, ...config };

  // Use mock or real implementation based on config
  if (mergedConfig.useMock) {
    return MockJiraService;
  } else {
    return createRealJiraService(mergedConfig);
  }
}

/**
 * Get a shared instance of the Jira service
 */
export const jiraService = getJiraService();

/**
 * Factory class to provide consistent access to the Jira service
 * (for backward compatibility with import patterns in the codebase)
 */
export class JiraServiceFactory {
  /**
   * Get the Jira service instance
   */
  static getService(config?: Partial<JiraServiceConfig>): JiraService {
    if (config) {
      return getJiraService(config);
    }
    return jiraService;
  }
}
