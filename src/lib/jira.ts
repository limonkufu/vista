import { Version3Client } from "jira.js";
import { logger } from "./logger";
import {
  JiraTicket,
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
} from "../types/jira";

/**
 * Jira client service for interacting with Jira API
 */
export class JiraClient {
  private client: Version3Client;

  constructor() {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!host || !email || !apiToken) {
      throw new Error("Jira credentials not properly configured");
    }

    this.client = new Version3Client({
      host,
      authentication: {
        basic: {
          email,
          apiToken,
        },
      },
    });
  }

  /**
   * Fetch a Jira ticket by its key
   */
  async getTicket(key: string): Promise<JiraTicket | null> {
    try {
      const issue = await this.client.issues.getIssue({
        issueIdOrKey: key,
      });

      return this.mapJiraIssueToTicket(issue);
    } catch (error) {
      logger.error("Error fetching Jira ticket", { key, error }, "JiraAPI");
      return null;
    }
  }

  /**
   * Search for Jira tickets using JQL
   */
  async searchTickets(jql: string): Promise<JiraTicket[]> {
    try {
      const response = await this.client.issueSearch.searchForIssuesUsingJql({
        jql,
      });

      return response.issues.map((issue) => this.mapJiraIssueToTicket(issue));
    } catch (error) {
      logger.error("Error searching Jira tickets", { jql, error }, "JiraAPI");
      return [];
    }
  }

  /**
   * Get tickets assigned to specific users
   */
  async getTicketsByAssignee(assigneeIds: string[]): Promise<JiraTicket[]> {
    const jql = `assignee in (${assigneeIds.join(",")})`;
    return this.searchTickets(jql);
  }

  /**
   * Get tickets in specific statuses
   */
  async getTicketsByStatus(
    statuses: JiraTicketStatus[]
  ): Promise<JiraTicket[]> {
    const jql = `status in (${statuses.map((s) => `"${s}"`).join(",")})`;
    return this.searchTickets(jql);
  }

  /**
   * Get tickets of specific types
   */
  async getTicketsByType(types: JiraTicketType[]): Promise<JiraTicket[]> {
    const jql = `issuetype in (${types.map((t) => `"${t}"`).join(",")})`;
    return this.searchTickets(jql);
  }

  /**
   * Get tickets with specific priorities
   */
  async getTicketsByPriority(
    priorities: JiraTicketPriority[]
  ): Promise<JiraTicket[]> {
    const jql = `priority in (${priorities.map((p) => `"${p}"`).join(",")})`;
    return this.searchTickets(jql);
  }

  /**
   * Map Jira API issue to our JiraTicket type
   */
  private mapJiraIssueToTicket(issue: any): JiraTicket {
    return {
      id: issue.id,
      key: issue.key,
      title: issue.fields.summary,
      description: issue.fields.description,
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
            avatarUrl: issue.fields.assignee.avatarUrls?.["48x48"],
          }
        : undefined,
      reporter: issue.fields.reporter
        ? {
            id: issue.fields.reporter.accountId,
            name: issue.fields.reporter.displayName,
            email: issue.fields.reporter.emailAddress,
            avatarUrl: issue.fields.reporter.avatarUrls?.["48x48"],
          }
        : undefined,
      labels: issue.fields.labels,
      epicKey: issue.fields.customfield_10014, // Assuming this is the epic link field
      epicName: issue.fields.customfield_10015, // Assuming this is the epic name field
      storyPoints: issue.fields.customfield_10016, // Assuming this is the story points field
      sprintName: issue.fields.customfield_10017, // Assuming this is the sprint field
    };
  }
}

// Export singleton instance
export const jiraClient = new JiraClient();
