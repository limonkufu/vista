// File: src/hooks/useUnifiedMRData.ts
import { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import {
  unifiedDataService,
  UnifiedDataResponse as ServiceResponse, // Rename to avoid conflict
} from "@/services/UnifiedDataService";
import { GitLabMRsResponse, FetchAllTeamMRsOptions } from "@/lib/gitlab"; // Use FetchAllTeamMRsOptions
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { logger } from "@/lib/logger";
import { useGitLabUsers } from "./useGitLabUsers"; // Import useGitLabUsers

// Re-export MRDataType enum
export enum MRDataType {
  TOO_OLD = "tooOldMRs",
  NOT_UPDATED = "notUpdatedMRs",
  PENDING_REVIEW = "pendingReviewMRs",
  ALL_MRS = "allMRs", // Might be deprecated if _getBaseMRs is internal
  MRS_WITH_JIRA = "mrsWithJira",
  JIRA_TICKETS = "jiraTickets",
  JIRA_WITH_MRS = "jiraWithMRs",
}

// Define the hook's response type, extending the service response type
export interface UnifiedDataResponse<T> extends ServiceResponse<T> {
  // refetch already exists in ServiceResponse, ensure signature matches
  refetch: (options?: { skipCache?: boolean }) => Promise<void>;
}

// Props for the hook
export interface UseUnifiedMRDataProps {
  dataType: MRDataType;
  // Use Omit<FetchAllTeamMRsOptions, "groupId"> for gitlabOptions
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId"> & {
    page?: number; // Keep page/per_page separate for hygiene views if needed
    per_page?: number;
  };
  jiraOptions?: JiraQueryOptions;
  refreshInterval?: number; // in milliseconds
  skipInitialFetch?: boolean;
}

// Type guard for checking response types
function isGitLabMRsResponse(data: any): data is GitLabMRsResponse {
  return data && "items" in data && "metadata" in data;
}

/**
 * React hook for fetching and managing MR data using the UnifiedDataService
 */
