import { useState, useEffect } from "react";
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

// This would be replaced with actual service in Phase 3
import { JiraServiceFactory } from "@/services/JiraServiceFactory";

interface POViewProps {
  className?: string;
}

export function POView({ className }: POViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<JiraTicketWithMRs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<JiraQueryOptions>({
    statuses: [],
    priorities: [],
    types: [],
  });

  // Mock loading the tickets with MRs
  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the Jira service from the factory (will return mock service in dev)
        const jiraService = JiraServiceFactory.getService();

        // Fetch tickets with MRs
        const ticketsData = await jiraService.getTicketsWithMRs({
          ...filters,
          search: searchTerm,
        });

        setTickets(ticketsData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading tickets:", err);
        setError(
          "Failed to load Jira tickets and associated MRs. Please try again."
        );
        setIsLoading(false);
      }
    };

    loadTickets();

    // This would be replaced with a proper cleanup in a real implementation
    return () => {
      // Cleanup if needed
    };
  }, [filters, searchTerm]);

  // Handle filter change
  const handleFilterChange = (
    filterType: keyof JiraQueryOptions,
    value: string | string[]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value === "all" ? [] : value,
    }));
  };

  // Handle refresh
  const handleRefresh = () => {
    // Refresh data by triggering the useEffect
    setIsLoading(true);
    setError(null);
    // This is a bit of a hack for demo purposes - in reality we'd invalidate cache and re-fetch
    setTimeout(() => {
      const jiraService = JiraServiceFactory.getService();
      jiraService
        .getTicketsWithMRs({
          ...filters,
          search: searchTerm,
          skipCache: true,
        })
        .then((data) => {
          setTickets(data);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Error refreshing:", err);
          setError("Failed to refresh data. Please try again.");
          setIsLoading(false);
        });
    }, 500);
  };

  // Filter and sort tickets based on current filters and search term
  const filteredTickets = tickets;

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
            onValueChange={(value) =>
              handleFilterChange(
                "statuses",
                value === "all" ? [] : [value as JiraTicketStatus]
              )
            }
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
            onValueChange={(value) =>
              handleFilterChange(
                "priorities",
                value === "all" ? [] : [value as JiraTicketPriority]
              )
            }
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
            onValueChange={(value) =>
              handleFilterChange(
                "types",
                value === "all" ? [] : [value as JiraTicketType]
              )
            }
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
              isExpanded={false}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No Jira tickets found matching your criteria.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setFilters({
                  statuses: [],
                  priorities: [],
                  types: [],
                });
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
