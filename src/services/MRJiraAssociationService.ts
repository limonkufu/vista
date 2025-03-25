/**
 * MR-Jira Association Service
 *
 * Builds and maintains mappings between GitLab MRs and Jira tickets.
 * Handles automatic extraction of Jira ticket IDs as well as manual associations.
 */

import { GitLabMR } from "@/lib/gitlab";
import { JiraTicket, GitLabMRWithJira } from "@/types/Jira";
import { jiraService } from "./JiraServiceFactory";
import { logger } from "@/lib/logger";
import {
  getMostLikelyJiraKey,
  extractJiraReferences,
  JiraParserConfig,
} from "@/utils/jiraReferenceParser";

// Cache key for storing manual associations in localStorage
const MANUAL_ASSOCIATIONS_CACHE_KEY = "mr-jira-manual-associations";

// Interface for manual associations
interface ManualAssociation {
  mrId: number;
  jiraKey: string;
  timestamp: number;
}

// Configuration for the association service
interface AssociationConfig {
  parserConfig?: JiraParserConfig;
  preferredProjects?: string[];
  enableCache?: boolean;
  cacheTTL?: number; // milliseconds
}

// Default configuration
const defaultConfig: AssociationConfig = {
  parserConfig: {
    preferredProjects: [],
  },
  enableCache: true,
  cacheTTL: 30 * 60 * 1000, // 30 minutes
};

// In-memory cache
interface CacheEntry {
  data: Map<number, string>;
  timestamp: number;
  validUntil: number;
}

class MRJiraAssociationService {
  private config: AssociationConfig;
  private manualAssociations: Map<number, string> = new Map();
  private associationCache: CacheEntry | null = null;
  private jiraTicketCache: Map<string, JiraTicket> = new Map();

  constructor(config: Partial<AssociationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.loadManualAssociations();
  }

  /**
   * Load manual associations from localStorage
   */
  private loadManualAssociations(): void {
    try {
      const stored = localStorage.getItem(MANUAL_ASSOCIATIONS_CACHE_KEY);
      if (stored) {
        const parsed: ManualAssociation[] = JSON.parse(stored);
        this.manualAssociations = new Map(
          parsed.map((item) => [item.mrId, item.jiraKey])
        );
        logger.info("Loaded manual MR-Jira associations", {
          count: this.manualAssociations.size,
        });
      }
    } catch (error) {
      logger.error("Error loading manual MR-Jira associations", { error });
      // Initialize with empty map on error
      this.manualAssociations = new Map();
    }
  }

  /**
   * Save manual associations to localStorage
   */
  private saveManualAssociations(): void {
    try {
      const data: ManualAssociation[] = Array.from(
        this.manualAssociations.entries()
      ).map(([mrId, jiraKey]) => ({
        mrId,
        jiraKey,
        timestamp: Date.now(),
      }));

      localStorage.setItem(MANUAL_ASSOCIATIONS_CACHE_KEY, JSON.stringify(data));
      logger.info("Saved manual MR-Jira associations", { count: data.length });
    } catch (error) {
      logger.error("Error saving manual MR-Jira associations", { error });
    }
  }

  /**
   * Add a manual association between an MR and Jira ticket
   */
  addManualAssociation(mrId: number, jiraKey: string): void {
    this.manualAssociations.set(mrId, jiraKey);
    this.saveManualAssociations();

    // Invalidate cache
    this.invalidateCache();

    logger.info("Added manual MR-Jira association", { mrId, jiraKey });
  }

  /**
   * Remove a manual association
   */
  removeManualAssociation(mrId: number): void {
    if (this.manualAssociations.has(mrId)) {
      this.manualAssociations.delete(mrId);
      this.saveManualAssociations();

      // Invalidate cache
      this.invalidateCache();

      logger.info("Removed manual MR-Jira association", { mrId });
    }
  }

  /**
   * Get the Jira key associated with an MR
   */
  getJiraKeyForMR(mr: GitLabMR): string | null {
    // Check manual associations first (highest priority)
    if (this.manualAssociations.has(mr.id)) {
      return this.manualAssociations.get(mr.id) || null;
    }

    // Check cache if enabled
    if (this.config.enableCache && this.associationCache) {
      if (Date.now() < this.associationCache.validUntil) {
        const cachedKey = this.associationCache.data.get(mr.id);
        if (cachedKey) return cachedKey;
      } else {
        // Cache expired, clear it
        this.invalidateCache();
      }
    }

    // Extract from MR fields
    return getMostLikelyJiraKey(mr, this.config.parserConfig);
  }

