import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardPage from "./page";
import { toast } from "sonner";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock response data
const mockResponse = {
  items: [
    {
      id: 1,
      title: "Test MR",
      author: { id: 1, username: "user1", name: "User 1" },
      assignees: [{ id: 2, username: "assignee1", name: "Assignee 1" }],
      reviewers: [{ id: 3, username: "reviewer1", name: "Reviewer 1" }],
      created_at: "2024-03-01T12:00:00Z",
      updated_at: "2024-03-10T12:00:00Z",
      web_url: "https://gitlab.com/mr/1",
    },
  ],
  metadata: {
    threshold: 28,
    lastRefreshed: new Date().toISOString(),
    currentPage: 1,
    totalPages: 1,
    perPage: 25,
  },
};

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );
  });

  it("renders all three tables", async () => {
    render(<DashboardPage />);

    expect(screen.getByText("Loading Dashboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Old Merge Requests")).toBeInTheDocument();
      expect(screen.getByText("Inactive Merge Requests")).toBeInTheDocument();
      expect(screen.getByText("Pending Review")).toBeInTheDocument();
    });
  });

  it("shows loading state on initial load", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Loading Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("handles refresh all functionality", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Old Merge Requests")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: /refresh all/i });
    fireEvent.click(refreshButton);

    expect(mockFetch).toHaveBeenCalledTimes(6); // 3 initial + 3 refresh
    expect(toast.info).toHaveBeenCalledWith(
      "Refreshing data",
      expect.any(Object)
    );
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
    });
  });

  it("shows keyboard shortcut hint", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/press ctrl\+r to refresh/i)).toBeInTheDocument();
    });
  });

  it("disables refresh button while loading", async () => {
    render(<DashboardPage />);

    const refreshButton = screen.getByRole("button", { name: /refresh all/i });
    expect(refreshButton).toBeDisabled();

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it("shows spinner in refresh button while loading", async () => {
    render(<DashboardPage />);

    const refreshIcon = screen.getByTestId("refresh-icon");
    expect(refreshIcon).toHaveClass("animate-spin");

    await waitFor(() => {
      expect(refreshIcon).not.toHaveClass("animate-spin");
    });
  });
});
