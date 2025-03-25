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
} from "@/types/Jira";

/**
 * Interface for Jira service implementations
 */
export interface JiraService {
  getTickets(options?: JiraQueryOptions): Promise<JiraTicket[]>;
  getTicket(key: string): Promise<JiraTicket | null>;
  mapMRsToTickets(mrs: any[]): Promise<any[]>;
  getMRsGroupedByTicket(mrs: any[]): Promise<JiraTicketWithMRs[]>;
  getUsers(): Promise<JiraUser[]>;
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
  useMock: true, // Default to mock implementation for now
};

/**
 * Create a real Jira service (to be implemented in the future)
 */
function createRealJiraService(config: JiraServiceConfig): JiraService {
  // This will be implemented when we're ready to connect to real Jira
  // For now, we'll just throw an error if someone tries to use it
  throw new Error("Real Jira service not yet implemented");
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
