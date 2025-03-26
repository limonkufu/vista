// File: src/components/POView/POView.tsx
import { useState, useEffect, useMemo } from "react";
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
import {
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
  JiraQueryOptions,
} from "@/types/Jira";
import { RefreshCw, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { usePOViewData } from "@/hooks/useUnifiedMRData"; // Import the specialized hook

interface POViewProps {
  className?: string;
}

export function POView({ className }: POViewProps) {
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<JiraQueryOptions>({
    statuses: [],
    priorities: [],
    types: [],
  });

  // Use the specialized hook to fetch data
  const {
    data: ticketsData, // Renamed to avoid conflict
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = usePOViewData(
    { search: searchTerm, ...filters }, // Pass filters to the hook
    undefined // No specific GitLab options needed here usually
    // Add refreshInterval if needed: 60000 // e.g., refresh every minute
  );

  // Memoize tickets to prevent re-renders if data object identity changes but content is same
  const tickets = useMemo(() => ticketsData || [], [ticketsData]);
  const error = isError ? fetchError?.message || "Unknown error" : null;

  // Handle refresh - call the refetch function from the hook
  const handleRefresh = () => {
    logger.info("Refreshing PO view data", {}, "POView");
    refetch(); // This triggers the data fetching logic within usePOViewData
  };

  // Handle filter changes - update local state, hook will refetch due to dependency change
  const handleFilterChange = (
    filterType: keyof JiraQueryOptions,
    value: string[] | string // Allow single string for select
  ) => {
    const newValue = Array.isArray(value)
      ? value
      : value === "all"
      ? []
      : [value]; // Convert single value from Select to array or empty array

    logger.info(
      "Updating PO view filters",
      { filterType, value: newValue },
      "POView"
    );
    setFilters((prev) => ({
      ...prev,
      [filterType]: newValue,
    }));
    // No need to manually call loadTickets, the hook handles it
  };

  // No need for useEffect to load data, the hook handles it.

  // Filtering is now primarily done by the hook/service based on options passed.
  // Client-side filtering can be added here if needed on top of service results.
  const filteredTickets = tickets; // Assuming hook returns pre-filtered data based on options

  return (
    <div className={`space-y-6 ${className || ""}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Product Owner View</h1>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Filter UI remains similar, but triggers state updates */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tickets or MRs..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={filters.statuses?.[0] || "all"} // Assuming single select for simplicity
            onValueChange={(value) => handleFilterChange("statuses", value)}
          >
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[160px]">
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

          <Button variant="ghost" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}

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
        ) : filteredTickets.length > 0 ? (
          filteredTickets.map((ticketWithMRs) => (
            <TicketGroup
              key={ticketWithMRs.ticket.id}
              ticketWithMRs={ticketWithMRs}
              isExpanded={false} // Manage expansion state locally if needed
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
