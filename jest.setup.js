// File: src/test/setup.ts
import "@testing-library/jest-dom";
import { jest } from "@jest/globals";

// --- Mock Environment Variables ---
// Set default environment variables for tests if needed
process.env.NEXT_PUBLIC_GITLAB_GROUP_ID = "mock-group-id";
process.env.GITLAB_USER_IDS = "1:2:3"; // Example default team
process.env.API_KEY = "test-api-key";
process.env.JIRA_HOST = "mock.atlassian.net";
process.env.JIRA_EMAIL = "test@example.com";
process.env.JIRA_API_TOKEN = "test-jira-token";
// Add other env vars used by config/services if necessary

// --- Mock `next/navigation` ---
// Keep existing mocks, ensure they cover necessary functions
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/dashboard", // Default mock path
  useSearchParams: () => new URLSearchParams(), // Mock search params
}));

// --- Mock `next/dynamic` ---
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (fn: () => Promise<any>) => {
    let component: React.ComponentType | null = null;
    // Eagerly load the component in tests
    fn().then((mod) => {
      component = mod.default || mod;
    });
    // Return a placeholder that renders the loaded component
    const DynamicComponent = (props: any) => {
      if (!component) {
        // You might want a loading state or null during the brief async load
        return null;
      }
      return React.createElement(component, props);
    };
    DynamicComponent.displayName = "DynamicComponentMock";
    return DynamicComponent;
  },
}));

// --- Mock `next-nprogress-bar` ---
// Mock is in __mocks__ directory, this ensures it's picked up.
// If not using the __mocks__ dir, mock it here:
// jest.mock('next-nprogress-bar', () => ({
//   AppProgressBar: () => null,
// }));

// --- Mock `sonner` ---
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    message: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// --- Mock `logger` ---
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  // Mock measurePerformance to just execute the function
  measurePerformance: jest.fn(
    async (name: string, fn: () => Promise<any>) => await fn()
  ),
}));

// --- Mock Feature Flags ---
// Default to enabling all features for most tests, override in specific tests if needed
jest.mock("@/services/FeatureFlags", () => ({
  FeatureFlags: {
    isEnabled: jest.fn((flag) => true), // Default to true
    getAllFlags: jest.fn(() => ({
      roleBased: true,
      poView: true,
      devView: true,
      teamView: true,
      jiraIntegration: true,
    })),
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    setFlag: jest.fn(),
    resetToDefaults: jest.fn(),
  },
  FeatureFlag: {
    ROLE_BASED_VIEWS: "roleBased",
    PO_VIEW: "poView",
    DEV_VIEW: "devView",
    TEAM_VIEW: "teamView",
    JIRA_INTEGRATION: "jiraIntegration",
  },
}));

// --- Mock Data Fetching Hooks ---
// Mock the central hook and its variants. Adjust return values in specific tests.
const mockRefetch = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/useUnifiedMRData", () => ({
  useUnifiedMRData: jest.fn(() => ({
    data: null,
    isLoading: true,
    isError: false,
    error: null,
    lastRefreshed: undefined,
    refetch: mockRefetch,
  })),
  // Also mock the specialized hooks if they are imported directly
  usePOViewData: jest.fn(() => ({
    data: [], // Default to empty array for PO view
    isLoading: true,
    isError: false,
    error: null,
    lastRefreshed: undefined,
    refetch: mockRefetch,
  })),
  useDevViewData: jest.fn(() => ({
    data: [], // Default to empty array for Dev view
    isLoading: true,
    isError: false,
    error: null,
    lastRefreshed: undefined,
    refetch: mockRefetch,
  })),
  useTeamViewData: jest.fn(() => ({
    data: [], // Default to empty array for Team view
    isLoading: true,
    isError: false,
    error: null,
    lastRefreshed: undefined,
    refetch: mockRefetch,
  })),
  useHygieneViewData: jest.fn(() => ({
    data: { items: [], metadata: { currentPage: 1, totalPages: 1 } }, // Default for hygiene
    isLoading: true,
    isError: false,
    error: null,
    lastRefreshed: undefined,
    refetch: mockRefetch,
  })),
  MRDataType: {
    TOO_OLD: "tooOldMRs",
    NOT_UPDATED: "notUpdatedMRs",
    PENDING_REVIEW: "pendingReviewMRs",
    ALL_MRS: "allMRs",
    MRS_WITH_JIRA: "mrsWithJira",
    JIRA_TICKETS: "jiraTickets",
    JIRA_WITH_MRS: "jiraWithMRs",
  },
}));

// --- Mock `useKeyboardShortcut` ---
jest.mock("@/hooks/useKeyboardShortcut", () => ({
  useKeyboardShortcut: jest.fn(),
}));

// --- Mock `useGitLabUsers` ---
const mockAddUser = jest.fn();
const mockRemoveUser = jest.fn();
const mockFetchUsersByGroup = jest.fn().mockResolvedValue(undefined);
const mockSearchUsers = jest.fn().mockResolvedValue(undefined);
const mockResetToTeamUsers = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/useGitLabUsers", () => ({
  useGitLabUsers: jest.fn(() => ({
    teamUsers: [{ id: 1, name: "Default User", username: "default_user" }], // Example default
    searchedUsers: [],
    isLoadingTeam: false,
    isLoadingSearch: false,
    errorTeam: null,
    errorSearch: null,
    fetchUsersByGroup: mockFetchUsersByGroup,
    searchUsers: mockSearchUsers,
    addUser: mockAddUser,
    removeUser: mockRemoveUser,
    resetToTeamUsers: mockResetToTeamUsers,
    isDefaultTeam: true,
  })),
}));

// --- Mock Browser APIs ---
// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false, // Default to light mode for tests
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated but needed for some libraries
    removeListener: jest.fn(), // Deprecated but needed for some libraries
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// --- Global Settings ---
// Increase timeout if needed, but prefer fixing tests
jest.setTimeout(15000);

// --- Utility Functions for Tests ---
// Example: Helper to wrap components in necessary providers
// import React from 'react';
// import { ThemeProviderClient } from '@/components/ThemeProviderClient';
// import { LayoutProvider } from '@/contexts/LayoutContext';
// export const renderWithProviders = (ui: React.ReactElement, options?: any) => {
//   return render(
//     <ThemeProviderClient>
//       <LayoutProvider>
//         {ui}
//       </LayoutProvider>
//     </ThemeProviderClient>,
//     options
//   );
// };
