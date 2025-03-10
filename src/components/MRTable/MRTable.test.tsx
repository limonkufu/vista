import { render, screen, fireEvent } from "@testing-library/react";
import { MRTable } from "./MRTable";
import { GitLabMR } from "@/lib/gitlab";

// Mock data
const mockMetadata = {
  threshold: 28,
  lastRefreshed: "2024-03-15T12:00:00Z",
  currentPage: 1,
  totalPages: 3,
  perPage: 25,
};

const createMockMR = (id: number): GitLabMR => ({
  id,
  title: `Test MR ${id}`,
  author: { id: 1, username: `user${id}`, name: `User ${id}` },
  assignees: [{ id: 2, username: `assignee${id}`, name: `Assignee ${id}` }],
  reviewers: [{ id: 3, username: `reviewer${id}`, name: `Reviewer ${id}` }],
  created_at: "2024-03-01T12:00:00Z",
  updated_at: "2024-03-10T12:00:00Z",
  web_url: `https://gitlab.com/mr/${id}`,
  // Add other required fields with default values
  iid: id,
  project_id: 1,
  description: "",
  state: "opened",
  merged_at: null,
  closed_at: null,
  target_branch: "main",
  source_branch: `feature/${id}`,
  user_notes_count: 0,
  upvotes: 0,
  downvotes: 0,
  assignee: null,
  source_project_id: 1,
  target_project_id: 1,
  labels: [],
  work_in_progress: false,
  milestone: null,
  merge_when_pipeline_succeeds: false,
  merge_status: "can_be_merged",
  merge_error: null,
  sha: "",
  merge_commit_sha: null,
  squash_commit_sha: null,
  discussion_locked: null,
  should_remove_source_branch: null,
  force_remove_source_branch: null,
  reference: "",
  references: { short: "", relative: "", full: "" },
  time_stats: {
    time_estimate: 0,
    total_time_spent: 0,
    human_time_estimate: null,
    human_total_time_spent: null,
  },
  squash: false,
  task_completion_status: {
    count: 0,
    completed_count: 0,
  },
  has_conflicts: false,
  blocking_discussions_resolved: true,
});

describe("MRTable", () => {
  const mockOnPageChange = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders table with items", () => {
    const items = [createMockMR(1), createMockMR(2)];
    render(
      <MRTable
        title="Test Table"
        items={items}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText("Test Table")).toBeInTheDocument();
    expect(screen.getByText("Test MR 1")).toBeInTheDocument();
    expect(screen.getByText("Test MR 2")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <MRTable
        title="Test Table"
        items={[]}
        isLoading={true}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows error message", () => {
    const error = "Test error message";
    render(
      <MRTable
        title="Test Table"
        items={[]}
        isLoading={false}
        error={error}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it("handles sorting by different columns", () => {
    const items = [
      {
        ...createMockMR(1),
        title: "B Test",
        author: { ...createMockMR(1).author, username: "userB" },
      },
      {
        ...createMockMR(2),
        title: "A Test",
        author: { ...createMockMR(2).author, username: "userA" },
      },
    ];

    render(
      <MRTable
        title="Test Table"
        items={items}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    // Test title sorting
    fireEvent.click(screen.getByText("Title"));
    let cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("A Test");

    // Test author sorting
    fireEvent.click(screen.getByText("Author"));
    cells = screen.getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("userA");
  });

  it("handles pagination", () => {
    render(
      <MRTable
        title="Test Table"
        items={[createMockMR(1)]}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    // Test next page
    fireEvent.click(screen.getByLabelText("Go to next page"));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);

    // Test previous page
    fireEvent.click(screen.getByLabelText("Go to previous page"));
    expect(mockOnPageChange).toHaveBeenCalledWith(0);

    // Test specific page
    fireEvent.click(screen.getByText("2"));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it("handles refresh", () => {
    render(
      <MRTable
        title="Test Table"
        items={[createMockMR(1)]}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByText("Refresh"));
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it("shows empty state when no items", () => {
    render(
      <MRTable
        title="Test Table"
        items={[]}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText("No merge requests found")).toBeInTheDocument();
  });

  it("disables refresh button when loading", () => {
    render(
      <MRTable
        title="Test Table"
        items={[]}
        isLoading={true}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    expect(refreshButton).toBeDisabled();
  });

  it("formats dates correctly", () => {
    const items = [createMockMR(1)];
    render(
      <MRTable
        title="Test Table"
        items={items}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    expect(
      screen.getByText(new Date("2024-03-01T12:00:00Z").toLocaleDateString())
    ).toBeInTheDocument();
    expect(
      screen.getByText(new Date("2024-03-10T12:00:00Z").toLocaleDateString())
    ).toBeInTheDocument();
  });

  it("renders external links correctly", () => {
    const items = [createMockMR(1)];
    render(
      <MRTable
        title="Test Table"
        items={items}
        isLoading={false}
        metadata={mockMetadata}
        onPageChange={mockOnPageChange}
        onRefresh={mockOnRefresh}
      />
    );

    const link = screen.getByText("View");
    expect(link).toHaveAttribute("href", "https://gitlab.com/mr/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