export function useUnifiedMRData<T>(
  props: UseUnifiedMRDataProps
): UnifiedDataResponse<T> {
  const {
    dataType,
    gitlabOptions = {}, // Default to empty object
    jiraOptions,
    refreshInterval,
    skipInitialFetch = false,
  } = props;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!skipInitialFetch);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | undefined>(
    undefined
  );

  // Get current team users and their IDs
  const { teamUsers } = useGitLabUsers();
  const currentTeamIds = useMemo(() => teamUsers.map((u) => u.id), [teamUsers]);

  // Function to fetch data based on the requested data type
  const fetchData = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      const { skipCache = false } = options;
      // Ensure we have team IDs before fetching data that requires them
      // For JIRA_TICKETS, team IDs might not be needed directly
      if (dataType !== MRDataType.JIRA_TICKETS && currentTeamIds.length === 0) {
        logger.warn(`Skipping fetch for ${dataType}: No team IDs available.`);
        // Optionally set loading to false and data to empty/null
        setIsLoading(false);
        setData(dataType === MRDataType.JIRA_WITH_MRS ? [] : (null as any)); // Set appropriate empty state
        return;
      }

      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);

        let result: any;
        // Combine options, adding currentTeamIds to gitlabOptions
        const fetchOpts = {
          ...gitlabOptions,
          skipCache,
          teamUserIds: currentTeamIds, // Pass current team IDs
        };
        const jiraFetchOpts = { ...jiraOptions, skipCache };

        logger.debug(
          `Fetching data via useUnifiedMRData`,
          { dataType, fetchOpts, jiraFetchOpts },
          "useUnifiedMRData"
        );

        switch (dataType) {
          case MRDataType.TOO_OLD:
            result = await unifiedDataService.fetchTooOldMRs(fetchOpts);
            break;
          case MRDataType.NOT_UPDATED:
            result = await unifiedDataService.fetchNotUpdatedMRs(fetchOpts);
            break;
          case MRDataType.PENDING_REVIEW:
            result = await unifiedDataService.fetchPendingReviewMRs(fetchOpts);
            break;
          case MRDataType.MRS_WITH_JIRA:
            // Pass fetchOpts which includes teamUserIds
            result = await unifiedDataService.getMRsWithJiraTickets(fetchOpts);
            break;
          case MRDataType.JIRA_TICKETS:
            // teamUserIds might not be needed here
            result = await unifiedDataService.fetchJiraTickets(jiraFetchOpts);
            break;
          case MRDataType.JIRA_WITH_MRS:
            // Pass fetchOpts (containing teamUserIds) as gitlabOptions
            result = await unifiedDataService.getJiraTicketsWithMRs({
              gitlabOptions: fetchOpts, // Pass combined options
              jiraOptions: jiraFetchOpts,
              skipCache,
              teamUserIds: currentTeamIds, // Also pass explicitly if needed by top-level function
            });
            break;
          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }

        setData(result as T);

        // Update last refreshed timestamp from metadata if available
        if (isGitLabMRsResponse(result) && result.metadata?.lastRefreshed) {
          setLastRefreshed(result.metadata.lastRefreshed);
        } else {
          // Fallback for other data types or if metadata is missing
          setLastRefreshed(new Date().toISOString());
        }

        setIsLoading(false);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setIsError(true);
        setError(errorObj);
        setIsLoading(false);
        logger.error(
          `Error fetching ${dataType}`,
          { error: errorObj.message, stack: errorObj.stack },
          "useUnifiedMRData"
        );
      }
    },
    // Add currentTeamIds to dependencies
    [dataType, gitlabOptions, jiraOptions, currentTeamIds]
  );

  // Initial data fetch & refetch when team changes
  useEffect(() => {
    if (!skipInitialFetch) {
      fetchData(); // Fetch uses cache by default
    }
    // Refetch when currentTeamIds changes
  }, [skipInitialFetch, fetchData, currentTeamIds]); // Add currentTeamIds dependency

  // Set up periodic refresh if requested
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      logger.debug(
        `Setting up refresh interval for ${dataType}`,
        { refreshInterval },
        "useUnifiedMRData"
      );
      const intervalId = setInterval(
        () => fetchData(), // Periodic refresh uses cache by default
        refreshInterval
      );
      return () => clearInterval(intervalId);
    }
  }, [fetchData, refreshInterval, dataType]);

  // Define the refetch function to be returned by the hook
  const refetch = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      await fetchData(options); // Pass skipCache option to fetchData
    },
    [fetchData]
  );

  // Create the response object
  const response: UnifiedDataResponse<T> = {
    data: data as T, // Cast data which might be null initially
    isLoading,
    isError,
    error,
    lastRefreshed,
    refetch, // Return the refetch function
  };

  return response;
}

// --- Specialized Hooks ---
// These hooks now implicitly pass teamUserIds via the base hook

export function usePOViewData(
  jiraOptions?: JiraQueryOptions,
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds from explicit options here
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS,
    gitlabOptions, // Pass remaining gitlab options
    jiraOptions,
    refreshInterval,
  });
}

export function useDevViewData(
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRWithJira[]> {
  return useUnifiedMRData<GitLabMRWithJira[]>({
    dataType: MRDataType.MRS_WITH_JIRA,
    gitlabOptions,
    refreshInterval,
  });
}

export function useTeamViewData(
  jiraOptions?: JiraQueryOptions,
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS,
    gitlabOptions,
    jiraOptions,
    refreshInterval,
  });
}

/**
 * Specialized hook for the traditional hygiene view (backward compatibility)
 */
export function useHygieneViewData(
  dataType:
    | MRDataType.TOO_OLD
    | MRDataType.NOT_UPDATED
    | MRDataType.PENDING_REVIEW,
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds"> & {
    // Remove teamUserIds
    page?: number;
    per_page?: number;
  },
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRsResponse> {
  return useUnifiedMRData<GitLabMRsResponse>({
    dataType,
    gitlabOptions,
    refreshInterval,
  });
}
