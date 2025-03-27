// File: src/components/MRTable/MRTable.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MRTable } from "@/components/MRTable/MRTable"; // Adjust path
import { GitLabMR } from "@/lib/gitlab"; // Adjust path

// --- Mock Data ---
const mockMetadataBase = {
  threshold: 28,
  lastRefreshed: "2024-03-15T12:00:00Z",
  currentPage: 1,
  totalPages: 3,
  perPage: 2, // Use smaller perPage for easier pagination testing
  totalItems: 6, // Example total
};

// More complete mock MR function
const createMockMR = (
  id: number,
  title: string,
  authorUsername: string,
  createdAt: string,
  updatedAt: string
): GitLabMR => ({
  id,
  iid: id,
  project_id: 1,
  title,
  description: `Description for ${title}`,
  state: "opened",
  created_at: createdAt,
  updated_at: updatedAt,
  merged_at: null,
  closed_at: null,
  target_branch: "main",
  source_branch: `feature/${id}`,
  user_notes_count: Math.floor(Math.random() * 10),
  upvotes: Math.floor(Math.random() * 5),
  downvotes: 0,
  author: { id: id * 10, username: authorUsername, name: `Author ${id}` },
  assignees: [
    { id: id * 10 + 1, username: `assignee_${id}`, name: `Assignee ${id}` },
  ],
  assignee: null, // Often null if assignees array is used
  reviewers: [
    { id: id * 10 + 2, username: `reviewer_${id}`, name: `Reviewer ${id}` },
  ],
  source_project_id: 1,
  target_project_id: 1,
  labels: ["test", `mr-${id}`],
  work_in_progress: false,
  milestone: null,
  merge_when_pipeline_succeeds: false,
  merge_status: "can_be_merged",
  merge_error: null,
  sha: `mock-sha-${id}`,
  merge_commit_sha: null,
  squash_commit_sha: null,
  discussion_locked: null,
  should_remove_source_branch: null,
  force_remove_source_branch: null,
  reference: `!${id}`,
  references: {
    short: `!${id}`,
    relative: `!${id}`,
    full: `group/project!${id}`,
  },
  web_url: `https://gitlab.com/mock/project/-/merge_requests/${id}`,
  time_stats: {
    time_estimate: 0,
    total_time_spent: 0,
    human_time_estimate: null,
    human_total_time_spent: null,
  },
  squash: false,
  task_completion_status: { count: 0, completed_count: 0 },
  has_conflicts: false,
  blocking_discussions_resolved: true,
});

const mockItems = [
  createMockMR(
    1,
    "B Test MR",
    "charlie",
    "2024-03-01T10:00:00Z",
    "2024-03-10T11:00:00Z"
  ),
  createMockMR(
    2,
    "A Test MR",
    "alice",
    "2024-03-05T10:00:00Z",
    "2024-03-08T11:00:00Z"
  ),
  createMockMR(
    3,
    "C Test MR",
    "bob",
    "2024-02-28T10:00:00Z",
    "2024-03-12T11:00:00Z"
  ),
];

