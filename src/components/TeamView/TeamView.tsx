// File: src/components/TeamView/TeamView.tsx
import { useState, useEffect, useMemo } from "react";
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
import { useTeamViewData, useDevViewData } from "@/hooks/useUnifiedMRData"; // Import specialized hooks

type TeamViewProps = Record<string, never>;
type TeamViewTab = "overview" | "tickets";

export function TeamView({}: TeamViewProps) {
  // Local state for filters and tabs
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TeamViewTab>("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // --- Data Fetching using Hooks ---
  const jiraOptions: JiraQueryOptions = useMemo(
    () => ({
      search: searchTerm,
      statuses:
        statusFilter !== "all" ? [statusFilter as JiraTicketStatus] : undefined,
    }),
    [searchTerm, statusFilter]
  );

  // Fetch tickets with MRs (for metrics and ticket table)
  const {
    data: ticketsData,
    isLoading: isLoadingTickets,
    isError: isErrorTickets,
    error: errorTickets,
    refetch: refetchTickets,
  } = useTeamViewData(jiraOptions);

  // Fetch all MRs with Jira (needed for some overview metrics like total MRs)
  // Note: This might be slightly redundant if useTeamViewData already fetches all MRs internally.
  // If useTeamViewData provides *all* MRs used to build the ticket groups, this second fetch might be unnecessary.
  // Assuming for now we need both datasets separately structured.
  const {
    data: mergeRequestsData,
    isLoading: isLoadingMRs,
    isError: isErrorMRs,
    error: errorMRs,
    refetch: refetchMRs,
  } = useDevViewData(); // useDevViewData fetches GitLabMRWithJira

  // Combine loading and error states
  const isLoading = isLoadingTickets || isLoadingMRs;
  const isError = isErrorTickets || isErrorMRs;
  const error = isError
    ? errorTickets?.message || errorMRs?.message || "Failed to load team data"
    : null;

  // Memoize data
  const tickets = useMemo(() => ticketsData || [], [ticketsData]);
  const mergeRequests = useMemo(
    () => mergeRequestsData || [],
    [mergeRequestsData]
  );

  // Handle refresh - refetch both datasets
  const handleRefresh = () => {
    logger.info("Refreshing Team view data", {}, "TeamView");
    refetchTickets();
    refetchMRs();
  };

  // No need for useEffect to load data, hooks handle it.

  // Filtering for the TicketSummaryTable is now handled by passing `jiraOptions` to the hook.
  const filteredTickets = tickets; // The hook should return data respecting the options

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

      {/* Filter UI */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={
              activeTab === "overview"
                ? "Search tickets or MRs..." // Search might need client-side filtering for overview
                : "Search tickets..." // Search handled by hook options for tickets tab
            }
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status filter only applies when the 'tickets' tab is active */}
        {activeTab === "tickets" && (
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

      {/* Render content based on active tab */}
      {activeTab === "overview" ? (
        <div className="space-y-8">
          <MetricsDashboard
            // Pass the potentially *unfiltered* tickets and *all* MRs for accurate overview metrics
            tickets={ticketsData || []} // Or adjust if hook provides unfiltered base
            mergeRequests={mergeRequests}
            isLoading={isLoading}
          />
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Tickets Requiring Attention
            </h2>
            {/* Filter tickets requiring attention client-side for the overview */}
            <TicketSummaryTable
              tickets={(ticketsData || []).filter(
                (t) =>
                  t.ticket.status === JiraTicketStatus.BLOCKED ||
                  (t.overdueMRs || 0) > 0 ||
                  (t.stalledMRs || 0) > 0
              )}
              isLoading={isLoading}
            />
          </div>
        </div>
      ) : (
        // Tickets Tab
        <div>
          <h2 className="text-xl font-semibold mb-4">All Tickets</h2>
          {/* Pass the filteredTickets (data directly from the hook which respects filters) */}
          <TicketSummaryTable tickets={filteredTickets} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}
