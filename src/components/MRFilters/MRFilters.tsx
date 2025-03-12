import { useState, useEffect } from "react";
import { GitLabMR, GitLabUser } from "@/lib/gitlab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface MRFiltersProps {
  items: GitLabMR[];
  onFilter: (
    filteredItems: GitLabMR[],
    groupBy?: "none" | "author" | "assignee" | null
  ) => void;
}

interface FilterState {
  project: number | null;
  author: number | null;
  assignee: number | null;
  reviewer: number | null;
  groupBy: "none" | "author" | "assignee" | null;
}

export function MRFilters({ items, onFilter }: MRFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    project: null,
    author: null,
    assignee: null,
    reviewer: null,
    groupBy: null,
  });

  // Extract unique projects, authors, assignees, and reviewers from items
  const projects = Array.from(
    new Set(items.map((item) => item.project_id))
  ).map((id) => {
    const project = items.find((item) => item.project_id === id);
    return {
      id,
      name: project?.references.full.split("!")[0] || `Project ${id}`,
    };
  });

  const uniqueUsers = new Map<number, GitLabUser>();

  // Add all authors
  items.forEach((item) => {
    if (item.author && !uniqueUsers.has(item.author.id)) {
      uniqueUsers.set(item.author.id, item.author);
    }
  });

  // Add all assignees
  items.forEach((item) => {
    if (item.assignees) {
      item.assignees.forEach((assignee) => {
        if (!uniqueUsers.has(assignee.id)) {
          uniqueUsers.set(assignee.id, assignee);
        }
      });
    }
  });

  // Add all reviewers
  items.forEach((item) => {
    if (item.reviewers) {
      item.reviewers.forEach((reviewer) => {
        if (!uniqueUsers.has(reviewer.id)) {
          uniqueUsers.set(reviewer.id, reviewer);
        }
      });
    }
  });

  const users = Array.from(uniqueUsers.values()).sort((a, b) =>
    a.username.localeCompare(b.username)
  );

  // Apply filters whenever they change
  useEffect(() => {
    let result = [...items];

    // Apply project filter
    if (filters.project !== null) {
      result = result.filter((item) => item.project_id === filters.project);
    }

    // Apply author filter
    if (filters.author !== null) {
      result = result.filter((item) => item.author.id === filters.author);
    }

    // Apply assignee filter
    if (filters.assignee !== null) {
      result = result.filter((item) =>
        item.assignees.some((assignee) => assignee.id === filters.assignee)
      );
    }

    // Apply reviewer filter
    if (filters.reviewer !== null) {
      result = result.filter((item) =>
        item.reviewers.some((reviewer) => reviewer.id === filters.reviewer)
      );
    }

    // Pass the filtered items and groupBy value to the parent component
    onFilter(result, filters.groupBy);
  }, [filters, items, onFilter]);

  const resetFilters = () => {
    setFilters({
      project: null,
      author: null,
      assignee: null,
      reviewer: null,
      groupBy: "none",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>
          Filter merge requests by different criteria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project-filter">Project</Label>
            <Select
              value={filters.project?.toString() || ""}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  project: value !== "all" ? parseInt(value, 10) : null,
                })
              }
            >
              <SelectTrigger id="project-filter">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="author-filter">Author</Label>
            <Select
              value={filters.author?.toString() || ""}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  author: value !== "all" ? parseInt(value, 10) : null,
                })
              }
            >
              <SelectTrigger id="author-filter">
                <SelectValue placeholder="All Authors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Authors</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee-filter">Assignee</Label>
            <Select
              value={filters.assignee?.toString() || ""}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  assignee: value !== "all"  ? parseInt(value, 10) : null,
                })
              }
            >
              <SelectTrigger id="assignee-filter">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewer-filter">Reviewer</Label>
            <Select
              value={filters.reviewer?.toString() || ""}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  reviewer: value !== "all"  ? parseInt(value, 10) : null,
                })
              }
            >
              <SelectTrigger id="reviewer-filter">
                <SelectValue placeholder="All Reviewers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviewers</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-by">Group By</Label>
            <Select
              value={filters.groupBy || ""}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  groupBy:
                    (value as "none" | "author" | "assignee" | "") || null,
                })
              }
            >
              <SelectTrigger id="group-by">
                <SelectValue placeholder="No Grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="assignee">Assignee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={resetFilters} size="sm">
            <X className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
