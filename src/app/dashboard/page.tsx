"use client";

import { useState, useEffect, useCallback } from "react";
import { MRTable } from "@/components/MRTable/MRTable";
import { GitLabMR } from "@/lib/gitlab";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import { Progress } from "@/components/ui/progress";
import { cn, debounce } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { toast } from "sonner";
import { fetchAPI } from "@/lib/api";
import { ThresholdSettings } from "@/components/ThresholdSettings/ThresholdSettings";

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

export default function DashboardPage() {
  // State for each table
  const [tooOldMRs, setTooOldMRs] = useState<MRResponse | null>(null);
  const [notUpdatedMRs, setNotUpdatedMRs] = useState<MRResponse | null>(null);
  const [pendingReviewMRs, setPendingReviewMRs] = useState<MRResponse | null>(
    null
  );

  // Loading states
  const [isLoadingTooOld, setIsLoadingTooOld] = useState(false);
  const [isLoadingNotUpdated, setIsLoadingNotUpdated] = useState(false);
  const [isLoadingPendingReview, setIsLoadingPendingReview] = useState(false);

  // Error states
  const [tooOldError, setTooOldError] = useState<string>();
  const [notUpdatedError, setNotUpdatedError] = useState<string>();
  const [pendingReviewError, setPendingReviewError] = useState<string>();

  // Initial loading state
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Fetch data for each table
  const fetchTooOldMRs = async (page = 1) => {
    setIsLoadingTooOld(true);
    setTooOldError(undefined);
    try {
      logger.info("Fetching too-old MRs", { page }, "Dashboard");
      const response = await fetchAPI(
        `/api/mrs/too-old?page=${page}${isInitialLoad ? "" : "&refresh=true"}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to fetch too-old MRs");
      }

      const data = await response.json();
      setTooOldMRs(data);
      logger.debug(
        "Received too-old MRs",
        { count: data.items.length },
        "Dashboard"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      logger.error(
        "Error fetching too-old MRs",
        { error: message },
        "Dashboard"
      );
      setTooOldError(message);
    } finally {
      setIsLoadingTooOld(false);
      if (isInitialLoad) setLoadingProgress((prev) => Math.min(prev + 33, 100));
    }
  };

  const fetchNotUpdatedMRs = async (page = 1) => {
    setIsLoadingNotUpdated(true);
    setNotUpdatedError(undefined);
    try {
      logger.info("Fetching not-updated MRs", { page }, "Dashboard");
      const response = await fetchAPI(
        `/api/mrs/not-updated?page=${page}${
          isInitialLoad ? "" : "&refresh=true"
        }`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to fetch not-updated MRs");
      }

      const data = await response.json();
      setNotUpdatedMRs(data);
      logger.debug(
        "Received not-updated MRs",
        { count: data.items.length },
        "Dashboard"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      logger.error(
        "Error fetching not-updated MRs",
        { error: message },
        "Dashboard"
      );
      setNotUpdatedError(message);
    } finally {
      setIsLoadingNotUpdated(false);
      if (isInitialLoad) setLoadingProgress((prev) => Math.min(prev + 33, 100));
    }
  };

  const fetchPendingReviewMRs = async (page = 1) => {
    setIsLoadingPendingReview(true);
    setPendingReviewError(undefined);
    try {
      logger.info("Fetching pending-review MRs", { page }, "Dashboard");
      const response = await fetchAPI(
        `/api/mrs/pending-review?page=${page}${
          isInitialLoad ? "" : "&refresh=true"
        }`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || "Failed to fetch pending-review MRs"
        );
      }

      const data = await response.json();
      setPendingReviewMRs(data);
      logger.debug(
        "Received pending-review MRs",
        { count: data.items.length },
        "Dashboard"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      logger.error(
        "Error fetching pending-review MRs",
        { error: message },
        "Dashboard"
      );
      setPendingReviewError(message);
    } finally {
      setIsLoadingPendingReview(false);
      if (isInitialLoad) {
        setLoadingProgress(100);
        setTimeout(() => setIsInitialLoad(false), 500); // Give time for progress bar animation
      }
    }
  };

  // Global refresh function with debounce
  const refreshAll = useCallback(
    debounce(() => {
      logger.info("Refreshing all tables", {}, "Dashboard");
      setLoadingProgress(0);
      fetchTooOldMRs(1);
      fetchNotUpdatedMRs(1);
      fetchPendingReviewMRs(1);
      toast.info("Refreshing data", {
        description: "Fetching latest merge requests...",
        duration: 2000,
      });
    }, 1000),
    []
  );

  // Keyboard shortcut for refresh
  useKeyboardShortcut({ key: "r", ctrlKey: true }, () => {
    if (!isLoadingTooOld && !isLoadingNotUpdated && !isLoadingPendingReview) {
      refreshAll();
    }
  });

  // Initial fetch on mount
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const content = (
    <div className="container py-8 space-y-8">
      {isInitialLoad && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-full max-w-md space-y-4 p-6">
            <h2 className="text-2xl font-bold text-center">
              Loading Dashboard
            </h2>
            <Progress value={loadingProgress} className="w-full" />
            <p className="text-center text-muted-foreground">
              Fetching merge requests...
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GitLab MRs Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Press Ctrl+R to refresh all tables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThresholdSettings />
          <Button
            variant="default"
            onClick={refreshAll}
            disabled={
              isLoadingTooOld || isLoadingNotUpdated || isLoadingPendingReview
            }
            title="Refresh all data (Alt+R)"
          >
            <RefreshCw
              data-testid="refresh-icon"
              className={cn("mr-2 h-4 w-4", {
                "animate-spin":
                  isLoadingTooOld ||
                  isLoadingNotUpdated ||
                  isLoadingPendingReview,
              })}
            />
            {isLoadingTooOld || isLoadingNotUpdated || isLoadingPendingReview
              ? "Refreshing..."
              : "Refresh All"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        <MRTable
          title="Old Merge Requests"
          items={tooOldMRs?.items ?? []}
          isLoading={isLoadingTooOld}
          error={tooOldError}
          metadata={
            tooOldMRs?.metadata ?? {
              threshold: 28,
              lastRefreshed: new Date().toISOString(),
              currentPage: 1,
              totalPages: 1,
              perPage: 25,
            }
          }
          onPageChange={(page) => fetchTooOldMRs(page)}
          onRefresh={() => fetchTooOldMRs(1)}
        />

        <MRTable
          title="Inactive Merge Requests"
          items={notUpdatedMRs?.items ?? []}
          isLoading={isLoadingNotUpdated}
          error={notUpdatedError}
          metadata={
            notUpdatedMRs?.metadata ?? {
              threshold: 14,
              lastRefreshed: new Date().toISOString(),
              currentPage: 1,
              totalPages: 1,
              perPage: 25,
            }
          }
          onPageChange={(page) => fetchNotUpdatedMRs(page)}
          onRefresh={() => fetchNotUpdatedMRs(1)}
        />

        <MRTable
          title="Pending Review"
          items={pendingReviewMRs?.items ?? []}
          isLoading={isLoadingPendingReview}
          error={pendingReviewError}
          metadata={
            pendingReviewMRs?.metadata ?? {
              threshold: 7,
              lastRefreshed: new Date().toISOString(),
              currentPage: 1,
              totalPages: 1,
              perPage: 25,
            }
          }
          onPageChange={(page) => fetchPendingReviewMRs(page)}
          onRefresh={() => fetchPendingReviewMRs(1)}
        />
      </div>
    </div>
  );

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
