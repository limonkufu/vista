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

// Helper to check if a data type requires team IDs
const dataTypeRequiresTeamIds = (dataType: MRDataType): boolean => {
  return dataType !== MRDataType.JIRA_TICKETS; // Only JIRA_TICKETS doesn't strictly need team IDs
};

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
  // Start loading only if not skipping initial fetch
  const [isLoading, setIsLoading] = useState(!skipInitialFetch);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | undefined>(
    undefined
  );

  // Get current team users and their IDs AND loading state
  const { teamUsers, isLoadingTeam } = useGitLabUsers(); // Get isLoadingTeam
  const currentTeamIds = useMemo(() => teamUsers.map((u) => u.id), [teamUsers]);

  // Function to fetch data based on the requested data type
  const fetchData = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      const { skipCache = false } = options;
      const requiresTeam = dataTypeRequiresTeamIds(dataType);

      // --- Start Guard Conditions ---
      // 1. If it requires team IDs but the team is still loading, wait.
      if (requiresTeam && isLoadingTeam) {
        logger.debug(`Skipping fetch for ${dataType}: Team is loading.`);
        // Ensure loading state reflects waiting for team
        if (!isLoading) setIsLoading(true); // Keep loading true while waiting for team
        return;
      }
      // 2. If it requires team IDs but the loaded team is empty, skip and warn.
      if (requiresTeam && !isLoadingTeam && currentTeamIds.length === 0) {
        logger.warn(`Skipping fetch for ${dataType}: No team IDs available.`);
        // Set appropriate empty/error state
        setIsLoading(false);
        setData(
          dataType === MRDataType.JIRA_WITH_MRS ||
            dataType === MRDataType.MRS_WITH_JIRA
            ? []
            : (null as any)
        ); // Set appropriate empty state
        setIsError(false); // Not necessarily an error, just no team
        setError(
          new Error(
            "No team members selected or found. Please configure the team."
          )
        ); // Provide informative error
        return;
      }
      // --- End Guard Conditions ---

      try {
        // Set loading true only if we are actually going to fetch
        setIsLoading(true);
        setIsError(false);
        setError(null);

        let result: any;
        // Combine options, adding currentTeamIds to gitlabOptions
        // Ensure teamUserIds is only added if required and available
        const fetchOpts = {
          ...gitlabOptions,
          skipCache,
          ...(requiresTeam && { teamUserIds: currentTeamIds }), // Pass current team IDs only if needed
        };
        const jiraFetchOpts = { ...jiraOptions, skipCache };

        logger.debug(
          `Fetching data via useUnifiedMRData`,
          {
            dataType,
            fetchOpts: {
              ...fetchOpts,
              teamUserIds: `(${currentTeamIds.length} ids)`,
            },
            jiraFetchOpts,
          }, // Log count instead of full array
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
            result = await unifiedDataService.getMRsWithJiraTickets(fetchOpts);
            break;
          case MRDataType.JIRA_TICKETS:
            // teamUserIds might not be needed here
            result = await unifiedDataService.fetchJiraTickets(jiraFetchOpts);
            break;
          case MRDataType.JIRA_WITH_MRS:
            result = await unifiedDataService.getJiraTicketsWithMRs({
              gitlabOptions: fetchOpts, // Pass combined options
              jiraOptions: jiraFetchOpts,
              skipCache,
              teamUserIds: currentTeamIds, // Pass explicitly
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

        // Set loading false *after* successful fetch and state update
        setIsLoading(false);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setIsError(true);
        setError(errorObj);
        setIsLoading(false); // Also set loading false on error
        logger.error(
          `Error fetching ${dataType}`,
          { error: errorObj.message, stack: errorObj.stack },
          "useUnifiedMRData"
        );
      }
    },
    // *** REMOVED isLoading from dependencies ***
    [dataType, gitlabOptions, jiraOptions, currentTeamIds, isLoadingTeam]
  );

  // Initial data fetch: Trigger only when team is loaded (if required)
  useEffect(() => {
    if (!skipInitialFetch) {
      // Check if team is needed and if it's loaded
      if (dataTypeRequiresTeamIds(dataType)) {
        if (!isLoadingTeam && currentTeamIds.length > 0) {
          fetchData(); // Fetch only if team is loaded and not empty
        } else if (!isLoadingTeam && currentTeamIds.length === 0) {
          // Handle case where team loaded but is empty
          logger.warn(
            `Initial fetch skipped for ${dataType}: Team loaded but is empty.`
          );
          setIsLoading(false);
          setData(
            dataType === MRDataType.JIRA_WITH_MRS ||
              dataType === MRDataType.MRS_WITH_JIRA
              ? []
              : (null as any)
          );
          setError(
            new Error(
              "No team members selected or found. Please configure the team."
            )
          );
        }
        // If isLoadingTeam is true, fetchData will be triggered by the effect below when it becomes false
      } else {
        fetchData(); // Fetch immediately if team IDs are not required
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipInitialFetch, dataType, isLoadingTeam, currentTeamIds]); // Run when loading state or team IDs change

  // Refetch when team changes (if team is required)
  useEffect(() => {
    if (
      dataTypeRequiresTeamIds(dataType) &&
      !isLoadingTeam &&
      currentTeamIds.length > 0
    ) {
      // Optional: Decide if you *always* want to refetch when team changes,
      // or only if data hasn't been fetched yet.
      // For simplicity, let's refetch to ensure data matches the new team.
      logger.debug(`Team changed for ${dataType}, refetching...`);
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeamIds, isLoadingTeam, dataType]); // Removed fetchData dependency here as it caused loops

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
      // Ensure fetchData is called with the latest dependencies
      await fetchData(options);
    },
    [fetchData] // fetchData already includes necessary dependencies
  );

  // Determine combined loading state: true if hook is loading OR if team is loading (for team-dependent types)
  const combinedIsLoading =
    isLoading || (isLoadingTeam && dataType !== MRDataType.JIRA_TICKETS);

  // Create the response object
  const response: UnifiedDataResponse<T> = {
    data: data as T, // Cast data which might be null initially
    isLoading: combinedIsLoading, // Use combined loading state
    isError,
    error,
    lastRefreshed,
    refetch, // Return the refetch function
  };

  return response;
}

// --- Specialized Hooks ---
// Memoize options passed to the base hook

export function usePOViewData(
  jiraOptionsProp?: JiraQueryOptions,
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds from explicit options here
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  // Memoize options to prevent unnecessary refetches if props haven't changed
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);
  const jiraOptions = useMemo(() => jiraOptionsProp, [jiraOptionsProp]);

  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS,
    gitlabOptions, // Pass remaining gitlab options
    jiraOptions,
    refreshInterval,
  });
}

export function useDevViewData(
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRWithJira[]> {
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);

  return useUnifiedMRData<GitLabMRWithJira[]>({
    dataType: MRDataType.MRS_WITH_JIRA,
    gitlabOptions,
    refreshInterval,
  });
}

export function useTeamViewData(
  jiraOptionsProp?: JiraQueryOptions,
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">, // Remove teamUserIds
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);
  const jiraOptions = useMemo(() => jiraOptionsProp, [jiraOptionsProp]);

  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS, // Or potentially MRS_WITH_JIRA depending on primary need
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
  gitlabOptionsProp?: Omit<
    FetchAllTeamMRsOptions,
    "groupId" | "teamUserIds"
  > & {
    // Remove teamUserIds
    page?: number;
    per_page?: number;
  },
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRsResponse> {
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);

  return useUnifiedMRData<GitLabMRsResponse>({
    dataType,
    gitlabOptions,
    refreshInterval,
  });
}
