/**
 * Manual Association Manager
 *
 * Service for managing manual associations between MRs and Jira tickets.
 * This allows users to create, edit, and remove associations that override
 * the automatic detection.
 */

import { GitLabMR } from "@/lib/gitlab";
import { JiraTicket } from "@/types/Jira";
import { mrJiraAssociationService } from "./MRJiraAssociationService";
import { jiraService } from "./JiraServiceFactory";
import { logger } from "@/lib/logger";

// Event types for subscribers
export enum AssociationEventType {
  CREATED = "created",
  REMOVED = "removed",
  UPDATED = "updated",
}

// Interface for subscription callbacks
interface SubscriberCallback {
  (eventType: AssociationEventType, mrId: number, jiraKey?: string): void;
}

class ManualAssociationManager {
  private subscribers: SubscriberCallback[] = [];
  private recentSearches: string[] = [];
  private recentMRs: number[] = [];

  constructor() {
    this.loadRecentData();
  }

  /**
   * Load recent searches and MRs from localStorage
   */
  private loadRecentData(): void {
    try {
      const recentSearches = localStorage.getItem(
        "manual-association-recent-searches"
      );
      if (recentSearches) {
        this.recentSearches = JSON.parse(recentSearches);
      }

      const recentMRs = localStorage.getItem("manual-association-recent-mrs");
      if (recentMRs) {
        this.recentMRs = JSON.parse(recentMRs);
      }
    } catch (error) {
      logger.error("Error loading recent association data", { error });
      // Initialize with empty arrays on error
      this.recentSearches = [];
      this.recentMRs = [];
    }
  }

  /**
   * Save recent searches and MRs to localStorage
   */
  private saveRecentData(): void {
    try {
      localStorage.setItem(
        "manual-association-recent-searches",
        JSON.stringify(this.recentSearches.slice(0, 10))
      );

      localStorage.setItem(
        "manual-association-recent-mrs",
        JSON.stringify(this.recentMRs.slice(0, 10))
      );
    } catch (error) {
      logger.error("Error saving recent association data", { error });
    }
  }

  /**
   * Create a manual association between an MR and Jira ticket
   */
  createAssociation(mrId: number, jiraKey: string): void {
    // Add the association
    mrJiraAssociationService.addManualAssociation(mrId, jiraKey);

    // Update recent lists
    this.updateRecentMR(mrId);
    this.updateRecentSearch(jiraKey);

    // Notify subscribers
    this.notifySubscribers(AssociationEventType.CREATED, mrId, jiraKey);

    logger.info("Created manual association", { mrId, jiraKey });
  }

  /**
   * Remove a manual association
   */
  removeAssociation(mrId: number): void {
    // Remove the association
    mrJiraAssociationService.removeManualAssociation(mrId);

    // Notify subscribers
    this.notifySubscribers(AssociationEventType.REMOVED, mrId);

    logger.info("Removed manual association", { mrId });
  }

  /**
   * Update a manual association (remove + create)
   */
  updateAssociation(mrId: number, jiraKey: string): void {
    // Remove and recreate
    mrJiraAssociationService.removeManualAssociation(mrId);
    mrJiraAssociationService.addManualAssociation(mrId, jiraKey);

    // Update recent lists
    this.updateRecentMR(mrId);
    this.updateRecentSearch(jiraKey);

    // Notify subscribers
    this.notifySubscribers(AssociationEventType.UPDATED, mrId, jiraKey);

    logger.info("Updated manual association", { mrId, jiraKey });
  }

  /**
   * Check if an MR has a manual association
   */
  hasManualAssociation(mrId: number): boolean {
    const refs = mrJiraAssociationService.getAllJiraReferences({
      id: mrId,
    } as GitLabMR);
    return refs.some((ref) => ref.confidence === 1.0);
  }

  /**
   * Get the manual association for an MR if it exists
   */
  getManualAssociation(mrId: number): string | null {
    const refs = mrJiraAssociationService.getAllJiraReferences({
      id: mrId,
    } as GitLabMR);
    const manualRef = refs.find((ref) => ref.confidence === 1.0);
    return manualRef ? manualRef.key : null;
  }

  /**
   * Search for Jira tickets by key or term
   */
  async searchJiraTickets(searchTerm: string): Promise<JiraTicket[]> {
    try {
      // Update recent searches
      this.updateRecentSearch(searchTerm);

      // Check if the search term looks like a Jira key
      const isJiraKey = /^[A-Z][A-Z0-9_]+-[0-9]+$/.test(searchTerm);

      if (isJiraKey) {
        // Try to fetch by exact key first
        const ticket = await jiraService.getTicket(searchTerm);
        return ticket ? [ticket] : [];
      } else {
        // Search by term in title or description
        const tickets = await jiraService.getTickets({
          search: searchTerm,
        });
        return tickets;
      }
    } catch (error) {
      logger.error("Error searching Jira tickets", { searchTerm, error });
      return [];
    }
  }

  /**
   * Suggest possible Jira tickets for an MR
   */
  async suggestJiraTickets(
    mr: GitLabMR
  ): Promise<{ key: string; confidence: number }[]> {
    // Get all references with confidence scores
    return mrJiraAssociationService.getAllJiraReferences(mr);
  }

  /**
   * Get recent Jira searches
   */
  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }

  /**
   * Get recent MRs that had manual associations
   */
  getRecentMRs(): number[] {
    return [...this.recentMRs];
  }

  /**
   * Update the recent MRs list
   */
  private updateRecentMR(mrId: number): void {
    // Remove if already exists
    this.recentMRs = this.recentMRs.filter((id) => id !== mrId);

    // Add to beginning of array
    this.recentMRs.unshift(mrId);

    // Trim to 10 items
    if (this.recentMRs.length > 10) {
      this.recentMRs = this.recentMRs.slice(0, 10);
    }

    // Save to localStorage
    this.saveRecentData();
  }

  /**
   * Update the recent searches list
   */
  private updateRecentSearch(searchTerm: string): void {
    // Skip empty searches
    if (!searchTerm.trim()) return;

    // Remove if already exists
    this.recentSearches = this.recentSearches.filter(
      (term) => term !== searchTerm
    );

    // Add to beginning of array
    this.recentSearches.unshift(searchTerm);

    // Trim to 10 items
    if (this.recentSearches.length > 10) {
      this.recentSearches = this.recentSearches.slice(0, 10);
    }

    // Save to localStorage
    this.saveRecentData();
  }

  /**
   * Subscribe to association events
   */
  subscribe(callback: SubscriberCallback): () => void {
    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(
    eventType: AssociationEventType,
    mrId: number,
    jiraKey?: string
  ): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(eventType, mrId, jiraKey);
      } catch (error) {
        logger.error("Error in association event subscriber", { error });
      }
    });
  }
}

// Export singleton instance
export const manualAssociationManager = new ManualAssociationManager();
