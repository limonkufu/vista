import { useState, useEffect } from "react";
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

// This would be linked with actual service in Phase 3
import { JiraServiceFactory } from "@/services/JiraServiceFactory";

// Mock categorization of MRs - in reality this would use more complex logic
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
    // Mock categorization logic
    if (mr.merge_status === "cannot_be_merged") {
      categorized[MRStatusCategory.BLOCKED].push(mr);
    } else if (mr.state === "merged") {
      // Already merged, don't include
    } else if (mr.merge_status === "unchecked") {
      categorized[MRStatusCategory.WAITING_FOR_CI].push(mr);
    } else if (mr.user_notes_count > 0) {
      categorized[MRStatusCategory.CHANGES_REQUESTED].push(mr);
    } else if (mr.upvotes > 0) {
      categorized[MRStatusCategory.READY_TO_MERGE].push(mr);
    } else {
      categorized[MRStatusCategory.NEEDS_REVIEW].push(mr);
    }
  });

  return categorized;
}

// Use Record<string, never> instead of empty interface
type DevViewProps = Record<string, never>;

export function DevView({}: DevViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [mergeRequests, setMergeRequests] = useState<GitLabMRWithJira[]>([]);
  const [categorizedMRs, setCategorizedMRs] = useState<
    Record<MRStatusCategory, GitLabMRWithJira[]>
  >({
    [MRStatusCategory.NEEDS_REVIEW]: [],
    [MRStatusCategory.CHANGES_REQUESTED]: [],
    [MRStatusCategory.WAITING_FOR_CI]: [],
    [MRStatusCategory.READY_TO_MERGE]: [],
    [MRStatusCategory.BLOCKED]: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Load MRs
  useEffect(() => {
    const loadMRs = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the Jira service from the factory, which also provides MRs
        const jiraService = JiraServiceFactory.getService();

        // Get MRs with Jira info
        const mrs = await jiraService.getMergeRequestsWithJira();

        // Apply client-side filtering
        let filteredMRs = mrs;
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          filteredMRs = filteredMRs.filter(
            (mr) =>
              mr.title.toLowerCase().includes(searchLower) ||
              mr.jiraTicketKey?.toLowerCase().includes(searchLower) ||
              mr.source_branch.toLowerCase().includes(searchLower)
          );
        }

        if (authorFilter && authorFilter !== "all") {
          filteredMRs = filteredMRs.filter(
            (mr) => mr.author.username === authorFilter
          );
        }

        if (projectFilter && projectFilter !== "all") {
          filteredMRs = filteredMRs.filter(
            (mr) => mr.project_id.toString() === projectFilter
          );
        }

        setMergeRequests(filteredMRs);

        // Categorize MRs
        const categorized = categorizeMRs(filteredMRs);
        setCategorizedMRs(categorized);

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading MRs:", err);
        setError("Failed to load merge requests. Please try again.");
        setIsLoading(false);
      }
    };

    loadMRs();

    return () => {
      // Cleanup if needed
    };
  }, [searchTerm, authorFilter, projectFilter]);

  // Handle refresh
  const handleRefresh = () => {
    // Refresh data by triggering the useEffect
    setIsLoading(true);
    setError(null);
    // This is a bit of a hack for demo purposes - in reality we'd invalidate cache and re-fetch
    setTimeout(() => {
      const jiraService = JiraServiceFactory.getService();
      jiraService
        .getMergeRequestsWithJira({ skipCache: true })
        .then((mrs) => {
          const filtered = mrs.filter((mr) => {
            let match = true;

            if (searchTerm) {
              const searchLower = searchTerm.toLowerCase();
              match =
                match &&
                (mr.title.toLowerCase().includes(searchLower) ||
                  mr.jiraTicketKey?.toLowerCase().includes(searchLower) ||
                  mr.source_branch.toLowerCase().includes(searchLower));
            }

            if (authorFilter && authorFilter !== "all") {
              match = match && mr.author.username === authorFilter;
            }

            if (projectFilter && projectFilter !== "all") {
              match = match && mr.project_id.toString() === projectFilter;
            }

            return match;
          });

          setMergeRequests(filtered);
          setCategorizedMRs(categorizeMRs(filtered));
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Error refreshing:", err);
          setError("Failed to refresh data. Please try again.");
          setIsLoading(false);
        });
    }, 500);
  };

  // Get unique authors for filter
  const authors = [...new Set(mergeRequests.map((mr) => mr.author.username))];

  // Get unique projects for filter
  const projects = [
    ...new Set(mergeRequests.map((mr) => mr.project_id.toString())),
  ];

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
              {authors.map((author, index) => (
                <SelectItem key={`author-${author}-${index}`} value={author}>
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
              {projects.map((project, index) => (
                <SelectItem key={`project-${project}-${index}`} value={project}>
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
        {isLoading
          ? // Skeleton loading state
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </div>
            ))
          : Object.entries(categorizedMRs).map(([status, mrs]) => (
              <StatusGroup
                key={status}
                status={status as MRStatusCategory}
                mergeRequests={mrs}
                isExpanded={
                  status === MRStatusCategory.CHANGES_REQUESTED ||
                  status === MRStatusCategory.NEEDS_REVIEW
                }
              />
            ))}

        {!isLoading &&
          Object.values(categorizedMRs).every(
            (group) => group.length === 0
          ) && (
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
