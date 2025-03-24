"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MRPanel } from "@/components/MRPanel";
import { useMRData } from "@/hooks/useMRData";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function TooOldMRsPage() {
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
    endpoint: "too-old",
    defaultThreshold: 28,
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
        title="Old Merge Requests"
        type="too-old"
        items={data?.items || []}
        filteredItems={filteredItems}
        isLoading={isLoading}
        error={error}
        metadata={
          data?.metadata ?? {
            threshold: 28,
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
