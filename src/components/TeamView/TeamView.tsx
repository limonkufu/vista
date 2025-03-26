import { useState, useEffect } from "react";
import {
  JiraTicketWithMRs,
  GitLabMRWithJira,
  JiraTicketStatus,
  JiraQueryOptions,
} from "@/types/Jira";
import { MetricsDashboard } from "./MetricsDashboard";
import { TicketSummaryTable } from "./TicketSummaryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";
import { JiraServiceFactory } from "@/services/JiraServiceFactory";

// Use Record<string, never> instead of empty interface
type TeamViewProps = Record<string, never>;

// Tab types for the team view
type TeamViewTab = "overview" | "tickets";

export function TeamView({}: TeamViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<JiraTicketWithMRs[]>([]);
  const [mergeRequests, setMergeRequests] = useState<GitLabMRWithJira[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TeamViewTab>("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Mock loading the tickets and MRs
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        logger.info(
          "Loading Team view data",
          {
            searchTerm,
            statusFilter,
            activeTab,
          },
          "TeamView"
        );

        // Get the Jira service from the factory
        const jiraService = JiraServiceFactory.getService();

        const queryOptions: JiraQueryOptions = {
          search: searchTerm,
          statuses:
            statusFilter && statusFilter !== "all"
              ? [statusFilter as JiraTicketStatus]
              : undefined,
          skipCache: false,
        };

        // Get Jira tickets with MRs
        const ticketsData = await jiraService.getTicketsWithMRs(queryOptions);

        // Get all MRs with Jira info
        const mrsData = await jiraService.getMergeRequestsWithJira();

        setTickets(ticketsData);
        setMergeRequests(mrsData);
        logger.info(
          "Successfully loaded Team view data",
          {
            ticketsCount: ticketsData.length,
            mrsCount: mrsData.length,
            statusFilter,
          },
          "TeamView"
        );
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        logger.error(
          "Error loading Team view data",
          {
            error: errorMessage,
            searchTerm,
            statusFilter,
            activeTab,
          },
          "TeamView"
        );
        setError("Failed to load team data. Please try again.");
        setIsLoading(false);
      }
    };

    loadData();
  }, [searchTerm, statusFilter, activeTab]);

  // Handle refresh
  const handleRefresh = () => {
    logger.info("Refreshing Team view data", {}, "TeamView");
    setIsLoading(true);
    setError(null);
    // This is a bit of a hack for demo purposes - in reality we'd invalidate cache and re-fetch
    setTimeout(() => {
      const jiraService = JiraServiceFactory.getService();

      Promise.all([
        jiraService.getTicketsWithMRs({
          search: searchTerm,
          statuses:
            statusFilter && statusFilter !== "all"
              ? [statusFilter as JiraTicketStatus]
              : undefined,
          skipCache: true,
        }),
        jiraService.getMergeRequestsWithJira(true),
      ])
        .then(([ticketsData, mrsData]) => {
          setTickets(ticketsData);
          setMergeRequests(mrsData);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Error refreshing:", err);
          setError("Failed to refresh data. Please try again.");
          setIsLoading(false);
        });
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Team View</h1>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TeamViewTab)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={
              activeTab === "overview"
                ? "Search tickets or MRs..."
                : "Search tickets..."
            }
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {activeTab === "tickets" && (
          <div className="flex gap-2">
            <Select
              value={statusFilter || "all"}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="To Do">To Do</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="In Review">In Review</SelectItem>
                <SelectItem value="Done">Done</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      )}

      {activeTab === "overview" ? (
        <div className="space-y-8">
          <MetricsDashboard
            tickets={tickets}
            mergeRequests={mergeRequests}
            isLoading={isLoading}
          />

          <div>
            <h2 className="text-xl font-semibold mb-4">
              Tickets Requiring Attention
            </h2>
            <TicketSummaryTable
              tickets={tickets.filter(
                (t) =>
                  t.ticket.status === "Blocked" ||
                  t.overdueMRs > 0 ||
                  t.stalledMRs > 0
              )}
              isLoading={isLoading}
            />
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">All Tickets</h2>
          <TicketSummaryTable tickets={tickets} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}
