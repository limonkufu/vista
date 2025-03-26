import JiraApi from "jira-client";
import { logger } from "./logger";
import {
  JiraTicket,
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
} from "../types/Jira";

/**
 * Jira API response types
 */
interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?:
      | string
      | { type: string; content: Array<Record<string, unknown>> };
    status: {
      name: string;
    };
    priority: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    created: string;
    updated: string;
    duedate?: string;
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
      avatarUrls: {
        "48x48": string;
      };
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
      avatarUrls: {
        "48x48": string;
      };
    };
    labels: string[];
    [key: string]: unknown; // For custom fields
  };
}

/**
 * Jira API configuration
 */
interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  maxRetries?: number;
  rateLimitDelay?: number;
}

/**
 * Jira client for interacting with the Jira API
 */
class JiraClient {
  private client: JiraApi;
  private maxRetries: number;
  private rateLimitDelay: number;

  constructor(config: JiraConfig) {
    logger.info("Jira Client initialized with configuration:", {
      host: config.host,
      email: config.email,
      apiToken: "***",
      maxRetries: config.maxRetries,
      rateLimitDelay: config.rateLimitDelay,
    });

    this.client = new JiraApi({
      protocol: "https",
      host: config.host,
      username: config.email,
      password: config.apiToken,
      apiVersion: "3",
      strictSSL: true,
    });
    this.maxRetries = config.maxRetries || 3;
    this.rateLimitDelay = config.rateLimitDelay || 1000;
  }

  /**
   * Map Jira API issue to our JiraTicket type
   */
  private mapJiraIssueToTicket(issue: JiraIssue): JiraTicket {
    // Get custom field IDs from environment variables or configuration
    const epicLinkField =
      process.env.JIRA_EPIC_LINK_FIELD || "customfield_10014";
    const epicNameField =
      process.env.JIRA_EPIC_NAME_FIELD || "customfield_10015";
    const storyPointsField =
      process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016";
    const sprintField = process.env.JIRA_SPRINT_FIELD || "customfield_10017";

    // Convert description to string if it's a Document type
    const description =
      typeof issue.fields.description === "string"
        ? issue.fields.description
        : issue.fields.description
        ? JSON.stringify(issue.fields.description)
        : undefined;

    return {
      id: issue.id,
      key: issue.key,
      title: issue.fields.summary,
      description,
      url: `${process.env.JIRA_HOST}/browse/${issue.key}`,
      status: issue.fields.status.name as JiraTicketStatus,
      priority: issue.fields.priority.name as JiraTicketPriority,
      type: issue.fields.issuetype.name as JiraTicketType,
      created: issue.fields.created,
      updated: issue.fields.updated,
      dueDate: issue.fields.duedate,
      assignee: issue.fields.assignee
        ? {
            id: issue.fields.assignee.accountId,
            name: issue.fields.assignee.displayName,
            email: issue.fields.assignee.emailAddress,
            avatarUrl: issue.fields.assignee.avatarUrls["48x48"],
          }
        : undefined,
      reporter: issue.fields.reporter
        ? {
            id: issue.fields.reporter.accountId,
            name: issue.fields.reporter.displayName,
            email: issue.fields.reporter.emailAddress,
            avatarUrl: issue.fields.reporter.avatarUrls["48x48"],
          }
        : undefined,
      labels: issue.fields.labels,
      epicKey: issue.fields[epicLinkField] as string | undefined,
      epicName: issue.fields[epicNameField] as string | undefined,
      storyPoints: issue.fields[storyPointsField] as number | undefined,
      sprintName: (issue.fields[sprintField] as Array<{ name: string }>)?.[0]
        ?.name,
    };
  }

  /**
   * Search for Jira tickets using JQL
   */
  async searchTickets(jql: string): Promise<JiraTicket[]> {
    try {
      const response = await this.client.searchJira(jql, {
        maxResults: 100,
      });

      if (!response.issues) {
        return [];
      }

      return response.issues.map((issue: JiraIssue) =>
        this.mapJiraIssueToTicket(issue)
      );
    } catch (error) {
      logger.error("Failed to search Jira tickets:", error);
      return [];
    }
  }

  /**
   * Get a specific Jira ticket by key
   */
  async getTicket(key: string): Promise<JiraTicket | null> {
    try {
      const issue = await this.client.findIssue(key);
      return this.mapJiraIssueToTicket(issue as unknown as JiraIssue);
    } catch (error) {
      logger.error(`Failed to get Jira ticket ${key}:`, error);
      return null;
    }
  }

  /**
   * Get tickets by assignee
   */
  async getTicketsByAssignee(assignee: string): Promise<JiraTicket[]> {
    return this.searchTickets(`assignee = "${assignee}"`);
  }

  /**
   * Get tickets by status
   */
  async getTicketsByStatus(status: string): Promise<JiraTicket[]> {
    return this.searchTickets(`status = "${status}"`);
  }

  /**
   * Get tickets by type
   */
  async getTicketsByType(type: string): Promise<JiraTicket[]> {
    return this.searchTickets(`issuetype = "${type}"`);
  }

  /**
   * Get tickets by priority
   */
  async getTicketsByPriority(priority: string): Promise<JiraTicket[]> {
    return this.searchTickets(`priority = "${priority}"`);
  }
}

// Create a singleton instance
const jiraClient = new JiraClient({
  host: process.env.JIRA_HOST as string,
  email: process.env.JIRA_EMAIL as string,
  apiToken: process.env.JIRA_API_TOKEN as string,
  maxRetries: 3,
  rateLimitDelay: 1000,
});

export default jiraClient;
