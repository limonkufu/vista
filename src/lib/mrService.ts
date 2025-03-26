import { GitLabMR, fetchTeamMRs } from "./gitlab";
import jiraClient from "./jira";
import { GitLabMRWithJira, JiraTicketWithMRs, JiraTicket } from "@/types/Jira";
import { logger } from "./logger";

/**
 * Service for combining GitLab MR and Jira ticket data
 */
export class MRService {
  private readonly groupId: string;

  constructor() {
    const groupId = process.env.GITLAB_GROUP_ID;
    if (!groupId) {
      throw new Error("GITLAB_GROUP_ID environment variable is not set");
    }
    this.groupId = groupId;
  }

  /**
   * Get MRs with associated Jira tickets for PO view
   */
  async getPOViewMRs(): Promise<JiraTicketWithMRs[]> {
    try {
      // Get all MRs from GitLab
      const mrsResponse = await fetchTeamMRs({
        groupId: this.groupId,
        state: "opened",
        include_subgroups: true,
      });

      // Extract Jira ticket keys from MR titles and descriptions
      const jiraKeys = new Set<string>();
      mrsResponse.items.forEach((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        if (key) jiraKeys.add(key);
      });

      // Fetch Jira tickets
      const jiraTickets = await Promise.all(
        Array.from(jiraKeys).map((key) => jiraClient.getTicket(key))
      );

      // Filter out null tickets and create a map for quick lookup
      const ticketMap = new Map(
        jiraTickets
          .filter((ticket): ticket is JiraTicket => ticket !== null)
          .map((ticket) => [ticket.key, ticket])
      );

      // Group MRs by Jira ticket
      const ticketGroups = new Map<string, GitLabMRWithJira[]>();
      mrsResponse.items.forEach((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        if (key && ticketMap.has(key)) {
          const ticket = ticketMap.get(key)!;
          const mrWithJira: GitLabMRWithJira = {
            ...mr,
            jiraTicket: ticket,
            jiraTicketKey: key,
          };

          if (!ticketGroups.has(key)) {
            ticketGroups.set(key, []);
          }
          ticketGroups.get(key)!.push(mrWithJira);
        }
      });

      // Convert to array and add metrics
      return Array.from(ticketGroups.entries()).map(([key, mrs]) => {
        const ticket = ticketMap.get(key)!;
        return {
          ticket,
          mrs,
          totalMRs: mrs.length,
          openMRs: mrs.filter((mr) => mr.state === "opened").length,
          overdueMRs: mrs.filter((mr) => this.isOverdue(mr)).length,
          stalledMRs: mrs.filter((mr) => this.isStalled(mr)).length,
        };
      });
    } catch (error) {
      logger.error("Error getting PO view MRs", { error }, "MRService");
      throw error;
    }
  }

  /**
   * Get MRs with associated Jira tickets for Dev view
   */
  async getDevViewMRs(userId: number): Promise<GitLabMRWithJira[]> {
    try {
      // Get MRs where the user is a reviewer
      const mrsResponse = await fetchTeamMRs({
        groupId: this.groupId,
        state: "opened",
        include_subgroups: true,
      });

      // Filter MRs where user is a reviewer
      const userMRs = mrsResponse.items.filter((mr) =>
        mr.reviewers.some((reviewer) => reviewer.id === userId)
      );

      // Extract Jira ticket keys
      const jiraKeys = new Set<string>();
      userMRs.forEach((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        if (key) jiraKeys.add(key);
      });

      // Fetch Jira tickets
      const jiraTickets = await Promise.all(
        Array.from(jiraKeys).map((key) => jiraClient.getTicket(key))
      );

      // Create ticket map
      const ticketMap = new Map(
        jiraTickets
          .filter((ticket): ticket is JiraTicket => ticket !== null)
          .map((ticket) => [ticket.key, ticket])
      );

      // Combine MRs with Jira tickets
      return userMRs.map((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        return {
          ...mr,
          jiraTicket: key ? ticketMap.get(key) : undefined,
          jiraTicketKey: key || undefined,
        };
      });
    } catch (error) {
      logger.error(
        "Error getting Dev view MRs",
        { error, userId },
        "MRService"
      );
      throw error;
    }
  }

  /**
   * Get MRs with associated Jira tickets for Team view
   */
  async getTeamViewMRs(): Promise<JiraTicketWithMRs[]> {
    try {
      // Get all MRs
      const mrsResponse = await fetchTeamMRs({
        groupId: this.groupId,
        state: "opened",
        include_subgroups: true,
      });

      // Extract Jira ticket keys
      const jiraKeys = new Set<string>();
      mrsResponse.items.forEach((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        if (key) jiraKeys.add(key);
      });

      // Fetch Jira tickets
      const jiraTickets = await Promise.all(
        Array.from(jiraKeys).map((key) => jiraClient.getTicket(key))
      );

      // Create ticket map
      const ticketMap = new Map(
        jiraTickets
          .filter((ticket): ticket is JiraTicket => ticket !== null)
          .map((ticket) => [ticket.key, ticket])
      );

      // Group MRs by Jira ticket
      const ticketGroups = new Map<string, GitLabMRWithJira[]>();
      mrsResponse.items.forEach((mr) => {
        const key = this.extractJiraKeyFromMR(mr);
        if (key && ticketMap.has(key)) {
          const ticket = ticketMap.get(key)!;
          const mrWithJira: GitLabMRWithJira = {
            ...mr,
            jiraTicket: ticket,
            jiraTicketKey: key,
          };

          if (!ticketGroups.has(key)) {
            ticketGroups.set(key, []);
          }
          ticketGroups.get(key)!.push(mrWithJira);
        }
      });

      // Convert to array and add metrics
      return Array.from(ticketGroups.entries()).map(([key, mrs]) => {
        const ticket = ticketMap.get(key)!;
        return {
          ticket,
          mrs,
          totalMRs: mrs.length,
          openMRs: mrs.filter((mr) => mr.state === "opened").length,
          overdueMRs: mrs.filter((mr) => this.isOverdue(mr)).length,
          stalledMRs: mrs.filter((mr) => this.isStalled(mr)).length,
        };
      });
    } catch (error) {
      logger.error("Error getting Team view MRs", { error }, "MRService");
      throw error;
    }
  }

  /**
   * Extract Jira ticket key from MR title or description
   */
  private extractJiraKeyFromMR(mr: GitLabMR): string | null {
    // Check title
    const titleKey = this.extractJiraKeyFromText(mr.title);
    if (titleKey) return titleKey;

    // Check description
    if (mr.description) {
      const descKey = this.extractJiraKeyFromText(mr.description);
      if (descKey) return descKey;
    }

    return null;
  }

  /**
   * Extract Jira ticket key from text
   */
  private extractJiraKeyFromText(text: string): string | null {
    const jiraKeyRegex = /([A-Z][A-Z0-9_]+-[0-9]+)/g;
    const matches = text.match(jiraKeyRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  }

  /**
   * Check if an MR is overdue
   */
  private isOverdue(mr: GitLabMRWithJira | GitLabMR): boolean {
    const createdDate = new Date(mr.created_at);
    const now = new Date();
    const daysOld =
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld > 28; // 28 days threshold
  }

  /**
   * Check if an MR is stalled
   */
  private isStalled(mr: GitLabMRWithJira | GitLabMR): boolean {
    const updatedDate = new Date(mr.updated_at);
    const now = new Date();
    const daysSinceUpdate =
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 14; // 14 days threshold
  }
}

// Export singleton instance
export const mrService = new MRService();
