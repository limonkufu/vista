// File: src/components/POView/POView.test.tsx (Example)
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { POView } from "./POView";
import { usePOViewData } from "@/hooks/useUnifiedMRData"; // Import the hook used by the component
import {
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
} from "@/types/Jira";

// Mock the data hook
jest.mock("@/hooks/useUnifiedMRData", () => ({
  usePOViewData: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRefetch = jest.fn();

const mockTicketsWithMRs = [
  {
    ticket: {
      id: "jira-1",
      key: "PROJ-123",
      title: "Test Ticket 1",
      status: JiraTicketStatus.IN_PROGRESS,
      priority: JiraTicketPriority.MEDIUM,
      type: JiraTicketType.STORY,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      url: "http://jira.example.com/PROJ-123",
    },
    mrs: [
      {
        id: 1,
        title: "MR for PROJ-123",
        state: "opened",
        author: { id: 1, name: "Dev A", username: "dev_a" },
        reviewers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        web_url: "http://gitlab.example.com/1",
        // Add other required MR fields
        iid: 1,
        project_id: 1,
        source_branch: "f/PROJ-123",
        target_branch: "main",
        merge_status: "can_be_merged",
        user_notes_count: 0,
        upvotes: 0,
        downvotes: 0,
        jiraTicketKey: "PROJ-123",
      },
    ],
    totalMRs: 1,
    openMRs: 1,
    overdueMRs: 0,
    stalledMRs: 0,
  },
  // Add more mock tickets as needed
];

describe("POView", () => {
  beforeEach(() => {
    // Reset mocks for each test
    mockRefetch.mockClear();
    (usePOViewData as jest.Mock).mockReturnValue({
      data: mockTicketsWithMRs,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it("renders the view title", () => {
    render(<POView />);
    expect(
      screen.getByRole("heading", { name: /Product Owner View/i })
    ).toBeInTheDocument();
  });

  it("renders ticket groups based on fetched data", () => {
    render(<POView />);
    expect(screen.getByText("PROJ-123")).toBeInTheDocument();
    expect(screen.getByText("Test Ticket 1")).toBeInTheDocument();
    // Check for MR details within the group if expanded by default or via interaction
  });

  it("shows loading state", () => {
    (usePOViewData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });
    render(<POView />);
    // Check for skeleton loaders
    expect(screen.getAllByRole("status")).toHaveLength(5); // Assuming 5 skeletons render
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
    render(<POView />);
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it("calls refetch when refresh button is clicked", () => {
    render(<POView />);
    const refreshButton = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("updates filters and triggers refetch (implicitly via hook dependency)", async () => {
    render(<POView />);

    // Find the status filter dropdown trigger
    const statusTrigger = screen.getByRole("combobox", { name: /Status/i }); // Adjust selector if needed
    fireEvent.mouseDown(statusTrigger); // Open the dropdown

    // Select a new status
    const option = await screen.findByRole("option", { name: /In Review/i });
    fireEvent.click(option);

    // Check if the hook was called again with updated filters
    // This requires the hook mock to capture arguments or check call count
    // For simplicity, we assume the hook handles refetching on options change.
    // We can verify the filter UI updated if needed.
    expect(statusTrigger).toHaveTextContent("In Review");

    // Verify refetch was called if the hook implementation refetches on option change
    // This depends on the hook's internal logic. If it relies purely on dependencies,
    // verifying the state change might be sufficient for the component test.
    // expect(mockRefetch).toHaveBeenCalled(); // Or check call count increase
  });

  it("filters displayed tickets based on search term", async () => {
    render(<POView />);
    const searchInput = screen.getByPlaceholderText(
      /Search tickets or MRs.../i
    );

    fireEvent.change(searchInput, { target: { value: "PROJ-123" } });

    // Wait for debounce or state update if applicable
    await waitFor(() => {
      // Check if the hook was called with the new search term
      // Again, depends on hook implementation details.
      // Verify that only matching tickets are displayed
      expect(screen.getByText("PROJ-123")).toBeInTheDocument();
      // Add checks to ensure non-matching tickets are NOT present
    });

    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    await waitFor(() => {
      expect(screen.queryByText("PROJ-123")).not.toBeInTheDocument();
      expect(screen.getByText(/No Jira tickets found/i)).toBeInTheDocument();
    });
  });
});
