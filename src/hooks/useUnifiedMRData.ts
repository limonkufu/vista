// File: src/hooks/useUnifiedMRData.ts
import { useState, useEffect, useCallback } from "react";
import {
  unifiedDataService,
  UnifiedDataResponse as ServiceResponse, // Rename to avoid conflict
} from "@/services/UnifiedDataService";
import { GitLabMRsResponse, FetchTeamMRsOptions } from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { logger } from "@/lib/logger";

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
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId"> & {
    page?: number;
    per_page?: number;
  }; // Include pagination here
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

  // Function to fetch data based on the requested data type
  const fetchData = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      const { skipCache = false } = options;
      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);

        let result: any;
        const fetchOpts = { ...gitlabOptions, skipCache }; // Combine options
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
            // Ensure getMRsWithJiraTickets accepts skipCache
            result = await unifiedDataService.getMRsWithJiraTickets({
              skipCache,
            });
            break;
          case MRDataType.JIRA_TICKETS:
            // Ensure fetchJiraTickets accepts skipCache
            result = await unifiedDataService.fetchJiraTickets(jiraFetchOpts);
            break;
          case MRDataType.JIRA_WITH_MRS:
            // Ensure getJiraTicketsWithMRs accepts skipCache
            result = await unifiedDataService.getJiraTicketsWithMRs({
              gitlabOptions: fetchOpts, // Pass gitlab options separately
              jiraOptions: jiraFetchOpts,
              skipCache,
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
    [dataType, gitlabOptions, jiraOptions] // Dependencies for the fetch logic itself
  );

  // Initial data fetch
  useEffect(() => {
    if (!skipInitialFetch) {
      fetchData(); // Initial fetch uses cache by default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipInitialFetch]); // Only run on mount based on skipInitialFetch

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
// These remain largely the same, just ensuring they pass options correctly

export function usePOViewData(
  jiraOptions?: JiraQueryOptions,
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId">,
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS,
    gitlabOptions,
    jiraOptions,
    refreshInterval,
  });
}

export function useDevViewData(
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId">,
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
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId">,
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  // Team view might need both tickets grouped and all MRs.
  // This hook currently fetches tickets grouped. Consider if a separate hook or combined data is needed.
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
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId"> & {
    page?: number;
    per_page?: number;
  }, // Include pagination
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRsResponse> {
  return useUnifiedMRData<GitLabMRsResponse>({
    dataType,
    gitlabOptions,
    refreshInterval,
  });
}
