/**
 * DataSyncService
 *
 * Responsible for periodically refreshing data in the background
 * and intelligently invalidating cache based on data lifetime.
 */

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
      this.addSyncJob(dataType);
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
      nextRun: Date.now() + interval,
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

    // Adjust priorities based on the active view
    this.reprioritizeJobs();
  }

  /**
   * Reprioritize jobs based on active view
   */
  private reprioritizeJobs(): void {
    // Reset all jobs to their default priorities
    Object.keys(this.syncJobs).forEach((key) => {
      const job = this.syncJobs[key];
      job.priority =
        REFRESH_PRIORITIES[job.dataType] || REFRESH_PRIORITIES.DEFAULT;
    });

    // Boost priority for data related to active view
    if (this.activeView) {
      switch (this.activeView) {
        case "po":
          this.boostJobPriority(MRDataType.JIRA_WITH_MRS, 10);
          this.boostJobPriority(MRDataType.JIRA_TICKETS, 8);
          break;
        case "dev":
          this.boostJobPriority(MRDataType.MRS_WITH_JIRA, 10);
          this.boostJobPriority(MRDataType.PENDING_REVIEW, 8);
          break;
        case "team":
          this.boostJobPriority(MRDataType.JIRA_WITH_MRS, 10);
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
      this.syncJobs[dataType].priority = priority;
      logger.debug("Boosted job priority", { dataType, priority });
    }
  }

  /**
   * Start the synchronization service
   */
  start(checkInterval: number = 30000): void {
    if (this.isActive) return;

    this.isActive = true;
    logger.info("Started data sync service", { checkInterval });

    // Create a sync loop that runs every 30 seconds by default
    this.syncInterval = window.setInterval(() => {
      this.processSyncJobs();
    }, checkInterval);

    // Run an initial sync pass
    setTimeout(() => this.processSyncJobs(), 1000);
  }

  /**
   * Stop the synchronization service
   */
  stop(): void {
    if (!this.isActive) return;

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
    const now = Date.now();
    const jobs = Object.values(this.syncJobs)
      // Filter out jobs that are not due or already running
      .filter((job) => !job.isRunning && job.nextRun <= now)
      // Sort by priority (highest first)
      .sort((a, b) => b.priority - a.priority);

    // Process up to 2 jobs at once to avoid overwhelming the system
    const jobsToRun = jobs.slice(0, 2);

    jobsToRun.forEach((job) => {
      this.runSyncJob(job.dataType).catch((error) => {
        logger.error("Error running sync job", {
          dataType: job.dataType,
          error,
        });
      });
    });
  }

  /**
   * Run a specific sync job
   */
  private async runSyncJob(dataType: string): Promise<void> {
    const job = this.syncJobs[dataType];
    if (!job || job.isRunning) return;

    // Mark job as running
    job.isRunning = true;
    logger.debug("Running sync job", { dataType });

    try {
      // Refresh data based on type
      switch (dataType) {
        case MRDataType.TOO_OLD:
          await unifiedDataService.fetchTooOldMRs({ skipCache: true });
          break;
        case MRDataType.NOT_UPDATED:
          await unifiedDataService.fetchNotUpdatedMRs({ skipCache: true });
          break;
        case MRDataType.PENDING_REVIEW:
          await unifiedDataService.fetchPendingReviewMRs({ skipCache: true });
          break;
        case MRDataType.MRS_WITH_JIRA:
          await unifiedDataService.getMRsWithJiraTickets({ skipCache: true });
          break;
        case MRDataType.JIRA_TICKETS:
          await unifiedDataService.fetchJiraTickets();
          break;
        case MRDataType.JIRA_WITH_MRS:
          await unifiedDataService.getJiraTicketsWithMRs({ skipCache: true });
          break;
        default:
          logger.warn("Unknown data type for sync job", { dataType });
      }

      // Update job status
      const now = Date.now();
      job.lastRun = now;
      job.nextRun = now + job.interval;
      logger.debug("Completed sync job", {
        dataType,
        nextRun: new Date(job.nextRun),
      });
    } catch (error) {
      logger.error("Sync job failed", { dataType, error });

      // Even if the job fails, update its next run time to avoid
      // constant retries of a failing job
      const now = Date.now();
      job.nextRun = now + Math.max(60000, job.interval / 3); // At least 1 minute delay
    } finally {
      // Mark job as no longer running
      job.isRunning = false;
    }
  }

  /**
   * Force immediate refresh of a specific data type
   */
  refreshNow(dataType: string): Promise<void> {
    return this.runSyncJob(dataType);
  }

  /**
   * Adjust the refresh interval for a specific data type
   */
  setRefreshInterval(dataType: string, interval: number): void {
    if (this.syncJobs[dataType]) {
      this.syncJobs[dataType].interval = interval;
      logger.debug("Updated sync interval", { dataType, interval });
    }
  }
}

// Export a singleton instance
export const dataSyncService = new DataSyncService();
