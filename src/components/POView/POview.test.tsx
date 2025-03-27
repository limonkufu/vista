// File: src/components/POView/POView.test.tsx
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { POView } from "@/components/POView/POView"; // Adjust path
import { usePOViewData } from "@/hooks/useUnifiedMRData"; // Import the hook used by the component
import { LayoutProvider } from "@/contexts/LayoutContext"; // Import LayoutProvider
import { ThemeProviderClient } from "@/components/ThemeProviderClient"; // Import ThemeProvider
import {
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
  JiraTicketWithMRs,
} from "@/types/Jira"; // Adjust path

// --- Mock Data ---
const mockRefetch = jest.fn().mockResolvedValue(undefined);

const createMockTicketWithMRs = (
  id: number,
  status: JiraTicketStatus
): JiraTicketWithMRs => ({
  ticket: {
    id: `jira-${id}`,
    key: `PROJ-${id}`,
    title: `Test Ticket ${id}`,
    status: status,
    priority: JiraTicketPriority.MEDIUM,
    type: JiraTicketType.STORY,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    url: `http://jira.example.com/PROJ-${id}`,
    storyPoints: 3,
    assignee: { id: `user-${id}`, name: `Assignee ${id}` },
  },
  mrs: [
    {
      id: id * 100 + 1,
      iid: id * 100 + 1,
      project_id: 1,
      title: `MR for PROJ-${id}`,
      state: "opened",
      author: { id: 1, name: "Dev A", username: "dev_a" },
      reviewers: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      web_url: `http://gitlab.example.com/${id * 100 + 1}`,
      source_branch: `f/PROJ-${id}`,
      target_branch: "main",
      merge_status: "can_be_merged",
      user_notes_count: 0,
      upvotes: 0,
      downvotes: 0,
      jiraTicketKey: `PROJ-${id}`,
      // Add other required MR fields from GitLabMRWithJira
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
      sha: "mock-sha",
      merge_commit_sha: null,
      squash_commit_sha: null,
      discussion_locked: null,
      should_remove_source_branch: null,
      force_remove_source_branch: null,
      reference: "!1",
      references: { short: "!1", relative: "!1", full: "proj!1" },
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
  totalMRs: 1,
  openMRs: 1,
  overdueMRs: 0,
  stalledMRs: 0,
});

const mockTicketsData = [
  createMockTicketWithMRs(123, JiraTicketStatus.IN_PROGRESS),
  createMockTicketWithMRs(124, JiraTicketStatus.IN_REVIEW),
  createMockTicketWithMRs(125, JiraTicketStatus.DONE),
];

// --- Mock Hook ---
// Mock the specific hook used by POView
jest.mock("@/hooks/useUnifiedMRData", () => ({
  // Keep the enum export if it's used elsewhere
  MRDataType: {
    TOO_OLD: "tooOldMRs",
    NOT_UPDATED: "notUpdatedMRs",
    PENDING_REVIEW: "pendingReviewMRs",
    ALL_MRS: "allMRs",
    MRS_WITH_JIRA: "mrsWithJira",
    JIRA_TICKETS: "jiraTickets",
    JIRA_WITH_MRS: "jiraWithMRs",
  },
  // Mock the specific hook
  usePOViewData: jest.fn(),
}));

// --- Test Suite ---
describe("POView", () => {
  // Helper to render with providers
  const renderPOView = () => {
    return render(
      <ThemeProviderClient>
        <LayoutProvider>
          <POView />
        </LayoutProvider>
      </ThemeProviderClient>
    );
  };

  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    // Default mock implementation for usePOViewData
    (usePOViewData as jest.Mock).mockReturnValue({
      data: mockTicketsData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it("renders the view title", () => {
    renderPOView();
    expect(
      screen.getByRole("heading", { name: /Product Owner View/i })
    ).toBeInTheDocument();
  });

  it("renders ticket groups based on fetched data", () => {
    renderPOView();
    expect(screen.getByText("PROJ-123")).toBeInTheDocument();
    expect(screen.getByText("Test Ticket 123")).toBeInTheDocument();
    expect(screen.getByText("PROJ-124")).toBeInTheDocument();
    expect(screen.getByText("Test Ticket 124")).toBeInTheDocument();
    // Check for status badges
    expect(screen.getByText(JiraTicketStatus.IN_PROGRESS)).toBeInTheDocument();
    expect(screen.getByText(JiraTicketStatus.IN_REVIEW)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    (usePOViewData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
    renderPOView();
    // Check for skeleton loaders (adjust count/selector based on implementation)
    expect(screen.getAllByRole("status")).toHaveLength(5); // Assuming 5 skeletons render
    expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument(); // Data shouldn't be visible
  });

  it("shows error state", () => {
    const errorMsg = "Failed to load tickets";
    (usePOViewData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error(errorMsg),
      refetch: mockRefetch,
    });
    renderPOView();
    // Check for error message display (adjust selector if needed)
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
    expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument(); // Data shouldn't be visible
  });

  it("calls refetch when refresh button is clicked", () => {
    renderPOView();
    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    // Check if skipCache: true was passed (if the mock captures args)
    expect(mockRefetch).toHaveBeenCalledWith({ skipCache: true });
  });

  it("filters displayed tickets based on search term (client-side)", async () => {
    renderPOView();
    const searchInput = screen.getByPlaceholderText(
      /Search tickets \(key, title\) or MRs.../i
    );

    // Search for a specific ticket key
    fireEvent.change(searchInput, { target: { value: "PROJ-123" } });

    await waitFor(() => {
      expect(screen.getByText("PROJ-123")).toBeInTheDocument();
      expect(screen.queryByText("PROJ-124")).not.toBeInTheDocument();
      expect(screen.queryByText("PROJ-125")).not.toBeInTheDocument();
    });

    // Search for part of a title
    fireEvent.change(searchInput, { target: { value: "Ticket 124" } });

    await waitFor(() => {
      expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument();
      expect(screen.getByText("PROJ-124")).toBeInTheDocument();
      expect(screen.queryByText("PROJ-125")).not.toBeInTheDocument();
    });

    // Search for something not present
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    await waitFor(() => {
      expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument();
      expect(screen.queryByText("PROJ-124")).not.toBeInTheDocument();
      expect(
        screen.getByText(/No Jira tickets found matching your criteria./i)
      ).toBeInTheDocument();
    });
  });

  it("filters displayed tickets based on status dropdown (client-side)", async () => {
    renderPOView();

    // Find the status filter dropdown trigger
    const statusTrigger = screen.getByRole("combobox", { name: /Status/i });
    fireEvent.mouseDown(statusTrigger); // Open the dropdown

    // Select 'In Review' status
    const option = await screen.findByRole("option", { name: /In Review/i });
    fireEvent.click(option);

    // Check that only 'In Review' tickets are visible
    await waitFor(() => {
      expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument(); // Was In Progress
      expect(screen.getByText("PROJ-124")).toBeInTheDocument(); // Is In Review
      expect(screen.queryByText("PROJ-125")).not.toBeInTheDocument(); // Was Done
    });

    // Select 'All Statuses' again
    fireEvent.mouseDown(statusTrigger);
    const allOption = await screen.findByRole("option", {
      name: /All Statuses/i,
    });
    fireEvent.click(allOption);

    // Check that all tickets are visible again
    await waitFor(() => {
      expect(screen.getByText("PROJ-123")).toBeInTheDocument();
      expect(screen.getByText("PROJ-124")).toBeInTheDocument();
      expect(screen.getByText("PROJ-125")).toBeInTheDocument();
    });
  });

  it("expands and collapses ticket groups", async () => {
    renderPOView();

    const ticketGroup123 = screen
      .getByText("PROJ-123")
      .closest("div[role='button']"); // Find the trigger element more reliably
    const ticketGroup124 = screen
      .getByText("PROJ-124")
      .closest("div[role='button']");

    expect(ticketGroup123).toBeInTheDocument();
    expect(ticketGroup124).toBeInTheDocument();

    // Initially collapsed, MR details should not be visible
    expect(screen.queryByText(/MR for PROJ-123/i)).not.toBeInTheDocument();

    // Expand the first group
    if (ticketGroup123) {
      fireEvent.click(ticketGroup123);
    }

    // Wait for MR details to appear
    await waitFor(() => {
      expect(screen.getByText(/MR for PROJ-123/i)).toBeInTheDocument();
    });

    // Other group should still be collapsed
    expect(screen.queryByText(/MR for PROJ-124/i)).not.toBeInTheDocument();

    // Collapse the first group again
    if (ticketGroup123) {
      fireEvent.click(ticketGroup123);
    }

    // Wait for MR details to disappear
    await waitFor(() => {
      expect(screen.queryByText(/MR for PROJ-123/i)).not.toBeInTheDocument();
    });
  });

  // Add tests for sorting if implemented client-side
  it("sorts tickets correctly", async () => {
    renderPOView();
    const sortTrigger = screen.getByRole("combobox", { name: /Sort By/i });

    // Default sort is Key Asc (PROJ-123, PROJ-124, PROJ-125)
    let ticketElements = screen.getAllByText(/PROJ-\d+/);
    expect(ticketElements[0]).toHaveTextContent("PROJ-123");
    expect(ticketElements[1]).toHaveTextContent("PROJ-124");

    // Sort by Key Desc
    fireEvent.mouseDown(sortTrigger);
    await screen.findByRole("option", { name: /Sort: Key/i }); // Wait for options
    fireEvent.click(screen.getByRole("option", { name: /Sort: Key/i })); // Select Key again (if needed)
    fireEvent.click(screen.getByRole("button", { name: /Sort Direction/i })); // Toggle direction

    await waitFor(() => {
      ticketElements = screen.getAllByText(/PROJ-\d+/);
      expect(ticketElements[0]).toHaveTextContent("PROJ-125");
      expect(ticketElements[1]).toHaveTextContent("PROJ-124");
    });

    // Sort by Status Asc
    fireEvent.mouseDown(sortTrigger);
    fireEvent.click(
      await screen.findByRole("option", { name: /Sort: Status/i })
    );
    // Ensure direction is Asc
    if (
      screen
        .getByRole("button", { name: /Sort Direction/i })
        .getAttribute("aria-label")
        ?.includes("desc")
    ) {
      fireEvent.click(screen.getByRole("button", { name: /Sort Direction/i }));
    }

    await waitFor(() => {
      ticketElements = screen.getAllByText(/PROJ-\d+/);
      // Order should be Done, In Progress, In Review
      expect(ticketElements[0]).toHaveTextContent("PROJ-125"); // Done
      expect(ticketElements[1]).toHaveTextContent("PROJ-123"); // In Progress
      expect(ticketElements[2]).toHaveTextContent("PROJ-124"); // In Review
    });
  });
});
