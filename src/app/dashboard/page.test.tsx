// File: src/app/dashboard/page.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page"; // Adjust path
import { LayoutProvider } from "@/contexts/LayoutContext"; // Wrap with provider
import { ThemeProviderClient } from "@/components/ThemeProviderClient"; // Wrap with provider
import { FeatureFlags } from "@/services/FeatureFlags"; // Mock feature flags

// Mock FeatureFlags (already done in setup.ts, but explicit here for clarity)
jest.mock("@/services/FeatureFlags");

// Mock next/navigation (already done in setup.ts)
// jest.mock('next/navigation', () => ({
//   useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
//   usePathname: () => '/dashboard',
// }));

// Mock config
jest.mock("@/lib/config", () => ({
  getThresholds: () => ({
    TOO_OLD_THRESHOLD: 28,
    NOT_UPDATED_THRESHOLD: 14,
    PENDING_REVIEW_THRESHOLD: 7,
  }),
}));

describe("DashboardPage (Landing)", () => {
  // Helper to render with providers
  const renderDashboardPage = () => {
    return render(
      <ThemeProviderClient>
        <LayoutProvider>
          <DashboardPage />
        </LayoutProvider>
      </ThemeProviderClient>
    );
  };

  beforeEach(() => {
    // Reset mocks if needed
    (FeatureFlags.isEnabled as jest.Mock).mockClear();
    // Default: Enable role-based views for testing previews
    (FeatureFlags.isEnabled as jest.Mock).mockImplementation((flag) => true);
  });

  it("renders the main title and description", async () => {
    renderDashboardPage();

    // Wait for client-side rendering and potential effects
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Vibe Into Software Tasks & Activities/i,
        })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Transform your workflow with context-aware project management/i
      )
    ).toBeInTheDocument();
  });

  it("renders cards/links for the hygiene categories", async () => {
    renderDashboardPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Old Merge Requests" })
      ).toBeInTheDocument();
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
    // FeatureFlags mock already enables these by default in beforeEach
    renderDashboardPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Role-Based Views" })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("PO View")).toBeInTheDocument();
    expect(screen.getByText("Dev View")).toBeInTheDocument();
    expect(screen.getByText("Team View")).toBeInTheDocument();
    // Check for the buttons within the preview cards
    expect(
      screen.getByRole("button", { name: /Open PO View/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open Dev View/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open Team View/i })
    ).toBeInTheDocument();
  });

  it("does NOT render preview cards for role-based views when disabled", async () => {
    // Disable role-based views for this test
    (FeatureFlags.isEnabled as jest.Mock).mockImplementation(
      (flag) => flag !== FeatureFlags.ROLE_BASED_VIEWS // Disable the main flag
    );

    renderDashboardPage();
    await waitFor(() => {
      // Ensure main content loaded
      expect(
        screen.getByRole("heading", { name: "Old Merge Requests" })
      ).toBeInTheDocument();
    });

    // Check that role-based section and previews are NOT present
    expect(
      screen.queryByRole("heading", { name: "Role-Based Views" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("PO View")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open PO View/i })
    ).not.toBeInTheDocument();
    // Add checks for Dev and Team views as well
    expect(screen.queryByText("Dev View")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open Dev View/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Team View")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open Team View/i })
    ).not.toBeInTheDocument();
  });
});
