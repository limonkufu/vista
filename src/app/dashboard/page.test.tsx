// File: src/app/dashboard/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";
import { LayoutProvider } from "@/contexts/LayoutContext"; // Wrap with provider
import { FeatureFlags } from "@/services/FeatureFlags"; // Mock feature flags

// Mock FeatureFlags
jest.mock("@/services/FeatureFlags", () => ({
  FeatureFlags: {
    isEnabled: jest.fn((flag) => {
      // Enable role-based views for testing previews
      if (
        flag === "roleBased" ||
        flag === "poView" ||
        flag === "devView" ||
        flag === "teamView"
      ) {
        return true;
      }
      return false;
    }),
  },
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => "/dashboard", // Mock pathname
}));

describe("DashboardPage (Landing)", () => {
  beforeEach(() => {
    // Reset mocks if needed
    (FeatureFlags.isEnabled as jest.Mock).mockClear();
  });

  it("renders the main title and description", async () => {
    render(
      <LayoutProvider>
        <DashboardPage />
      </LayoutProvider>
    );

    // Wait for client-side rendering to complete
    await waitFor(() => {
      expect(screen.getByText("GitLab MR Dashboard")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Monitor and analyze GitLab merge requests for team hygiene/i
      )
    ).toBeInTheDocument();
  });

  it("renders links/cards for the hygiene categories", async () => {
    render(
      <LayoutProvider>
        <DashboardPage />
      </LayoutProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("Old Merge Requests")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /View Old MRs/i })).toHaveAttribute(
      "href",
      "/dashboard/too-old"
    );
    expect(
      screen.getByRole("link", { name: /View Inactive MRs/i })
    ).toHaveAttribute("href", "/dashboard/not-updated");
    expect(
      screen.getByRole("link", { name: /View Pending Reviews/i })
    ).toHaveAttribute("href", "/dashboard/pending-review");
  });

  it("renders preview cards for role-based views when enabled", async () => {
    // FeatureFlags mock already enables these
    render(
      <LayoutProvider>
        <DashboardPage />
      </LayoutProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("Role-Based Views")).toBeInTheDocument();
    });
    expect(screen.getByText("PO View")).toBeInTheDocument();
    expect(screen.getByText("Dev View")).toBeInTheDocument();
    expect(screen.getByText("Team View")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open PO View/i })
    ).toBeInTheDocument();
    // Add checks for Dev and Team view buttons/links as well
  });

  it("does NOT render preview cards for role-based views when disabled", async () => {
    // Disable role-based views for this test
    (FeatureFlags.isEnabled as jest.Mock).mockImplementation(
      (flag) => flag !== "roleBased" // Disable the main flag
    );

    render(
      <LayoutProvider>
        <DashboardPage />
      </LayoutProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("GitLab MR Dashboard")).toBeInTheDocument(); // Ensure page loaded
    });

    expect(screen.queryByText("Role-Based Views")).not.toBeInTheDocument();
    expect(screen.queryByText("PO View")).not.toBeInTheDocument();
    // Add checks for Dev and Team views as well
  });
});
