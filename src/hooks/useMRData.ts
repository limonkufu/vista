"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { GitLabMR } from "@/lib/gitlab";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { clientCache, getMRCacheKey } from "@/lib/clientCache";

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
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(
    async (page = 1, refresh = false) => {
      // Update current page
      setCurrentPage(page);

      // Check cache first (unless forced refresh)
      if (!refresh) {
        const cacheKey = getMRCacheKey(endpoint, page);
        const cachedData = clientCache.get<MRResponse>(cacheKey);

        if (cachedData) {
          logger.info(
            `Using cached data for ${endpoint} MRs, page ${page}`,
            {},
            "Dashboard"
          );
          setData(cachedData);
          setFilteredItems(cachedData.items);
          return;
        }
      }

      setIsLoading(true);
      setError(undefined);

      try {
        logger.info(`Fetching ${endpoint} MRs`, { page, refresh }, "Dashboard");
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

        // Store in cache
        const cacheKey = getMRCacheKey(endpoint, page);
        clientCache.set(cacheKey, responseData);

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
    // Clear cache for this endpoint (all pages)
    for (let i = 1; i <= 10; i++) {
      // Assume max 10 pages
      clientCache.remove(getMRCacheKey(endpoint, i));
    }

    fetchData(currentPage, true);
    toast.info("Refreshing data", {
      description: "Fetching latest merge requests...",
      duration: 2000,
    });
  }, [fetchData, endpoint, currentPage]);

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

  // Initial fetch on mount - use cached data if available
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
    currentPage,
  };
}
