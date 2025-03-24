"use client";

import { GitLabMR } from "@/lib/gitlab";
import { MRTable } from "@/components/MRTable/MRTable";
import { MRFilters } from "@/components/MRFilters/MRFilters";
import { MRGuidance } from "@/components/MRGuidance/MRGuidance";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface MRPanelProps {
  title: string;
  type: "too-old" | "not-updated" | "pending-review";
  items: GitLabMR[];
  filteredItems: GitLabMR[];
  isLoading: boolean;
  error?: string;
  metadata: {
    threshold: number;
    lastRefreshed: string;
    currentPage: number;
    totalPages: number;
    perPage: number;
  };
  groupBy: "none" | "author" | "assignee" | null;
  onFilter: (
    filteredItems: GitLabMR[],
    groupBy?: "none" | "author" | "assignee" | null
  ) => void;
  onPageChange: (page: number) => void;
  currentPage?: number;
  onRefresh: () => void;
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

export function MRPanel({
  title,
  type,
  items,
  filteredItems,
  isLoading,
  error,
  metadata,
  groupBy,
  onFilter,
  onPageChange,
  onRefresh,
  currentPage,
}: MRPanelProps) {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {!isLoading && metadata.lastRefreshed && (
            <div className="text-xs text-muted-foreground mt-1">
              Last refreshed:{" "}
              {new Date(metadata.lastRefreshed).toLocaleTimeString()}
              {currentPage && metadata.currentPage === currentPage && (
                <span className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded-full text-[10px]">
                  Cached
                </span>
              )}
            </div>
          )}
        </div>
        <Button onClick={onRefresh} disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      <div className="mt-4">
        <MRGuidance type={type} threshold={metadata.threshold} />
      </div>
      
      <div className="border rounded-lg shadow-sm p-4 bg-background space-y-4">
        {items && <MRFilters items={items} onFilter={onFilter} />}

        {groupBy && groupBy !== "none" && filteredItems.length > 0 ? (
          // Render grouped tables if grouping is enabled
          Object.entries(
            Array.from(groupMRsByField(filteredItems, groupBy)).reduce(
              (acc, [key, items]) => {
                acc[key] = items;
                return acc;
              },
              {} as Record<string, GitLabMR[]>
            )
          ).map(([key, items]) => (
            <div key={key} className="mt-4">
              <h3 className="text-xl font-medium mb-2">
                {groupBy === "author" ? "Author" : "Assignee"}: {key}
              </h3>
              <MRTable
                title={`${title} (${items.length})`}
                items={items}
                isLoading={isLoading}
                error={error}
                metadata={metadata}
                onPageChange={onPageChange}
                onRefresh={onRefresh}
              />
            </div>
          ))
        ) : (
          // Render normal table if no grouping
          <MRTable
            title={`${title} (${filteredItems.length})`}
            items={filteredItems}
            isLoading={isLoading}
            error={error}
            metadata={metadata}
            onPageChange={onPageChange}
            onRefresh={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
