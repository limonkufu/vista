// File: src/components/DevView/DevView.tsx
import { useState, useEffect, useMemo, useCallback } from "react"; // Added useCallback
import { GitLabMRWithJira } from "@/types/Jira";
import { MRStatusCategory, StatusGroup } from "./StatusGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search, Filter, Loader2 } from "lucide-react"; // Added Loader2
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { useDevViewData } from "@/hooks/useUnifiedMRData"; // Import the specialized hook
import { useGitLabUsers } from "@/hooks/useGitLabUsers"; // Import useGitLabUsers

// Mock categorization of MRs - in reality this would use more complex logic
// Keep this function or refine it based on actual MR data properties
function categorizeMRs(
  mrs: GitLabMRWithJira[]
): Record<MRStatusCategory, GitLabMRWithJira[]> {
  const categorized: Record<MRStatusCategory, GitLabMRWithJira[]> = {
    [MRStatusCategory.NEEDS_REVIEW]: [],
    [MRStatusCategory.CHANGES_REQUESTED]: [],
    [MRStatusCategory.WAITING_FOR_CI]: [],
    [MRStatusCategory.READY_TO_MERGE]: [],
    [MRStatusCategory.BLOCKED]: [],
  };

  mrs.forEach((mr) => {
    // Mock categorization logic - refine this based on actual data/needs
    if (mr.merge_status === "cannot_be_merged" || mr.has_conflicts) {
      categorized[MRStatusCategory.BLOCKED].push(mr);
    } else if (mr.state === "merged") {
      // Already merged, don't include in active categories
    } else if (mr.merge_status === "unchecked" || mr.draft) {
      // Assuming 'unchecked' means CI is running or pending, or if it's a draft
      categorized[MRStatusCategory.WAITING_FOR_CI].push(mr);
    } else if (mr.user_notes_count > 0 && mr.upvotes === 0) {
      // Heuristic: has comments but no approvals might mean changes requested
      categorized[MRStatusCategory.CHANGES_REQUESTED].push(mr);
    } else if (mr.upvotes > 0 && mr.merge_status === "can_be_merged") {
      // Has approvals and can be merged
      categorized[MRStatusCategory.READY_TO_MERGE].push(mr);
    } else {
      // Default to needs review if open and not fitting other categories
      categorized[MRStatusCategory.NEEDS_REVIEW].push(mr);
    }
  });

  return categorized;
}

// Skeleton for loading state
const StatusGroupSkeleton = () => (
  <div className="mb-4 space-y-2">
    <Skeleton className="h-16 w-full rounded-md" data-testid="skeleton-card" />
    <Skeleton className="h-4 w-3/4 rounded-md" />
  </div>
);

type DevViewProps = Record<string, never>;

export function DevView({}: DevViewProps) {
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Get team loading state
  const { isLoadingTeam } = useGitLabUsers();

  // Use the specialized hook to fetch data
  const {
    data: mergeRequestsData, // Renamed to avoid conflict
    isLoading: isLoadingData, // Rename to avoid conflict
    isError,
    error: fetchError,
    refetch,
  } = useDevViewData(
    {
      // Pass filter options if the hook/service supports them
      // Example: authorId: authorFilter !== 'all' ? parseInt(authorFilter) : undefined,
      // Example: projectId: projectFilter !== 'all' ? parseInt(projectFilter) : undefined,
    }
    // Add refreshInterval if needed
  );

  // Combine loading states
  const isLoading = isLoadingData || isLoadingTeam;

  // Apply client-side filtering on top of the data fetched by the hook
  const filteredMergeRequests = useMemo(() => {
    let mrs = mergeRequestsData || [];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      mrs = mrs.filter(
        (mr) =>
          mr.title.toLowerCase().includes(searchLower) ||
          mr.jiraTicketKey?.toLowerCase().includes(searchLower) ||
          mr.source_branch.toLowerCase().includes(searchLower)
      );
    }
    if (authorFilter !== "all") {
      // Assuming authorFilter stores the username string
      mrs = mrs.filter((mr) => mr.author.username === authorFilter);
    }
    if (projectFilter !== "all") {
      // Assuming projectFilter stores the project ID as a string
      mrs = mrs.filter((mr) => mr.project_id.toString() === projectFilter);
    }
    return mrs;
  }, [mergeRequestsData, searchTerm, authorFilter, projectFilter]);

  // Categorize the *client-side filtered* MRs
  const categorizedMRs = useMemo(
    () => categorizeMRs(filteredMergeRequests),
    [filteredMergeRequests]
  );

  const error = isError ? fetchError?.message || "Unknown error" : null;

  // Handle refresh - call the refetch function from the hook
  const handleRefresh = useCallback(() => {
    logger.info("Refreshing Dev view data", {}, "DevView");
    refetch({ skipCache: true }); // Trigger data fetching in useDevViewData
  }, [refetch]);

  // Extract unique authors and projects from the *original* data for dropdowns
  const authors = useMemo(
    () =>
      [
        ...new Set((mergeRequestsData || []).map((mr) => mr.author.username)),
      ].sort(), // Sort authors alphabetically
    [mergeRequestsData]
  );
  const projects = useMemo(
    () =>
      [
        ...new Set(
          (mergeRequestsData || []).map((mr) => mr.project_id.toString())
        ),
      ].sort((a, b) => parseInt(a) - parseInt(b)), // Sort projects numerically
    [mergeRequestsData]
  );

  // No need for useEffect to load data, the hook handles it.

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Developer View</h1>
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
          {" "}
          {/* Added flex-wrap */}
          <div className="relative flex-grow min-w-[200px]">
            {" "}
            {/* Use flex-grow */}
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search MRs by title, branch, or ticket..."
              className="pl-8 w-full" // Ensure input takes full width
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading} // Disable while data is loading
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {" "}
            {/* Added flex-wrap */}
            <Select
              value={authorFilter}
              onValueChange={setAuthorFilter}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Author" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Authors</SelectItem>
                {authors.map((author) => (
                  <SelectItem key={`author-${author}`} value={author}>
                    {author}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={projectFilter}
              onValueChange={setProjectFilter}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={`project-${project}`} value={project}>
                    Project #{project} {/* Or fetch project names */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {error &&
        !isLoading && ( // Only show error if not loading
          <div className="rounded-md bg-destructive/15 p-4 text-destructive">
            {error}
          </div>
        )}

      <div className="space-y-4">
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 3 }).map((_, index) => (
            <StatusGroupSkeleton key={index} />
          ))
        ) : // Use categorizedMRs derived from filteredMergeRequests
        Object.entries(categorizedMRs).length > 0 &&
          Object.values(categorizedMRs).some((group) => group.length > 0) ? (
          Object.entries(categorizedMRs).map(([status, mrs]) => (
            <StatusGroup
              key={status}
              status={status as MRStatusCategory}
              mergeRequests={mrs}
              isExpanded={
                status === MRStatusCategory.CHANGES_REQUESTED ||
                status === MRStatusCategory.NEEDS_REVIEW
              } // Example expansion logic
            />
          ))
        ) : (
          // Only show "No MRs" if not loading and processed list is empty
          <div className="text-center py-8 text-muted-foreground">
            <p>No merge requests found matching your criteria.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setAuthorFilter("all");
                setProjectFilter("all");
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
