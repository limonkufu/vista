"use client";

import { useState } from "react";
import { MRTable } from "@/components/MRTable/MRTable";
import { GitLabMR } from "@/lib/gitlab";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

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

  // Fetch data for each table
  const fetchTooOldMRs = async (page = 1) => {
    setIsLoadingTooOld(true);
    setTooOldError(undefined);
    try {
      const response = await fetch(`/api/mrs/too-old?page=${page}`, {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY!,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch too-old MRs");
      const data = await response.json();
      setTooOldMRs(data);
    } catch (error) {
      setTooOldError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsLoadingTooOld(false);
    }
  };

  const fetchNotUpdatedMRs = async (page = 1) => {
    setIsLoadingNotUpdated(true);
    setNotUpdatedError(undefined);
    try {
      const response = await fetch(`/api/mrs/not-updated?page=${page}`, {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY!,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch not-updated MRs");
      const data = await response.json();
      setNotUpdatedMRs(data);
    } catch (error) {
      setNotUpdatedError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsLoadingNotUpdated(false);
    }
  };

  const fetchPendingReviewMRs = async (page = 1) => {
    setIsLoadingPendingReview(true);
    setPendingReviewError(undefined);
    try {
      const response = await fetch(`/api/mrs/pending-review?page=${page}`, {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_API_KEY!,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch pending-review MRs");
      const data = await response.json();
      setPendingReviewMRs(data);
    } catch (error) {
      setPendingReviewError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsLoadingPendingReview(false);
    }
  };

  // Global refresh function
  const refreshAll = async () => {
    await Promise.all([
      fetchTooOldMRs(1),
      fetchNotUpdatedMRs(1),
      fetchPendingReviewMRs(1),
    ]);
  };

  // Initial fetch on mount
  useState(() => {
    refreshAll();
  }, []);

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">GitLab MRs Dashboard</h1>
        <Button
          onClick={refreshAll}
          disabled={
            isLoadingTooOld || isLoadingNotUpdated || isLoadingPendingReview
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh All
        </Button>
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
}
