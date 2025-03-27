// File: src/components/POView/POView.test.tsx
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { POView } from "@/components/POView/POView";
import { usePOViewData } from "@/hooks/useUnifiedMRData";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { ThemeProviderClient } from "@/components/ThemeProviderClient";
import {
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
  JiraTicketWithMRs,
} from "@/types/Jira";
import { jest } from "@jest/globals";

// Mock the custom hook
jest.mock("@/hooks/useUnifiedMRData", () => ({
  usePOViewData: jest.fn(),
}));

const mockTickets: JiraTicketWithMRs[] = [
  {
    ticket: {
      id: "jira-123",
      key: "PROJ-123",
      title: "First ticket",
      status: JiraTicketStatus.IN_PROGRESS,
      priority: JiraTicketPriority.HIGH,
      type: JiraTicketType.TASK,
      url: "http://jira.example.com/PROJ-123",
      created: "2024-03-20T00:00:00Z",
      updated: "2024-03-20T00:00:00Z",
    },
    mrs: [
      {
        id: 1,
        iid: 1,
        project_id: 1,
        title: "MR 1",
        state: "opened",
        created_at: "2024-03-20T00:00:00Z",
        updated_at: "2024-03-20T00:00:00Z",
        web_url: "http://gitlab.example.com/mr/1",
        author: {
          id: 1,
          name: "Test User",
          username: "testuser",
        },
        source_branch: "feature/PROJ-123",
        target_branch: "main",
        merge_status: "can_be_merged",
        user_notes_count: 0,
        upvotes: 0,
        downvotes: 0,
        reviewers: [],
        // Add other required fields from GitLabMRWithJira if needed by MRRow
        description: "MR description",
        merged_at: null,
        closed_at: null,
        assignees: [],
        assignee: null,
        source_project_id: 1,
        target_project_id: 1,
        labels: [],
        work_in_progress: false,
        milestone: null,
        merge_when_pipeline_succeeds: false,
        merge_error: null,
        sha: "mock-sha-1",
        merge_commit_sha: null,
        squash_commit_sha: null,
        discussion_locked: null,
        should_remove_source_branch: null,
        force_remove_source_branch: null,
        reference: "!1",
        references: {
          short: "!1",
          relative: "!1",
          full: "group/project!1",
        },
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
      },
    ],
    openMRs: 1,
    stalledMRs: 0,
    totalMRs: 1,
  },
  // ... add more mock tickets as needed
];

type MockRefetch = jest.MockedFunction<
  (options?: { skipCache?: boolean }) => Promise<void>
>;

describe("POView", () => {
  beforeEach(() => {
    const mockRefetch = jest.fn() as MockRefetch;
    mockRefetch.mockResolvedValue();

    (usePOViewData as jest.Mock).mockReturnValue({
      // Cast to jest.Mock
      data: mockTickets,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it("renders loading state", () => {
    const mockRefetch = jest.fn() as MockRefetch;
    mockRefetch.mockResolvedValue();

    (usePOViewData as jest.Mock).mockReturnValue({
      // Cast to jest.Mock
      data: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<POView />);
    expect(screen.getByText("Product Owner View")).toBeInTheDocument();
    // Add more specific loading state checks if needed
    expect(screen.getAllByTestId("skeleton-card")).toHaveLength(5); // Assuming 5 skeletons render
  });

  it("renders error state", () => {
    const errorMessage = "Failed to fetch data";
    const mockRefetch = jest.fn() as MockRefetch;
    mockRefetch.mockResolvedValue();

    (usePOViewData as jest.Mock).mockReturnValue({
      // Cast to jest.Mock
      data: [],
      isLoading: false,
      isError: true,
      error: new Error(errorMessage),
      refetch: mockRefetch,
    });

    render(<POView />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("renders tickets correctly", async () => {
    render(<POView />);

    // Check if ticket key and title are rendered
    expect(screen.getByText("PROJ-123")).toBeInTheDocument();
    expect(screen.getByText("First ticket")).toBeInTheDocument();
  });

  it("filters displayed tickets based on status dropdown", async () => {
    render(<POView />);

    // Find the status filter dropdown trigger by its text content
    const statusTrigger = screen.getByRole("button", {
      name: /Status/i, // More robust selector
    });
    fireEvent.click(statusTrigger);

    // Wait for and select a status option
    const statusOption = await screen.findByText(JiraTicketStatus.IN_PROGRESS);
    fireEvent.click(statusOption);

    // Verify filtered results - hook should refetch with new options
    // We expect the mock to be called again with updated options
    expect(usePOViewData).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: [JiraTicketStatus.IN_PROGRESS] })
    );
    // Since the mock always returns the same data, we just check if it's still there
    expect(screen.getByText("PROJ-123")).toBeInTheDocument();
  });

  it("filters displayed tickets based on priority dropdown", async () => {
    render(<POView />);

    // Find the priority filter dropdown trigger by its text content
    const priorityTrigger = screen.getByRole("button", {
      name: /Priority/i, // More robust selector
    });
    fireEvent.click(priorityTrigger);

    // Wait for and select a priority option
    const priorityOption = await screen.findByText(JiraTicketPriority.HIGH);
    fireEvent.click(priorityOption);

    // Verify filtered results - hook should refetch
    expect(usePOViewData).toHaveBeenCalledWith(
      expect.objectContaining({ priorities: [JiraTicketPriority.HIGH] })
    );
    expect(screen.getByText("PROJ-123")).toBeInTheDocument();
  });

  it("toggles ticket group expansion", async () => {
    render(<POView />);

    // Find and click the ticket group trigger
    const ticketGroupTrigger = screen
      .getByText("PROJ-123")
      .closest("[role='button']"); // CollapsibleTrigger has role button
    expect(ticketGroupTrigger).toBeInTheDocument();
    fireEvent.click(ticketGroupTrigger!);

    // MR details should be visible within the content area
    const collapsibleContent = screen.getByRole("region"); // CollapsibleContent has role region
    expect(within(collapsibleContent).getByText("MR 1")).toBeInTheDocument();
  });

  it("handles search input", () => {
    render(<POView />);

    const searchInput = screen.getByPlaceholderText(/Search tickets/i);
    fireEvent.change(searchInput, { target: { value: "First" } });

    // Verify search results - hook should refetch
    expect(usePOViewData).toHaveBeenCalledWith(
      expect.objectContaining({ search: "First" })
    );
    expect(screen.getByText("First ticket")).toBeInTheDocument();
  });

  it("handles refresh button click", () => {
    const mockRefetchFn = jest.fn().mockResolvedValue(undefined);
    (usePOViewData as jest.Mock).mockReturnValue({
      data: mockTickets,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchFn, // Use the specific mock function
    });

    render(<POView />);

    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshButton);

    expect(mockRefetchFn).toHaveBeenCalledWith({ skipCache: true });
  });
});
