/**
 * useUnifiedMRData - React hook for the UnifiedDataService
 *
 * This hook provides a consistent interface for accessing data across all views,
 * leveraging the UnifiedDataService while maintaining backward compatibility.
 */

import { useState, useEffect, useCallback } from "react";
import {
  unifiedDataService,
  UnifiedDataResponse,
} from "@/services/UnifiedDataService";
import { GitLabMRsResponse, FetchTeamMRsOptions } from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
} from "@/types/Jira";
import { logger } from "@/lib/logger";

// Available data types that can be fetched
export enum MRDataType {
  TOO_OLD = "tooOldMRs",
  NOT_UPDATED = "notUpdatedMRs",
  PENDING_REVIEW = "pendingReviewMRs",
  ALL_MRS = "allMRs",
  MRS_WITH_JIRA = "mrsWithJira",
  JIRA_TICKETS = "jiraTickets",
  JIRA_WITH_MRS = "jiraWithMRs",
}

// Props for the hook
export interface UseUnifiedMRDataProps {
  dataType: MRDataType;
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId">;
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

  // Function to fetch data based on the requested data type
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      let result: any;

      switch (dataType) {
        case MRDataType.TOO_OLD:
          result = await unifiedDataService.fetchTooOldMRs(gitlabOptions);
          break;

        case MRDataType.NOT_UPDATED:
          result = await unifiedDataService.fetchNotUpdatedMRs(gitlabOptions);
          break;

        case MRDataType.PENDING_REVIEW:
          result = await unifiedDataService.fetchPendingReviewMRs(
            gitlabOptions
          );
          break;

        case MRDataType.MRS_WITH_JIRA:
          result = await unifiedDataService.getMRsWithJiraTickets(
            gitlabOptions
          );
          break;

        case MRDataType.JIRA_TICKETS:
          result = await unifiedDataService.fetchJiraTickets(jiraOptions);
          break;

        case MRDataType.JIRA_WITH_MRS:
          result = await unifiedDataService.getJiraTicketsWithMRs(
            gitlabOptions,
            jiraOptions
          );
          break;

        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }

      setData(result as T);

      // Update last refreshed timestamp
      if (isGitLabMRsResponse(result) && result.metadata?.lastRefreshed) {
        setLastRefreshed(result.metadata.lastRefreshed);
      } else {
        setLastRefreshed(new Date().toISOString());
      }

      setIsLoading(false);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
      logger.error(`Error fetching ${dataType}`, { error: err });
    }
  }, [dataType, gitlabOptions, jiraOptions]);

  // Initial data fetch
  useEffect(() => {
    if (!skipInitialFetch) {
      fetchData();
    }
  }, [fetchData, skipInitialFetch]);

  // Set up periodic refresh if requested
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchData, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, refreshInterval]);

  // Create the response object
  const response: UnifiedDataResponse<T> = {
    data: data as T,
    isLoading,
    isError,
    error,
    lastRefreshed,
    refetch: fetchData,
  };

  return response;
}

/**
 * Specialized hook for PO View
 */
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

/**
 * Specialized hook for Dev View
 */
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

/**
 * Specialized hook for Team View
 */
export function useTeamViewData(
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

/**
 * Specialized hook for the traditional hygiene view (backward compatibility)
 */
export function useHygieneViewData(
  dataType:
    | MRDataType.TOO_OLD
    | MRDataType.NOT_UPDATED
    | MRDataType.PENDING_REVIEW,
  gitlabOptions?: Omit<FetchTeamMRsOptions, "groupId">,
  refreshInterval?: number
): UnifiedDataResponse<GitLabMRsResponse> {
  return useUnifiedMRData<GitLabMRsResponse>({
    dataType,
    gitlabOptions,
    refreshInterval,
  });
}
