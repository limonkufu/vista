"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { GitLabMR } from "@/lib/gitlab";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface MRResponse {
  items: GitLabMR[];
  metadata: {
    threshold: number;
    lastRefreshed: string;
    currentPage: number;
    totalPages: number;
    perPage: number;
  };
}

interface UseMRDataProps {
  endpoint: "too-old" | "not-updated" | "pending-review";
  defaultThreshold: number;
}

export function useMRData({ endpoint, defaultThreshold }: UseMRDataProps) {
  const [data, setData] = useState<MRResponse | null>(null);
  const [filteredItems, setFilteredItems] = useState<GitLabMR[]>([]);
  const [groupBy, setGroupBy] = useState<"none" | "author" | "assignee" | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const fetchData = useCallback(
    async (page = 1, refresh = false) => {
      setIsLoading(true);
      setError(undefined);
      try {
        logger.info(`Fetching ${endpoint} MRs`, { page }, "Dashboard");
        const response = await fetchAPI(
          `/api/mrs/${endpoint}?page=${page}${refresh ? "&refresh=true" : ""}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.details || `Failed to fetch ${endpoint} MRs`
          );
        }

        const responseData = await response.json();
        setData(responseData);
        setFilteredItems(responseData.items);
        logger.debug(
          `Received ${endpoint} MRs`,
          { count: responseData.items.length },
          "Dashboard"
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An error occurred";
        logger.error(
          `Error fetching ${endpoint} MRs`,
          { error: message },
          "Dashboard"
        );
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint]
  );

  const refreshData = useCallback(() => {
    fetchData(1, true);
    toast.info("Refreshing data", {
      description: "Fetching latest merge requests...",
      duration: 2000,
    });
  }, [fetchData]);

  const handleFilter = useCallback(
    (
      filteredItems: GitLabMR[],
      groupBy: "none" | "author" | "assignee" | null = null
    ) => {
      setFilteredItems(filteredItems);
      setGroupBy(groupBy);
    },
    []
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  return {
    data,
    filteredItems,
    groupBy,
    isLoading,
    error,
    fetchData,
    refreshData,
    handleFilter,
  };
}
