// File: src/app/dashboard/not-updated/page.tsx
"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MRPanel } from "@/components/MRPanel";
import { useMRData } from "@/hooks/useMRData"; // Keep using this hook (now refactored)
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { thresholds } from "@/lib/config"; // Import thresholds

export default function NotUpdatedMRsPage() {
  const currentThreshold = thresholds.NOT_UPDATED_THRESHOLD; // Get current threshold

  const {
    data,
    filteredItems,
    groupBy,
    isLoading,
    error,
    fetchData, // Used for pagination
    refreshData, // Used for manual refresh
    handleFilter,
    currentPage,
  } = useMRData({
    endpoint: "not-updated",
    defaultThreshold: currentThreshold, // Pass the current threshold
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
        title="Inactive Merge Requests"
        type="not-updated"
        // Use data?.items which comes from the memoized data in the hook
        items={data?.items || []}
        // filteredItems is managed separately by the hook's handleFilter
        filteredItems={filteredItems}
        isLoading={isLoading}
        error={error}
        metadata={
          data?.metadata ?? {
            // Provide default metadata matching the hook's structure
            threshold: currentThreshold,
            lastRefreshed: new Date().toISOString(),
            currentPage: currentPage || 1,
            totalPages: 1,
            perPage: 25,
            totalItems: 0,
          }
        }
        currentPage={currentPage} // Pass current page state
        groupBy={groupBy}
        onFilter={handleFilter}
        onPageChange={(page) => fetchData(page)} // Trigger fetchData on page change
        onRefresh={refreshData} // Trigger refreshData on refresh button
      />
    </ErrorBoundary>
  );
}
