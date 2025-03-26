// File: src/services/DataSyncService.ts
import { unifiedDataService } from "./UnifiedDataService";
import { logger } from "@/lib/logger";
import { MRDataType } from "@/hooks/useUnifiedMRData";

// Default refresh intervals in milliseconds
const DEFAULT_REFRESH_INTERVALS: Record<string, number> = {
  [MRDataType.TOO_OLD]: 15 * 60 * 1000, // 15 minutes
  [MRDataType.NOT_UPDATED]: 15 * 60 * 1000, // 15 minutes
  [MRDataType.PENDING_REVIEW]: 10 * 60 * 1000, // 10 minutes
  [MRDataType.MRS_WITH_JIRA]: 10 * 60 * 1000, // 10 minutes
  [MRDataType.JIRA_TICKETS]: 30 * 60 * 1000, // 30 minutes
  [MRDataType.JIRA_WITH_MRS]: 15 * 60 * 1000, // 15 minutes
  DEFAULT: 15 * 60 * 1000, // Default 15 minutes
};

// Priority levels for data types (higher number = higher priority)
const REFRESH_PRIORITIES: Record<string, number> = {
  [MRDataType.PENDING_REVIEW]: 5,
  [MRDataType.NOT_UPDATED]: 4,
  [MRDataType.MRS_WITH_JIRA]: 3,
  [MRDataType.TOO_OLD]: 2,
  [MRDataType.JIRA_WITH_MRS]: 2,
  [MRDataType.JIRA_TICKETS]: 1,
  DEFAULT: 0,
};

interface SyncJob {
  dataType: string;
  lastRun: number;
  nextRun: number;
  interval: number;
  priority: number;
  isRunning: boolean;
}

class DataSyncService {
  private syncJobs: Record<string, SyncJob> = {};
  private syncInterval: number | null = null;
  private isActive: boolean = false;
  private activeView: string | null = null;

  /**
   * Initialize the service with default sync jobs
   */
  constructor() {
    // Set up default jobs for all data types
    Object.values(MRDataType).forEach((dataType) => {
      // Skip ALL_MRS if it's just an internal step now
      if (dataType !== MRDataType.ALL_MRS) {
        this.addSyncJob(dataType);
      }
    });
  }

  /**
   * Add a sync job for a specific data type
   */
  addSyncJob(dataType: string, customInterval?: number): void {
    const interval =
      customInterval ||
      DEFAULT_REFRESH_INTERVALS[dataType] ||
      DEFAULT_REFRESH_INTERVALS.DEFAULT;
    const priority = REFRESH_PRIORITIES[dataType] || REFRESH_PRIORITIES.DEFAULT;

    this.syncJobs[dataType] = {
      dataType,
      lastRun: 0, // Never run yet
      nextRun: Date.now() + interval, // Initial run schedule
      interval,
      priority,
      isRunning: false,
    };

    logger.debug("Added sync job", { dataType, interval, priority });
  }

  /**
   * Set the currently active view to prioritize its data
   */
  setActiveView(view: string | null): void {
    this.activeView = view;
    logger.debug("Set active view for data sync", { view });
    this.reprioritizeJobs();
  }

  /**
   * Reprioritize jobs based on active view
   */
  private reprioritizeJobs(): void {
    Object.keys(this.syncJobs).forEach((key) => {
      const job = this.syncJobs[key];
      job.priority =
        REFRESH_PRIORITIES[job.dataType] || REFRESH_PRIORITIES.DEFAULT;
    });

    if (this.activeView) {
      // Boost priority based on active view (adjust priorities as needed)
      switch (this.activeView) {
        case "po":
          this.boostJobPriority(MRDataType.JIRA_WITH_MRS, 10);
          this.boostJobPriority(MRDataType.JIRA_TICKETS, 8);
          break;
        case "dev":
          this.boostJobPriority(MRDataType.MRS_WITH_JIRA, 10);
          this.boostJobPriority(MRDataType.PENDING_REVIEW, 8); // Still relevant for Dev
          break;
        case "team":
          this.boostJobPriority(MRDataType.JIRA_WITH_MRS, 10);
          this.boostJobPriority(MRDataType.MRS_WITH_JIRA, 8); // Team overview needs both
          break;
        case "hygiene":
        default:
          this.boostJobPriority(MRDataType.TOO_OLD, 10);
          this.boostJobPriority(MRDataType.NOT_UPDATED, 9);
          this.boostJobPriority(MRDataType.PENDING_REVIEW, 8);
          break;
      }
    }
  }