describe("MRTable", () => {
  const mockOnPageChange = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders table title, headers, and items", () => {
    render(
      <MRTable
        title="Test MRs"
        items={mockItems.slice(0, 2)} // Simulate pagination limit
        isLoading={false}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Test MRs" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /author/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /created/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /updated/i })
    ).toBeInTheDocument();

    // Check for specific item content (adjust based on actual rendering)
    expect(screen.getByText("B Test MR")).toBeInTheDocument();
    expect(screen.getByText("charlie")).toBeInTheDocument(); // Author username
    expect(screen.getByText("assignee_1")).toBeInTheDocument();
    expect(screen.getByText("reviewer_1")).toBeInTheDocument();
    // Use getAllByText and check length or first element
    expect(screen.getAllByText(/Created .* ago/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Updated .* ago/)[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /view/i })[0]).toHaveAttribute(
      "href",
      "https://gitlab.com/mock/project/-/merge_requests/1"
    );
  });

  it("shows loading state", () => {
    render(
      <MRTable
        title="Loading..."
        items={[]}
        isLoading={true}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    // Check for loader presence inside TableCell
    expect(screen.getByRole("cell")).toContainElement(
      screen.getByRole("status")
    );
    expect(
      screen.queryByText("No merge requests found")
    ).not.toBeInTheDocument();
  });

  it("shows error message", () => {
    const errorMsg = "Failed to load data.";
    render(
      <MRTable
        title="Error"
        items={[]}
        isLoading={false}
        error={errorMsg}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(errorMsg)).toBeInTheDocument();
    // Table structure might still render, but body should be empty or show error row
    expect(
      screen.queryByRole("row", { name: /B Test MR/i })
    ).not.toBeInTheDocument();
  });

  it("shows empty state when no items and not loading", () => {
    render(
      <MRTable
        title="Empty"
        items={[]}
        isLoading={false}
        metadata={{ ...mockMetadataBase, totalItems: 0, totalPages: 1 }}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText("No merge requests found")).toBeInTheDocument();
    // Ensure pagination doesn't show unnecessary controls
    expect(
      screen.queryByRole("navigation", { name: /pagination/i })
    ).not.toBeInTheDocument(); // Or check if controls are disabled/hidden
  });

  it("handles sorting correctly", () => {
    render(
      <MRTable
        title="Sortable"
        items={mockItems.slice(0, 2)}
        isLoading={false}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    const titleButton = screen.getByRole("button", { name: /title/i });
    const authorButton = screen.getByRole("button", { name: /author/i });
    const createdButton = screen.getByRole("button", { name: /created/i });

    // Initial sort should be author asc (alice before charlie)
    let rows = screen.getAllByRole("row"); // Includes header row
    expect(within(rows[1]).getByText("A Test MR")).toBeInTheDocument(); // Row 1 is first data row

    // Sort by Title Asc
    fireEvent.click(titleButton);
    rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("A Test MR")).toBeInTheDocument();

    // Sort by Title Desc
    fireEvent.click(titleButton);
    rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("B Test MR")).toBeInTheDocument();

    // Sort by Author Asc
    fireEvent.click(authorButton);
    rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("alice")).toBeInTheDocument();

    // Sort by Created Asc (oldest first)
    fireEvent.click(createdButton);
    rows = screen.getAllByRole("row");
    // Assuming MR 1 was created first based on mock data dates
    expect(within(rows[1]).getByText("B Test MR")).toBeInTheDocument(); // MR 1
  });

  it("handles pagination correctly", () => {
    render(
      <MRTable
        title="Paginated"
        items={mockItems.slice(0, 2)} // Page 1 items
        isLoading={false}
        metadata={mockMetadataBase} // totalPages = 3
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    const nextButton = screen.getByRole("link", { name: /go to next page/i });
    const prevButton = screen.getByRole("link", {
      name: /go to previous page/i,
    });
    const page2Link = screen.getByRole("link", { name: "2" }); // Use exact number

    // Initial state: Prev disabled, Next enabled
    expect(prevButton).toHaveClass("pointer-events-none", "opacity-50");
    expect(nextButton).not.toHaveClass("pointer-events-none", "opacity-50");

    // Go to page 2
    fireEvent.click(nextButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(2);

    // Simulate re-render with page 2 data
    render(
      <MRTable
        title="Paginated"
        items={mockItems.slice(2, 4)} // Page 2 items
        isLoading={false}
        metadata={{ ...mockMetadataBase, currentPage: 2 }}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );
    expect(prevButton).not.toHaveClass("pointer-events-none", "opacity-50");
    expect(nextButton).not.toHaveClass("pointer-events-none", "opacity-50"); // Still more pages

    // Click specific page link
    fireEvent.click(page2Link); // Already on page 2, but test the click
    expect(mockOnPageChange).toHaveBeenCalledWith(2);

    // Go to last page
    fireEvent.click(screen.getByRole("link", { name: "3" })); // Use exact number
    expect(mockOnPageChange).toHaveBeenCalledWith(3);

    // Simulate re-render with page 3 data
    render(
      <MRTable
        title="Paginated"
        items={mockItems.slice(4, 6)} // Page 3 items
        isLoading={false}
        metadata={{ ...mockMetadataBase, currentPage: 3 }}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );
    expect(prevButton).not.toHaveClass("pointer-events-none", "opacity-50");
    expect(nextButton).toHaveClass("pointer-events-none", "opacity-50"); // Next should be disabled
  });

  it("calls onRefresh when refresh button is clicked", () => {
    render(
      <MRTable
        title="Refreshable"
        items={mockItems.slice(0, 2)}
        isLoading={false}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshButton);
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh button when loading", () => {
    render(
      <MRTable
        title="Loading Refresh"
        items={[]}
        isLoading={true}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );
    const refreshButton = screen.getByRole("button", { name: "" }); // Name is empty because only icon shows
    expect(refreshButton).toHaveAttribute("disabled");
  });

  it("displays threshold and last refreshed time", () => {
    render(
      <MRTable
        title="Metadata"
        items={[]}
        isLoading={false}
        metadata={mockMetadataBase}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );
    expect(screen.getByText(/Threshold: 28 days/i)).toBeInTheDocument();
    // Check for date part, time might vary based on locale
    expect(screen.getByText(/Last refreshed: 2024-03-15/i)).toBeInTheDocument();
  });
});
