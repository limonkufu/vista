"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MRPanel } from "@/components/MRPanel";
import { useMRData } from "@/hooks/useMRData";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function PendingReviewMRsPage() {
  const {
    data,
    filteredItems,
    groupBy,
    isLoading,
    error,
    fetchData,
    refreshData,
    handleFilter,
  } = useMRData({
    endpoint: "pending-review",
    defaultThreshold: 7,
  });

  // Keyboard shortcut for refresh
  useKeyboardShortcut({ key: "r", ctrlKey: true }, () => {
    if (!isLoading) {
      refreshData();
    }
  });

  return (
    <ErrorBoundary>
      <MRPanel
        title="Pending Review"
        type="pending-review"
        items={data?.items || []}
        filteredItems={filteredItems}
        isLoading={isLoading}
        error={error}
        metadata={
          data?.metadata ?? {
            threshold: 7,
            lastRefreshed: new Date().toISOString(),
            currentPage: 1,
            totalPages: 1,
            perPage: 25,
          }
        }
        groupBy={groupBy}
        onFilter={handleFilter}
        onPageChange={(page) => fetchData(page)}
        onRefresh={refreshData}
      />
    </ErrorBoundary>
  );
}