  /**
   * Increase the priority of a specific job
   */
  private boostJobPriority(dataType: string, priority: number): void {
    if (this.syncJobs[dataType]) {
      this.syncJobs[dataType].priority = Math.max(
        this.syncJobs[dataType].priority,
        priority
      ); // Ensure we don't lower priority
      logger.debug("Adjusted job priority", { dataType, priority });
    }
  }

  /**
   * Start the synchronization service
   */
  start(checkInterval: number = 30000): void {
    if (this.isActive || typeof window === "undefined") return; // Don't run on server

    this.isActive = true;
    logger.info("Started data sync service", { checkInterval });

    this.syncInterval = window.setInterval(() => {
      this.processSyncJobs();
    }, checkInterval);

    // Run an initial sync pass shortly after start
    setTimeout(() => this.processSyncJobs(), 5000); // Delay initial run slightly
  }

  /**
   * Stop the synchronization service
   */
  stop(): void {
    if (!this.isActive || typeof window === "undefined") return;

    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isActive = false;
    logger.info("Stopped data sync service");
  }

  /**
   * Process all sync jobs, running those that are due
   */
  private processSyncJobs(): void {
    if (!this.isActive) return;

    const now = Date.now();
    const jobs = Object.values(this.syncJobs)
      .filter((job) => !job.isRunning && job.nextRun <= now)
      .sort((a, b) => b.priority - a.priority);

    const jobsToRun = jobs.slice(0, 2); // Limit concurrent jobs

    if (jobsToRun.length > 0) {
      logger.debug(`Processing ${jobsToRun.length} sync jobs`, {
        jobs: jobsToRun.map((j) => j.dataType),
      });
      jobsToRun.forEach((job) => {
        this.runSyncJob(job.dataType).catch((error) => {
          logger.error("Error running sync job", {
            dataType: job.dataType,
            error,
          });
        });
      });
    }
  }

  /**
   * Run a specific sync job, ensuring cache is skipped.
   */
  private async runSyncJob(dataType: string): Promise<void> {
    const job = this.syncJobs[dataType];
    if (!job || job.isRunning) return;

    job.isRunning = true;
    logger.debug("Running sync job", { dataType });

    try {
      // Always skip cache for background sync jobs
      const options = { skipCache: true };

      switch (dataType) {
        case MRDataType.TOO_OLD:
          await unifiedDataService.fetchTooOldMRs(options);
          break;
        case MRDataType.NOT_UPDATED:
          await unifiedDataService.fetchNotUpdatedMRs(options);
          break;
        case MRDataType.PENDING_REVIEW:
          await unifiedDataService.fetchPendingReviewMRs(options);
          break;
        case MRDataType.MRS_WITH_JIRA:
          await unifiedDataService.getMRsWithJiraTickets(options);
          break;
        case MRDataType.JIRA_TICKETS:
          // Jira service might handle its own cache via /api/jira, ensure skipCache works there if needed
          await unifiedDataService.fetchJiraTickets({ skipCache: true });
          break;
        case MRDataType.JIRA_WITH_MRS:
          await unifiedDataService.getJiraTicketsWithMRs({ skipCache: true });
          break;
        default:
          logger.warn("Unknown data type for sync job", { dataType });
      }

      const now = Date.now();
      job.lastRun = now;
      job.nextRun = now + job.interval;
      logger.debug("Completed sync job", {
        dataType,
        nextRun: new Date(job.nextRun).toISOString(),
      });
    } catch (error) {
      logger.error("Sync job failed", { dataType, error });
      const now = Date.now();
      // Schedule retry with a delay, e.g., 1/3 of interval but at least 1 min
      job.nextRun = now + Math.max(60000, job.interval / 3);
    } finally {
      job.isRunning = false;
    }
  }

  /**
   * Force immediate refresh of a specific data type, skipping cache.
   */
  refreshNow(dataType: string): Promise<void> {
    logger.info(
      `Forcing immediate refresh for ${dataType}`,
      {},
      "DataSyncService"
    );
    // Directly call runSyncJob which handles skipCache: true
    return this.runSyncJob(dataType);
  }

  /**
   * Adjust the refresh interval for a specific data type
   */
  setRefreshInterval(dataType: string, interval: number): void {
    if (this.syncJobs[dataType]) {
      this.syncJobs[dataType].interval = interval;
      // Optionally adjust nextRun based on new interval?
      logger.debug("Updated sync interval", { dataType, interval });
    }
  }
}

// Export a singleton instance
export const dataSyncService = new DataSyncService();

// Start the service on the client-side
if (typeof window !== "undefined") {
  dataSyncService.start();
}
