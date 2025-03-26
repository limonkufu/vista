// File: src/hooks/useMRData.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { GitLabMR } from "@/lib/gitlab";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  useUnifiedMRData,
  MRDataType,
  UseUnifiedMRDataProps,
} from "./useUnifiedMRData"; // Import the unified hook

interface UseMRDataProps {
  endpoint: "too-old" | "not-updated" | "pending-review";
  defaultThreshold: number;
}

// Map endpoint names to MRDataType enum values
const endpointToDataType: Record<UseMRDataProps["endpoint"], MRDataType> = {
  "too-old": MRDataType.TOO_OLD,
  "not-updated": MRDataType.NOT_UPDATED,
  "pending-review": MRDataType.PENDING_REVIEW,
};

export function useMRData({ endpoint, defaultThreshold }: UseMRDataProps) {
  const dataType = endpointToDataType[endpoint];
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredItems, setFilteredItems] = useState<GitLabMR[]>([]);
  const [groupBy, setGroupBy] = useState<"none" | "author" | "assignee" | null>(
    null
  );

  // Use the unified hook for data fetching
  const {
    data: unifiedData,
    isLoading,
    isError,
    error: fetchError,
    lastRefreshed,
    refetch,
  } = useUnifiedMRData<any>({
    // Use 'any' temporarily, refine if GitLabMRsResponse is the exact type
    dataType: dataType,
    gitlabOptions: { page: currentPage, per_page: 25 }, // Pass pagination options
    skipInitialFetch: false, // Fetch on initial load
  });

  // Memoize the data to avoid unnecessary recalculations
  const data = useMemo(() => {
    if (!unifiedData) return null;
    // Assuming unifiedData structure matches MRResponse or can be adapted
    // If the structure is different, map it here.
    // For now, assume it's compatible or GitLabMRsResponse
    const responseData = unifiedData as {
      items: GitLabMR[];
      metadata: any;
    };
    // Update filteredItems whenever data changes (unless filters are applied)
    // This basic version resets filters on data change. A more robust filter
    // implementation would re-apply filters here.
    setFilteredItems(responseData.items || []);
    return {
      items: responseData.items || [],
      metadata: {
        threshold: responseData.metadata?.threshold ?? defaultThreshold,
        lastRefreshed:
          responseData.metadata?.lastRefreshed ??
          lastRefreshed ??
          new Date().toISOString(),
        currentPage: responseData.metadata?.currentPage ?? currentPage,
        totalPages: responseData.metadata?.totalPages ?? 1,
        perPage: responseData.metadata?.perPage ?? 25,
        totalItems: responseData.metadata?.totalItems ?? 0,
      },
    };
  }, [unifiedData, defaultThreshold, lastRefreshed, currentPage]);

  const fetchData = useCallback(
    async (page = 1, refresh = false) => {
      setCurrentPage(page);
      logger.info(
        `Triggering fetch for ${endpoint}`,
        { page, refresh },
        "useMRData"
      );
      // Refetch logic now uses the unified hook's refetch
      // The hook itself handles skipCache based on how it's called or configured
      // We might need to enhance useUnifiedMRData to accept a 'refresh' flag
      await refetch(); // This will use the current 'currentPage' state
      if (refresh) {
        toast.info("Refreshing data", {
          description: "Fetching latest merge requests...",
          duration: 2000,
        });
      }
    },
    [endpoint, refetch] // Add refetch dependency
  );

  const refreshData = useCallback(() => {
    logger.info(`Triggering refresh for ${endpoint}`, {}, "useMRData");
    // Invalidate cache at the service level before refetching
    // This might need a dedicated method in UnifiedDataService or hook
    // For now, just call refetch which should ideally handle cache busting if needed
    fetchData(currentPage, true);
  }, [fetchData, currentPage, endpoint]);

  const handleFilter = useCallback(
    (
      newFilteredItems: GitLabMR[],
      newGroupBy: "none" | "author" | "assignee" | null = null
    ) => {
      setFilteredItems(newFilteredItems);
      setGroupBy(newGroupBy);
    },
    []
  );

  // Map the error state from the unified hook
  const error = isError
    ? fetchError?.message || "An error occurred"
    : undefined;

  return {
    data, // Use the memoized data
    filteredItems, // Use the state managed by handleFilter
    groupBy,
    isLoading,
    error,
    fetchData, // Keep this for pagination triggers
    refreshData,
    handleFilter,
    currentPage,
  };
}
