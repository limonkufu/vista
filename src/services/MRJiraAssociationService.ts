// File: src/services/MRJiraAssociationService.ts
import { GitLabMR } from "@/lib/gitlab";
import { JiraTicket, GitLabMRWithJira } from "@/types/Jira";
import { jiraService } from "./JiraServiceFactory"; // Uses /api/jira
import { logger } from "@/lib/logger";
import {
  getMostLikelyJiraKey,
  extractJiraReferences,
  JiraParserConfig,
  JiraReferenceResult,
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
  enableCache?: boolean; // Cache for fetched Jira tickets within this service run
  // TTL is less relevant here as UnifiedDataService manages overall caching
}

// Default configuration
const defaultConfig: AssociationConfig = {
  parserConfig: {
    preferredProjects: [], // Consider loading from env var if needed
  },
  enableCache: true,
};

// In-memory cache for Jira tickets *during a single enhancement run*
// This avoids fetching the same ticket multiple times when processing a batch of MRs.
// It's cleared on each call to enhanceMRsWithJira or invalidateCache.
let runTimeJiraTicketCache: Map<string, JiraTicket | null> = new Map();

class MRJiraAssociationService {
  private config: AssociationConfig;
  private manualAssociations: Map<number, string> = new Map();

  constructor(config: Partial<AssociationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.loadManualAssociations();
  }

  /**
   * Load manual associations from localStorage
   */
  private loadManualAssociations(): void {
    if (typeof window === "undefined") return; // Skip localStorage on server
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
      this.manualAssociations = new Map();
    }
  }

  /**
   * Save manual associations to localStorage
   */
  private saveManualAssociations(): void {
    if (typeof window === "undefined") return; // Skip localStorage on server
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
    // No need to invalidate internal cache here, UnifiedDataService handles it
    logger.info("Added manual MR-Jira association", { mrId, jiraKey });
  }

  /**
   * Remove a manual association
   */
  removeManualAssociation(mrId: number): void {
    if (this.manualAssociations.has(mrId)) {
      this.manualAssociations.delete(mrId);
      this.saveManualAssociations();
      // No need to invalidate internal cache here, UnifiedDataService handles it
      logger.info("Removed manual MR-Jira association", { mrId });
    }
  }

  /**
   * Get the most likely Jira key associated with an MR, considering manual overrides.
   */
  getJiraKeyForMR(mr: GitLabMR): string | null {
    // Check manual associations first
    if (this.manualAssociations.has(mr.id)) {
      return this.manualAssociations.get(mr.id) || null;
    }
    // Extract automatically
    return getMostLikelyJiraKey(mr, this.config.parserConfig);
  }

  /**
   * Fetch Jira ticket data for a given key, using a short-lived run-time cache.
   */
  private async fetchJiraTicketWithRunCache(
    key: string
  ): Promise<JiraTicket | null> {
    // Check run-time cache first
    if (this.config.enableCache && runTimeJiraTicketCache.has(key)) {
      return runTimeJiraTicketCache.get(key) || null;
    }

    try {
      // Fetch using the JiraService (which uses /api/jira and its own cache)
      const ticket = await jiraService.getTicket(key);

      // Store in run-time cache
      if (this.config.enableCache) {
        runTimeJiraTicketCache.set(key, ticket);
      }
      return ticket;
    } catch (error) {
      logger.error(
        "Error fetching Jira ticket during enhancement",
        { key, error },
        "MRJiraAssociationService"
      );
      // Cache the null result to avoid refetching a known failure during this run
      if (this.config.enableCache) {
        runTimeJiraTicketCache.set(key, null);
      }
      return null;
    }
  }

  /**
   * Enhance GitLab MRs with Jira ticket information.
   * @param mrs - The base list of GitLab MRs.
   * @returns A promise resolving to the list of MRs enhanced with Jira data.
   */
  async enhanceMRsWithJira(mrs: GitLabMR[]): Promise<GitLabMRWithJira[]> {
    // Clear the run-time cache at the start of each batch enhancement
    runTimeJiraTicketCache.clear();

    const associationPromises = mrs.map(async (mr) => {
      const jiraKey = this.getJiraKeyForMR(mr); // Considers manual override

      if (!jiraKey) {
        return { ...mr }; // Return original MR if no key found
      }

      // Fetch ticket data using the run-time cached fetcher
      const jiraTicket = await this.fetchJiraTicketWithRunCache(jiraKey);

      return {
        ...mr,
        jiraTicket: jiraTicket || undefined, // Ensure it's undefined if null
        jiraTicketKey: jiraKey,
      };
    });

    const enhancedMRs = await Promise.all(associationPromises);

    logger.info("Enhanced MRs with Jira data", {
      totalMRs: mrs.length,
      mrsWithJiraKey: enhancedMRs.filter((mr) => mr.jiraTicketKey).length,
      mrsWithFullTicket: enhancedMRs.filter((mr) => mr.jiraTicket).length,
    });

    // Clear run-time cache after processing is complete
    runTimeJiraTicketCache.clear();

    return enhancedMRs;
  }

  /**
   * Get all potential Jira references for an MR, including confidence scores and manual overrides.
   */
  getAllJiraReferences(
    mr: GitLabMR
  ): { key: string; confidence: number; source: string }[] {
    const refs: JiraReferenceResult[] = extractJiraReferences(
      mr,
      this.config.parserConfig
    );
    const results: { key: string; confidence: number; source: string }[] = [];
    const seenKeys = new Set<string>();

    // Check manual association first
    if (this.manualAssociations.has(mr.id)) {
      const manualKey = this.manualAssociations.get(mr.id)!;
      results.push({ key: manualKey, confidence: 1.0, source: "manual" });
      seenKeys.add(manualKey);
    }

    // Add automatic references, avoiding duplicates
    refs.forEach((ref) => {
      if (!seenKeys.has(ref.key)) {
        results.push({
          key: ref.key,
          confidence: ref.confidence,
          source: ref.source,
        });
        seenKeys.add(ref.key);
      }
    });

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Invalidate internal caches (currently only the run-time ticket cache).
   * Called by UnifiedDataService when base data might have changed.
   */
  invalidateCache(): void {
    runTimeJiraTicketCache.clear();
    logger.info("Invalidated MR-Jira association run-time cache");
  }

  /**
   * Update service configuration.
   */
  updateConfig(newConfig: Partial<AssociationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // No cache invalidation needed here as config affects future runs
  }
}

// Export singleton instance
export const mrJiraAssociationService = new MRJiraAssociationService();
