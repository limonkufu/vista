// File: src/components/POView/POView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react"; // Import React and useCallback
import { JiraTicketWithMRs } from "@/types/Jira";
import { TicketGroup } from "./TicketGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch"; // Import Switch
import { Label } from "@/components/ui/label"; // Import Label
import {
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
  JiraQueryOptions,
} from "@/types/Jira";
import { RefreshCw, Search, Filter, ArrowUpDown, Loader2 } from "lucide-react"; // Import ArrowUpDown, Loader2
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { usePOViewData } from "@/hooks/useUnifiedMRData"; // Import the specialized hook
import { useGitLabUsers } from "@/hooks/useGitLabUsers"; // Import useGitLabUsers

import { cn } from "@/lib/utils";

interface POViewProps {
  className?: string;
}

type SortField = "key" | "title" | "status" | "openMRs" | "stalledMRs";
type SortDirection = "asc" | "desc";

// Skeleton component for loading state
const TicketGroupSkeleton = () => (
  <div className="mb-4 space-y-2">
    <Skeleton className="h-16 w-full rounded-md" data-testid="skeleton-card" />
    <Skeleton className="h-4 w-3/4 rounded-md" />
  </div>
);

export function POView({ className }: POViewProps) {
  // --- State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<JiraQueryOptions>({
    statuses: [],
    priorities: [],
    types: [],
  });
  const [sortField, setSortField] = useState<SortField>("key");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [reviewedTicketKeys, setReviewedTicketKeys] = useState<Set<string>>(
    new Set()
  );
  const [flaggedTicketKeys, setFlaggedTicketKeys] = useState<Set<string>>(
    new Set()
  );
  const [showReviewed, setShowReviewed] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);

  // --- Data Fetching ---
  const { isLoadingTeam } = useGitLabUsers(); // Get team loading state

  const jiraOptions: JiraQueryOptions = useMemo(
    () => ({
      // Only pass filters that the backend/service can handle efficiently
      // Search is likely handled by the backend
      search: searchTerm,
      // Pass other filters if backend supports them, otherwise filter client-side
      statuses: filters.statuses,
      priorities: filters.priorities,
      types: filters.types,
    }),
    [searchTerm, filters]
  );

  const {
    data: ticketsData,
    isLoading: isLoadingData, // Rename to avoid conflict
    isError,
    error: fetchError,
    refetch,
  } = usePOViewData(
    jiraOptions
    // Add refreshInterval if needed
  );

  // Combine loading states
  const isLoading = isLoadingData || isLoadingTeam;

  // --- Memos and Callbacks ---
  const tickets = useMemo(() => ticketsData || [], [ticketsData]);
  const error = isError ? fetchError?.message || "Unknown error" : null;

  const handleRefresh = useCallback(() => {
    logger.info("Refreshing PO view data", {}, "POView");
    refetch({ skipCache: true });
  }, [refetch]);

  const handleFilterChange = useCallback(
    (filterType: keyof JiraQueryOptions, value: string[] | string) => {
      const newValue = Array.isArray(value)
        ? value
        : value === "all"
        ? []
        : [value];

      logger.info(
        "Updating PO view filters",
        { filterType, value: newValue },
        "POView"
      );
      setFilters((prev) => ({
        ...prev,
        [filterType]: newValue,
      }));
    },
    []
  );

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDirection((prevDir) =>
        field === sortField ? (prevDir === "asc" ? "desc" : "asc") : "asc"
      );
      setSortField(field);
    },
    [sortField]
  );

  const toggleReviewed = useCallback((ticketKey: string) => {
    setReviewedTicketKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketKey)) {
        newSet.delete(ticketKey);
      } else {
        newSet.add(ticketKey);
      }
      // TODO: Persist this state (e.g., localStorage) in a real app
      return newSet;
    });
  }, []);

  const toggleFlagged = useCallback((ticketKey: string) => {
    setFlaggedTicketKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketKey)) {
        newSet.delete(ticketKey);
      } else {
        newSet.add(ticketKey);
      }
      // TODO: Persist this state (e.g., localStorage) in a real app
      return newSet;
    });
  }, []);

  // --- Filtering & Sorting Logic ---
  const processedTickets = useMemo(() => {
    // Start with tickets from the hook (already potentially filtered by backend)
    let processed = [...tickets];

    // Apply client-side filtering for reviewed/flagged status
    if (showReviewed) {
      processed = processed.filter((t) => reviewedTicketKeys.has(t.ticket.key));
    }
    if (showFlagged) {
      processed = processed.filter((t) => flaggedTicketKeys.has(t.ticket.key));
    }

    // Apply sorting
    processed.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "key":
          // Natural sort for keys like PROJ-10 vs PROJ-2
          const [keyAProject, keyANum] = a.ticket.key.split("-");
          const [keyBProject, keyBNum] = b.ticket.key.split("-");
          if (keyAProject !== keyBProject) {
            return dir * keyAProject.localeCompare(keyBProject);
          }
          return dir * (parseInt(keyANum) - parseInt(keyBNum));
        case "title":
          return dir * a.ticket.title.localeCompare(b.ticket.title);
        case "status":
          return dir * a.ticket.status.localeCompare(b.ticket.status);
        case "openMRs":
          return dir * ((a.openMRs || 0) - (b.openMRs || 0));
        case "stalledMRs":
          return dir * ((a.stalledMRs || 0) - (b.stalledMRs || 0));
        default:
          return 0;
      }
    });

    return processed;
  }, [
    tickets, // Use tickets directly from hook
    sortField,
    sortDirection,
    showReviewed,
    showFlagged,
    reviewedTicketKeys,
    flaggedTicketKeys,
  ]);

  return (
    <div className={cn("container py-8 space-y-6", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Product Owner View</h1>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {/* Filter UI - Render conditionally based on team loading state */}
      {!isLoadingTeam ? (
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-grow min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tickets (key, title) or MRs..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading} // Disable while data is loading
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.statuses?.[0] || "all"}
              onValueChange={(value) => handleFilterChange("statuses", value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.values(JiraTicketStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.priorities?.[0] || "all"}
              onValueChange={(value) => handleFilterChange("priorities", value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.values(JiraTicketPriority).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.types?.[0] || "all"}
              onValueChange={(value) => handleFilterChange("types", value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(JiraTicketType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortField}
              onValueChange={(v) => handleSort(v as SortField)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key">Sort: Key</SelectItem>
                <SelectItem value="title">Sort: Title</SelectItem>
                <SelectItem value="status">Sort: Status</SelectItem>
                <SelectItem value="openMRs">Sort: Open MRs</SelectItem>
                <SelectItem value="stalledMRs">Sort: Stalled MRs</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              title={`Sort Direction (${sortDirection})`}
              disabled={isLoading}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-reviewed"
                checked={showReviewed}
                onCheckedChange={setShowReviewed}
                disabled={isLoading}
              />
              <Label htmlFor="show-reviewed">Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-flagged"
                checked={showFlagged}
                onCheckedChange={setShowFlagged}
                disabled={isLoading}
              />
              <Label htmlFor="show-flagged">Flagged</Label>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="More Filters"
              disabled={isLoading}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Show simplified loading state while team is loading
        <div className="flex items-center justify-center p-4 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading team configuration...
        </div>
      )}
      {/* Error Display */}
      {error &&
        !isLoading && ( // Only show error if not loading
          <div className="rounded-md bg-destructive/15 p-4 text-destructive">
            {error}
          </div>
        )}
      {/* Ticket Groups - Render conditionally based on combined loading state */}
      <div className="space-y-4">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 5 }).map((_, index) => (
            <TicketGroupSkeleton key={index} />
          ))
        ) : processedTickets.length > 0 ? (
          processedTickets.map((ticketWithMRs) => (
            <TicketGroup
              key={ticketWithMRs.ticket.id}
              ticketWithMRs={ticketWithMRs}
              isExpanded={false} // Default collapsed
              isReviewed={reviewedTicketKeys.has(ticketWithMRs.ticket.key)}
              isFlagged={flaggedTicketKeys.has(ticketWithMRs.ticket.key)}
              onToggleReviewed={toggleReviewed}
              onToggleFlagged={toggleFlagged}
            />
          ))
        ) : (
          // Only show "No tickets" if not loading and processedTickets is empty
          <div className="text-center py-8 text-muted-foreground">
            <p>No Jira tickets found matching your criteria.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setFilters({ statuses: [], priorities: [], types: [] });
                setShowReviewed(false);
                setShowFlagged(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
