// File: src/hooks/useUnifiedMRData.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  unifiedDataService,
  UnifiedDataResponse as ServiceResponse,
} from "@/services/UnifiedDataService";
import { GitLabMRsResponse, FetchAllTeamMRsOptions } from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { logger } from "@/lib/logger";
import { useGitLabUsers } from "./useGitLabUsers";
import { useLayout } from "@/contexts/LayoutContext"; // Import useLayout
import { ViewType } from "@/types/ViewTypes"; // Import ViewType

// Re-export MRDataType enum
export enum MRDataType {
  TOO_OLD = "tooOldMRs",
  NOT_UPDATED = "notUpdatedMRs",
  PENDING_REVIEW = "pendingReviewMRs",
  ALL_MRS = "allMRs",
  MRS_WITH_JIRA = "mrsWithJira",
  JIRA_TICKETS = "jiraTickets",
  JIRA_WITH_MRS = "jiraWithMRs",
}

// Define the hook's response type, extending the service response type
export interface UnifiedDataResponse<T> extends ServiceResponse<T> {
  refetch: (options?: { skipCache?: boolean }) => Promise<void>;
}

// Props for the hook
export interface UseUnifiedMRDataProps {
  dataType: MRDataType;
  gitlabOptions?: Omit<FetchAllTeamMRsOptions, "groupId"> & {
    page?: number;
    per_page?: number;
  };
  jiraOptions?: JiraQueryOptions;
  refreshInterval?: number;
  skipInitialFetch?: boolean;
}

// Type guard for checking response types
function isGitLabMRsResponse(data: any): data is GitLabMRsResponse {
  return data && "items" in data && "metadata" in data;
}

// Helper to check if a data type requires team IDs
const dataTypeRequiresTeamIds = (dataType: MRDataType): boolean => {
  return dataType !== MRDataType.JIRA_TICKETS;
};

// *** NEW HELPER ***
// Helper to check if the requested data type is relevant for the currently active view
const isDataTypeRelevantForView = (
  dataType: MRDataType,
  activeView: ViewType
): boolean => {
  switch (activeView) {
    case ViewType.HYGIENE:
      return [
        MRDataType.TOO_OLD,
        MRDataType.NOT_UPDATED,
        MRDataType.PENDING_REVIEW,
      ].includes(dataType);
    case ViewType.PO:
      // PO view primarily needs JIRA_WITH_MRS, but might use JIRA_TICKETS for filtering lists
      return [MRDataType.JIRA_WITH_MRS, MRDataType.JIRA_TICKETS].includes(
        dataType
      );
    case ViewType.DEV:
      // Dev view needs MRs enriched with Jira
      return dataType === MRDataType.MRS_WITH_JIRA;
    case ViewType.TEAM:
      // Team view needs both enriched MRs and grouped tickets
      return [MRDataType.JIRA_WITH_MRS, MRDataType.MRS_WITH_JIRA].includes(
        dataType
      );
    default:
      return false; // Should not happen
  }
};

/**
 * React hook for fetching and managing MR data using the UnifiedDataService
 */
