import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { GitLabMR } from "@/lib/gitlab";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Loader2 } from "lucide-react";

interface MRTableProps {
  title: string;
  items: GitLabMR[];
  isLoading: boolean;
  error?: string;
  metadata: {
    threshold: number;
    lastRefreshed: string;
    currentPage: number;
    totalPages: number;
    perPage: number;
  };
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

type SortField = "title" | "author" | "created_at" | "updated_at";
type SortDirection = "asc" | "desc";

// Helper function to format dates consistently
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

export function MRTable({
  title,
  items,
  isLoading,
  error,
  metadata,
  onPageChange,
  onRefresh,
}: MRTableProps) {
  const [sortField, setSortField] = useState<SortField>("author");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "title":
        return direction * a.title.localeCompare(b.title);
      case "author":
        return direction * a.author.username.localeCompare(b.author.username);
      case "created_at":
        return (
          direction *
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        );
      case "updated_at":
        return (
          direction *
          (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        );
      default:
        return 0;
    }
  });

  // Generate page numbers
  const pageNumbers = Array.from(
    { length: metadata.totalPages },
    (_, i) => i + 1
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Threshold: {metadata.threshold} days | Last refreshed:{" "}
            {formatDate(metadata.lastRefreshed)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("title")}
                      className="h-8 text-left font-medium"
                    >
                      Title
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("author")}
                      className="h-8 text-left font-medium"
                    >
                      Author
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Reviewers</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("created_at")}
                      className="h-8 text-left font-medium"
                    >
                      Created
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("updated_at")}
                      className="h-8 text-left font-medium"
                    >
                      Updated
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : sortedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No merge requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedItems.map((mr) => (
                    <TableRow key={mr.id}>
                      <TableCell className="font-medium">{mr.title}</TableCell>
                      <TableCell>{mr.author.username}</TableCell>
                      <TableCell>
                        {mr.assignees?.map((a) => a.username).join(", ") ||
                          "None"}
                      </TableCell>
                      <TableCell>
                        {mr.reviewers?.map((r) => r.username).join(", ") ||
                          "None"}
                      </TableCell>
                      <TableCell>{formatDate(mr.created_at)}</TableCell>
                      <TableCell>{formatDate(mr.updated_at)}</TableCell>
                      <TableCell>
                        <a
                          href={mr.web_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (metadata.currentPage > 1) {
                      onPageChange(metadata.currentPage - 1);
                    }
                  }}
                  className={cn(
                    metadata.currentPage <= 1 &&
                      "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
              {pageNumbers.map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page);
                    }}
                    isActive={page === metadata.currentPage}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (metadata.currentPage < metadata.totalPages) {
                      onPageChange(metadata.currentPage + 1);
                    }
                  }}
                  className={cn(
                    metadata.currentPage >= metadata.totalPages &&
                      "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}
    </div>
  );
}