  /**
   * Build association map for a list of MRs
   */
  async buildAssociationMap(mrs: GitLabMR[]): Promise<Map<number, string>> {
    // Check if we can use the cached associations
    if (
      this.config.enableCache &&
      this.associationCache &&
      Date.now() < this.associationCache.validUntil
    ) {
      logger.info("Using cached MR-Jira associations");
      return new Map(this.associationCache.data);
    }

    // Build new associations
    const associationMap = new Map<number, string>();

    for (const mr of mrs) {
      const jiraKey = this.getJiraKeyForMR(mr);
      if (jiraKey) {
        associationMap.set(mr.id, jiraKey);
      }
    }

    logger.info("Built MR-Jira association map", {
      total: mrs.length,
      associated: associationMap.size,
    });

    // Cache the result if enabled
    if (this.config.enableCache) {
      const now = Date.now();
      this.associationCache = {
        data: new Map(associationMap),
        timestamp: now,
        validUntil: now + (this.config.cacheTTL || 0),
      };
    }

    return associationMap;
  }

  /**
   * Fetch Jira ticket data for a given key
   */
  async fetchJiraTicket(key: string): Promise<JiraTicket | null> {
    // Check cache first
    if (this.jiraTicketCache.has(key)) {
      return this.jiraTicketCache.get(key) || null;
    }

    try {
      const ticket = await jiraService.getTicket(key);

      // Cache the result
      if (ticket) {
        this.jiraTicketCache.set(key, ticket);
      }

      return ticket;
    } catch (error) {
      logger.error("Error fetching Jira ticket", { key, error });
      return null;
    }
  }

  /**
   * Enhance GitLab MRs with Jira ticket information
   */
  async enhanceMRsWithJira(mrs: GitLabMR[]): Promise<GitLabMRWithJira[]> {
    // Build the association map
    const associationMap = await this.buildAssociationMap(mrs);

    // Create enhanced MRs with Jira information
    const enhancedMRs: GitLabMRWithJira[] = [];

    for (const mr of mrs) {
      const jiraKey = associationMap.get(mr.id);

      if (!jiraKey) {
        // No Jira association, just include the original MR
        enhancedMRs.push({
          ...mr,
        });
        continue;
      }

      // Try to get full ticket data
      const jiraTicket = await this.fetchJiraTicket(jiraKey);

      if (jiraTicket) {
        // Full ticket data available
        enhancedMRs.push({
          ...mr,
          jiraTicket,
          jiraTicketKey: jiraKey,
        });
      } else {
        // Only key available
        enhancedMRs.push({
          ...mr,
          jiraTicketKey: jiraKey,
        });
      }
    }

    logger.info("Enhanced MRs with Jira data", {
      total: mrs.length,
      withTickets: enhancedMRs.filter((mr) => mr.jiraTicket).length,
      withKeys: enhancedMRs.filter((mr) => mr.jiraTicketKey).length,
    });

    return enhancedMRs;
  }

  /**
   * Get all Jira references for an MR
   */
  getAllJiraReferences(mr: GitLabMR): { key: string; confidence: number }[] {
    const refs = extractJiraReferences(mr, this.config.parserConfig);

    // Add manual association if it exists with 100% confidence
    if (this.manualAssociations.has(mr.id)) {
      const manualKey = this.manualAssociations.get(mr.id)!;

      // Check if it's already in the list
      const existing = refs.find((ref) => ref.key === manualKey);
      if (existing) {
        // Update confidence to 1.0
        existing.confidence = 1.0;
      } else {
        // Add to list
        refs.unshift({
          key: manualKey,
          source: "manual",
          confidence: 1.0,
          pattern: "manual",
        });
      }
    }

    return refs.map((ref) => ({ key: ref.key, confidence: ref.confidence }));
  }

  /**
   * Invalidate the association cache
   */
  invalidateCache(): void {
    this.associationCache = null;
    this.jiraTicketCache.clear();
    logger.info("Invalidated MR-Jira association cache");
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<AssociationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // If config changed significantly, invalidate cache
    this.invalidateCache();
  }
}

// Export singleton instance
export const mrJiraAssociationService = new MRJiraAssociationService();
