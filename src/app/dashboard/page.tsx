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
import { MRFilters } from "@/components/MRFilters/MRFilters";
import { MRGuidance } from "@/components/MRGuidance/MRGuidance";
import { UserSelector } from "@/components/UserSelector/UserSelector";

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

// Helper function to group MRs by a field
function groupMRsByField(items: GitLabMR[], field: "author" | "assignee") {
  const grouped = new Map<string, GitLabMR[]>();

  items.forEach((mr) => {
    if (field === "author") {
      const key = mr.author.username;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(mr);
    } else if (field === "assignee") {
      if (mr.assignees.length === 0) {
        const key = "Unassigned";
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)?.push(mr);
      } else {
        mr.assignees.forEach((assignee) => {
          const key = assignee.username;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)?.push(mr);
        });
      }
    }
  });

  return grouped;
}

export default function DashboardPage() {
  // State for each table
  const [tooOldMRs, setTooOldMRs] = useState<MRResponse | null>(null);
  const [notUpdatedMRs, setNotUpdatedMRs] = useState<MRResponse | null>(null);
  const [pendingReviewMRs, setPendingReviewMRs] = useState<MRResponse | null>(
    null
  );

  // Filtered items state
  const [filteredTooOldMRs, setFilteredTooOldMRs] = useState<GitLabMR[]>([]);
  const [filteredNotUpdatedMRs, setFilteredNotUpdatedMRs] = useState<
    GitLabMR[]
  >([]);
  const [filteredPendingReviewMRs, setFilteredPendingReviewMRs] = useState<
    GitLabMR[]
  >([]);

  // Grouping state
  const [groupByTooOld, setGroupByTooOld] = useState<
    "none" | "author" | "assignee" | null
  >(null);
  const [groupByNotUpdated, setGroupByNotUpdated] = useState<
    "none" | "author" | "assignee" | null
  >(null);
  const [groupByPendingReview, setGroupByPendingReview] = useState<
    "none" | "author" | "assignee" | null
  >(null);

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

  // Apply filtering for too old MRs
  const handleFilterTooOldMRs = useCallback(
    (
      filteredItems: GitLabMR[],
      groupBy: "none" | "author" | "assignee" | null = null
    ) => {
      setFilteredTooOldMRs(filteredItems);
      setGroupByTooOld(groupBy);
    },
    []
  );

  // Apply filtering for not updated MRs
  const handleFilterNotUpdatedMRs = useCallback(
    (
      filteredItems: GitLabMR[],
      groupBy: "none" | "author" | "assignee" | null = null
    ) => {
      setFilteredNotUpdatedMRs(filteredItems);
      setGroupByNotUpdated(groupBy);
    },
    []
  );

  // Apply filtering for pending review MRs
  const handleFilterPendingReviewMRs = useCallback(
    (
      filteredItems: GitLabMR[],
      groupBy: "none" | "author" | "assignee" | null = null
    ) => {
      setFilteredPendingReviewMRs(filteredItems);
      setGroupByPendingReview(groupBy);
    },
    []
  );

  // Update filtered items when raw data changes
  useEffect(() => {
    if (tooOldMRs?.items) {
      setFilteredTooOldMRs(tooOldMRs.items);
    }
  }, [tooOldMRs]);

  useEffect(() => {
    if (notUpdatedMRs?.items) {
      setFilteredNotUpdatedMRs(notUpdatedMRs.items);
    }
  }, [notUpdatedMRs]);

  useEffect(() => {
    if (pendingReviewMRs?.items) {
      setFilteredPendingReviewMRs(pendingReviewMRs.items);
    }
  }, [pendingReviewMRs]);

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
        <h1 className="text-3xl font-bold">GitLab MR Dashboard</h1>
        <div className="flex items-center space-x-4">
          <UserSelector />
          <ThresholdSettings />
          <Button
            onClick={refreshAll}
            disabled={
              isLoadingTooOld || isLoadingNotUpdated || isLoadingPendingReview
            }
          >
            {isLoadingTooOld ||
            isLoadingNotUpdated ||
            isLoadingPendingReview ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh All
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Too Old MRs Panel */}
        <div className="border rounded-lg shadow-sm p-4 bg-background space-y-4">
          {tooOldMRs?.items && (
            <MRFilters
              items={tooOldMRs.items}
              onFilter={(filteredItems, groupBy) =>
                handleFilterTooOldMRs(filteredItems, groupBy)
              }
            />
          )}

          {groupByTooOld &&
          groupByTooOld !== "none" &&
          filteredTooOldMRs.length > 0 ? (
            // Render grouped tables if grouping is enabled
            Object.entries(
              Array.from(
                groupMRsByField(filteredTooOldMRs, groupByTooOld)
              ).reduce((acc, [key, items]) => {
                acc[key] = items;
                return acc;
              }, {} as Record<string, GitLabMR[]>)
            ).map(([key, items]) => (
              <div key={key} className="mt-4">
                <h3 className="text-xl font-medium mb-2">
                  {groupByTooOld === "author" ? "Author" : "Assignee"}: {key}
                </h3>
                <MRTable
                  title={`Too Old MRs (${items.length})`}
                  items={items}
                  isLoading={isLoadingTooOld}
                  error={tooOldError}
                  metadata={{
                    threshold: tooOldMRs?.metadata.threshold || 28,
                    lastRefreshed:
                      tooOldMRs?.metadata.lastRefreshed ||
                      new Date().toISOString(),
                    currentPage: tooOldMRs?.metadata.currentPage || 1,
                    totalPages: tooOldMRs?.metadata.totalPages || 1,
                    perPage: tooOldMRs?.metadata.perPage || 25,
                  }}
                  onPageChange={(page) => fetchTooOldMRs(page)}
                  onRefresh={() => fetchTooOldMRs(1)}
                />
              </div>
            ))
          ) : (
            // Render normal table if no grouping
            <MRTable
              title={`Too Old MRs (${filteredTooOldMRs.length})`}
              items={filteredTooOldMRs}
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
          )}

          {tooOldMRs?.metadata && (
            <div className="mt-4">
              <MRGuidance
                type="too-old"
                threshold={tooOldMRs.metadata.threshold}
              />
            </div>
          )}
        </div>

        {/* Not Updated MRs Panel */}
        <div className="border rounded-lg shadow-sm p-4 bg-background space-y-4">
          {notUpdatedMRs?.items && (
            <MRFilters
              items={notUpdatedMRs.items}
              onFilter={(filteredItems, groupBy) =>
                handleFilterNotUpdatedMRs(filteredItems, groupBy)
              }
            />
          )}

          {groupByNotUpdated &&
          groupByNotUpdated !== "none" &&
          filteredNotUpdatedMRs.length > 0 ? (
            // Render grouped tables if grouping is enabled
            Object.entries(
              Array.from(
                groupMRsByField(filteredNotUpdatedMRs, groupByNotUpdated)
              ).reduce((acc, [key, items]) => {
                acc[key] = items;
                return acc;
              }, {} as Record<string, GitLabMR[]>)
            ).map(([key, items]) => (
              <div key={key} className="mt-4">
                <h3 className="text-xl font-medium mb-2">
                  {groupByNotUpdated === "author" ? "Author" : "Assignee"}:{" "}
                  {key}
                </h3>
                <MRTable
                  title={`Not Updated MRs (${items.length})`}
                  items={items}
                  isLoading={isLoadingNotUpdated}
                  error={notUpdatedError}
                  metadata={{
                    threshold: notUpdatedMRs?.metadata.threshold || 14,
                    lastRefreshed:
                      notUpdatedMRs?.metadata.lastRefreshed ||
                      new Date().toISOString(),
                    currentPage: notUpdatedMRs?.metadata.currentPage || 1,
                    totalPages: notUpdatedMRs?.metadata.totalPages || 1,
                    perPage: notUpdatedMRs?.metadata.perPage || 25,
                  }}
                  onPageChange={(page) => fetchNotUpdatedMRs(page)}
                  onRefresh={() => fetchNotUpdatedMRs(1)}
                />
              </div>
            ))
          ) : (
            // Render normal table if no grouping
            <MRTable
              title={`Inactive Merge Requests (${filteredNotUpdatedMRs.length})`}
              items={filteredNotUpdatedMRs}
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
          )}

          {notUpdatedMRs?.metadata && (
            <div className="mt-4">
              <MRGuidance
                type="not-updated"
                threshold={notUpdatedMRs.metadata.threshold}
              />
            </div>
          )}
        </div>

        {/* Pending Review MRs Panel */}
        <div className="border rounded-lg shadow-sm p-4 bg-background space-y-4">
          {pendingReviewMRs?.items && (
            <MRFilters
              items={pendingReviewMRs.items}
              onFilter={(filteredItems, groupBy) =>
                handleFilterPendingReviewMRs(filteredItems, groupBy)
              }
            />
          )}

          {groupByPendingReview &&
          groupByPendingReview !== "none" &&
          filteredPendingReviewMRs.length > 0 ? (
            // Render grouped tables if grouping is enabled
            Object.entries(
              Array.from(
                groupMRsByField(filteredPendingReviewMRs, groupByPendingReview)
              ).reduce((acc, [key, items]) => {
                acc[key] = items;
                return acc;
              }, {} as Record<string, GitLabMR[]>)
            ).map(([key, items]) => (
              <div key={key} className="mt-4">
                <h3 className="text-xl font-medium mb-2">
                  {groupByPendingReview === "author" ? "Author" : "Assignee"}:{" "}
                  {key}
                </h3>
                <MRTable
                  title={`Pending Review MRs (${items.length})`}
                  items={items}
                  isLoading={isLoadingPendingReview}
                  error={pendingReviewError}
                  metadata={{
                    threshold: pendingReviewMRs?.metadata.threshold || 7,
                    lastRefreshed:
                      pendingReviewMRs?.metadata.lastRefreshed ||
                      new Date().toISOString(),
                    currentPage: pendingReviewMRs?.metadata.currentPage || 1,
                    totalPages: pendingReviewMRs?.metadata.totalPages || 1,
                    perPage: pendingReviewMRs?.metadata.perPage || 25,
                  }}
                  onPageChange={(page) => fetchPendingReviewMRs(page)}
                  onRefresh={() => fetchPendingReviewMRs(1)}
                />
              </div>
            ))
          ) : (
            // Render normal table if no grouping
            <MRTable
              title={`Pending Review (${filteredPendingReviewMRs.length})`}
              items={filteredPendingReviewMRs}
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
          )}

          {pendingReviewMRs?.metadata && (
            <div className="mt-4">
              <MRGuidance
                type="pending-review"
                threshold={pendingReviewMRs.metadata.threshold}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