export function useUnifiedMRData<T>(
  props: UseUnifiedMRDataProps
): UnifiedDataResponse<T> {
  const {
    dataType,
    gitlabOptions = {},
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

  const { teamUsers, isLoadingTeam } = useGitLabUsers();
  const { activeView } = useLayout(); // Get activeView from context
  const currentTeamIds = useMemo(() => teamUsers.map((u) => u.id), [teamUsers]);

  // Function to fetch data based on the requested data type
  const fetchData = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      const { skipCache = false } = options;
      const requiresTeam = dataTypeRequiresTeamIds(dataType);

      // --- Start Guard Conditions ---
      // 0. Check if this data type is relevant for the *current* view
      if (!isDataTypeRelevantForView(dataType, activeView)) {
        logger.debug(
          `Skipping fetch for ${dataType}: Not relevant for active view (${activeView}).`
        );
        // Don't set loading false here, let the hook for the *active* view manage it
        return;
      }

      // 1. If it requires team IDs but the team is still loading, wait.
      if (requiresTeam && isLoadingTeam) {
        logger.debug(`Skipping fetch for ${dataType}: Team is loading.`);
        if (!isLoading) setIsLoading(true);
        return;
      }
      // 2. If it requires team IDs but the loaded team is empty, skip and warn.
      if (requiresTeam && !isLoadingTeam && currentTeamIds.length === 0) {
        logger.warn(
          `Skipping fetch for ${dataType}: Team loaded but no IDs available.`
        );
        setIsLoading(false);
        setData(
          dataType === MRDataType.JIRA_WITH_MRS ||
            dataType === MRDataType.MRS_WITH_JIRA
            ? []
            : (null as any)
        );
        setIsError(false);
        setError(
          new Error(
            "No team members selected or found. Please configure the team."
          )
        );
        return;
      }
      // --- End Guard Conditions ---

      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);

        let result: any;
        const fetchOpts = {
          ...gitlabOptions,
          skipCache,
          ...(requiresTeam && { teamUserIds: currentTeamIds }),
        };
        const jiraFetchOpts = { ...jiraOptions, skipCache };

        logger.debug(
          `Fetching data via useUnifiedMRData`,
          {
            dataType,
            activeView,
            fetchOpts: {
              ...fetchOpts,
              teamUserIds: `(${currentTeamIds.length} ids)`,
            },
            jiraFetchOpts,
          },
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
            result = await unifiedDataService.fetchJiraTickets(jiraFetchOpts);
            break;
          case MRDataType.JIRA_WITH_MRS:
            result = await unifiedDataService.getJiraTicketsWithMRs({
              gitlabOptions: fetchOpts,
              jiraOptions: jiraFetchOpts,
              skipCache,
              teamUserIds: currentTeamIds,
            });
            break;
          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }

        setData(result as T);

        if (isGitLabMRsResponse(result) && result.metadata?.lastRefreshed) {
          setLastRefreshed(result.metadata.lastRefreshed);
        } else {
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
    // Add activeView to dependencies
    [
      dataType,
      gitlabOptions,
      jiraOptions,
      currentTeamIds,
      isLoadingTeam,
      activeView,
    ]
  );

  // Initial data fetch & refetch when team/view changes
  useEffect(() => {
    // Only fetch initially if not skipping AND relevant for view AND team is ready (if needed)
    if (!skipInitialFetch && isDataTypeRelevantForView(dataType, activeView)) {
      const requiresTeam = dataTypeRequiresTeamIds(dataType);
      if (requiresTeam) {
        if (!isLoadingTeam && currentTeamIds.length > 0) {
          fetchData();
        } else if (!isLoadingTeam && currentTeamIds.length === 0) {
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
        // If isLoadingTeam is true, wait for the next effect
      } else {
        fetchData(); // Fetch immediately if team IDs are not required
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipInitialFetch, dataType, isLoadingTeam, currentTeamIds, activeView]); // Add activeView

  // Refetch when team changes (if team is required and view is relevant)
  useEffect(() => {
    if (
      isDataTypeRelevantForView(dataType, activeView) &&
      dataTypeRequiresTeamIds(dataType) &&
      !isLoadingTeam &&
      currentTeamIds.length > 0
    ) {
      logger.debug(
        `Team changed for relevant view ${activeView}, refetching ${dataType}...`
      );
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeamIds, isLoadingTeam, dataType, activeView]); // Add activeView

  // Set up periodic refresh if requested, only for the active view's relevant data
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (
      refreshInterval &&
      refreshInterval > 0 &&
      isDataTypeRelevantForView(dataType, activeView) // Only refresh if relevant
    ) {
      logger.debug(
        `Setting up refresh interval for ${dataType} (View: ${activeView})`,
        { refreshInterval },
        "useUnifiedMRData"
      );
      intervalId = setInterval(() => fetchData(), refreshInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval, dataType, activeView]); // Add activeView

  // Define the refetch function to be returned by the hook
  const refetch = useCallback(
    async (options: { skipCache?: boolean } = {}) => {
      // Explicit refetch should work regardless of view relevance? Or should it check?
      // Let's allow explicit refetch to bypass the relevance check for now.
      await fetchData(options);
    },
    [fetchData]
  );

  // Determine combined loading state
  const combinedIsLoading =
    isLoading || (isLoadingTeam && dataTypeRequiresTeamIds(dataType));

  // Create the response object
  const response: UnifiedDataResponse<T> = {
    data: data as T,
    isLoading: combinedIsLoading,
    isError,
    error,
    lastRefreshed,
    refetch,
  };

  return response;
}

// --- Specialized Hooks ---
// No changes needed here

export function usePOViewData(
  jiraOptionsProp?: JiraQueryOptions,
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">,
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);
  const jiraOptions = useMemo(() => jiraOptionsProp, [jiraOptionsProp]);

  return useUnifiedMRData<JiraTicketWithMRs[]>({
    dataType: MRDataType.JIRA_WITH_MRS,
    gitlabOptions,
    jiraOptions,
    refreshInterval,
  });
}

export function useDevViewData(
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">,
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
  gitlabOptionsProp?: Omit<FetchAllTeamMRsOptions, "groupId" | "teamUserIds">,
  refreshInterval?: number
): UnifiedDataResponse<JiraTicketWithMRs[]> {
  const gitlabOptions = useMemo(() => gitlabOptionsProp, [gitlabOptionsProp]);
  const jiraOptions = useMemo(() => jiraOptionsProp, [jiraOptionsProp]);

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
  gitlabOptionsProp?: Omit<
    FetchAllTeamMRsOptions,
    "groupId" | "teamUserIds"
  > & {
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
