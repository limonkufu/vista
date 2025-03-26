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
import { RefreshCw, Search, Filter, ArrowUpDown } from "lucide-react"; // Import ArrowUpDown
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { usePOViewData } from "@/hooks/useUnifiedMRData"; // Import the specialized hook

interface POViewProps {
  className?: string;
}

type SortField = "key" | "title" | "status" | "openMRs" | "stalledMRs";
type SortDirection = "asc" | "desc";

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
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = usePOViewData(
    jiraOptions
    // Add refreshInterval if needed
  );

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
    let processed = [...tickets];

    // Apply client-side filtering (robust approach)
    // Search term (if not fully handled by backend)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      processed = processed.filter(
        (t) =>
          t.ticket.key.toLowerCase().includes(searchLower) ||
          t.ticket.title.toLowerCase().includes(searchLower) ||
          t.mrs.some((mr) => mr.title.toLowerCase().includes(searchLower))
      );
    }
    // Status, Priority, Type (if not handled by backend or for robustness)
    if (filters.statuses && filters.statuses.length > 0) {
      processed = processed.filter((t) =>
        filters.statuses?.includes(t.ticket.status)
      );
    }
    if (filters.priorities && filters.priorities.length > 0) {
      processed = processed.filter((t) =>
        filters.priorities?.includes(t.ticket.priority)
      );
    }
    if (filters.types && filters.types.length > 0) {
      processed = processed.filter((t) =>
        filters.types?.includes(t.ticket.type)
      );
    }

    // Filter by reviewed/flagged status
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
    tickets,
    searchTerm,
    filters,
    sortField,
    sortDirection,
    showReviewed,
    showFlagged,
    reviewedTicketKeys,
    flaggedTicketKeys,
  ]);

  return (
    <div className={`space-y-6 ${className || ""}`}>
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

      {/* Filter UI */}
      <div className="flex flex-wrap gap-4 items-center">
        {" "}
        {/* Added flex-wrap */}
        <div className="relative flex-grow min-w-[200px]">
          {" "}
          {/* Use flex-grow */}
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tickets (key, title) or MRs..."
            className="pl-8 w-full" // Ensure input takes full width
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Dropdown Filters */}
        <div className="flex gap-2 flex-wrap">
          {" "}
          {/* Added flex-wrap */}
          <Select
            value={filters.statuses?.[0] || "all"}
            onValueChange={(value) => handleFilterChange("statuses", value)}
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
          {/* Sort By Dropdown */}
          <Select
            value={sortField}
            onValueChange={(v) => handleSort(v as SortField)}
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
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          {/* Reviewed/Flagged Toggles */}
          <div className="flex items-center space-x-2">
            <Switch
              id="show-reviewed"
              checked={showReviewed}
              onCheckedChange={setShowReviewed}
            />
            <Label htmlFor="show-reviewed">Reviewed</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-flagged"
              checked={showFlagged}
              onCheckedChange={setShowFlagged}
            />
            <Label htmlFor="show-flagged">Flagged</Label>
          </div>
          <Button variant="ghost" size="icon" title="More Filters">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Ticket Groups */}
      <div className="space-y-4">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
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
