// File: src/components/DevView/DevView.tsx
import { useState, useEffect, useMemo } from "react";
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
import { RefreshCw, Search, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { useDevViewData } from "@/hooks/useUnifiedMRData"; // Import the specialized hook

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

type DevViewProps = Record<string, never>;

export function DevView({}: DevViewProps) {
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Use the specialized hook to fetch data
  const {
    data: mergeRequestsData, // Renamed to avoid conflict
    isLoading,
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
  const handleRefresh = () => {
    logger.info("Refreshing Dev view data", {}, "DevView");
    refetch(); // Triggers data fetching in useDevViewData
  };

  // Extract unique authors and projects from the *original* data for dropdowns
  const authors = useMemo(
    () => [
      ...new Set((mergeRequestsData || []).map((mr) => mr.author.username)),
    ],
    [mergeRequestsData]
  );
  const projects = useMemo(
    () => [
      ...new Set(
        (mergeRequestsData || []).map((mr) => mr.project_id.toString())
      ),
    ],
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

      {/* Filter UI remains similar */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search MRs by title, branch, or ticket..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
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

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={`project-${project}`} value={project}>
                  Project #{project}
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
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
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
