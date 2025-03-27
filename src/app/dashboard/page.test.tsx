// File: src/app/dashboard/page.test.tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page"; // Adjust path
import { LayoutProvider } from "@/contexts/LayoutContext"; // Wrap with provider
import { ThemeProviderClient } from "@/components/ThemeProviderClient"; // Wrap with provider
import { FeatureFlags } from "@/services/FeatureFlags"; // Mock feature flags
import { mockFeatureFlag } from "@/test/test-utils";

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
    jest.clearAllMocks();
    // Default: Enable role-based views for testing previews
    mockFeatureFlag(true);
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
    renderDashboardPage();
    await waitFor(() => {
      expect(screen.getByText("PO View")).toBeInTheDocument();
      expect(screen.getByText("Dev View")).toBeInTheDocument();
      expect(screen.getByText("Team View")).toBeInTheDocument();
    });
  });

  it("does NOT render preview cards for role-based views when disabled", async () => {
    // Disable role-based views
    mockFeatureFlag(false);

    renderDashboardPage();
    await waitFor(() => {
      expect(screen.queryByText("PO View")).not.toBeInTheDocument();
      expect(screen.queryByText("Dev View")).not.toBeInTheDocument();
      expect(screen.queryByText("Team View")).not.toBeInTheDocument();
    });
  });
});
