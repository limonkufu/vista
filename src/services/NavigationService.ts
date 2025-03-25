"use client";

import { useRouter } from "next/navigation";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";

// Type of context that can be shared between views
export interface ViewContext {
  // ID of an MR being viewed
  mrId?: string;
  // ID of a Jira ticket being viewed
  jiraTicketId?: string;
  // Current filter state
  filters?: Record<string, any>;
  // Search query
  searchQuery?: string;
  // Any other context that might be relevant
  [key: string]: any;
}

// Routes for each view type
export const VIEW_ROUTES = {
  [ViewType.HYGIENE]: "/dashboard",
  [ViewType.PO]: "/dashboard/po-view",
  [ViewType.DEV]: "/dashboard/dev-view",
  [ViewType.TEAM]: "/dashboard/team-view",
};

// Storage key for preserving context between views
const CONTEXT_STORAGE_KEY = "gitlab-mrs-dashboard-view-context";

/**
 * Saves the current view context to localStorage
 */
export function saveViewContext(
  viewType: ViewType,
  context: ViewContext
): void {
  if (typeof window === "undefined") return;

  try {
    // Get existing contexts for all views
    const storedContexts = getStoredContexts();

    // Update context for the current view
    storedContexts[viewType] = context;

    // Save back to localStorage
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(storedContexts));
  } catch (error) {
    console.error("Failed to save view context:", error);
  }
}

/**
 * Gets the stored context for a particular view
 */
export function getViewContext(viewType: ViewType): ViewContext {
  if (typeof window === "undefined") return {};

  try {
    const storedContexts = getStoredContexts();
    return storedContexts[viewType] || {};
  } catch (error) {
    console.error("Failed to get view context:", error);
    return {};
  }
}

/**
 * Get all stored contexts from localStorage
 */
function getStoredContexts(): Record<string, ViewContext> {
  try {
    const stored = localStorage.getItem(CONTEXT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Failed to parse stored contexts:", error);
    return {};
  }
}

/**
 * Maps context between different view types
 */
export function mapContextBetweenViews(
  fromView: ViewType,
  toView: ViewType,
  currentContext: ViewContext
): ViewContext {
  // Start with default empty context
  const mappedContext: ViewContext = {};

  // Copy common properties that make sense across all views
  if (currentContext.searchQuery) {
    mappedContext.searchQuery = currentContext.searchQuery;
  }

  // Map context based on view types
  if (fromView === ViewType.HYGIENE) {
    if (currentContext.mrId) {
      // From hygiene view, we can pass MR ID to other views
      mappedContext.mrId = currentContext.mrId;
    }
  } else if (fromView === ViewType.PO) {
    // From PO view, we can pass Jira ticket ID to team view
    if (toView === ViewType.TEAM && currentContext.jiraTicketId) {
      mappedContext.jiraTicketId = currentContext.jiraTicketId;
    }
    // From PO view, we can pass MR ID to dev view
    if (toView === ViewType.DEV && currentContext.mrId) {
      mappedContext.mrId = currentContext.mrId;
    }
  } else if (fromView === ViewType.DEV) {
    // From Dev view, we can pass MR ID to other views
    if (currentContext.mrId) {
      mappedContext.mrId = currentContext.mrId;
    }
    // From Dev view, we can pass Jira ticket ID to PO or Team view
    if (
      (toView === ViewType.PO || toView === ViewType.TEAM) &&
      currentContext.jiraTicketId
    ) {
      mappedContext.jiraTicketId = currentContext.jiraTicketId;
    }
  } else if (fromView === ViewType.TEAM) {
    // From Team view, we can pass Jira ticket ID to PO view
    if (toView === ViewType.PO && currentContext.jiraTicketId) {
      mappedContext.jiraTicketId = currentContext.jiraTicketId;
    }
  }

  return mappedContext;
}

/**
 * Hook for navigating between views while preserving context
 */
export function useViewNavigation() {
  const router = useRouter();

  /**
   * Navigate to a different view, preserving context where possible
   */
  const navigateToView = (
    targetView: ViewType,
    currentView: ViewType,
    currentContext: ViewContext = {}
  ): void => {
    // Check if the target view is available
    const isRoleBasedEnabled = FeatureFlags.isEnabled(
      FeatureFlag.ROLE_BASED_VIEWS
    );

    if (targetView !== ViewType.HYGIENE && !isRoleBasedEnabled) {
      // Role-based views are not enabled, redirect to hygiene view
      router.push(VIEW_ROUTES[ViewType.HYGIENE]);
      return;
    }

    // Check specific view feature flags
    if (
      (targetView === ViewType.PO &&
        !FeatureFlags.isEnabled(FeatureFlag.PO_VIEW)) ||
      (targetView === ViewType.DEV &&
        !FeatureFlags.isEnabled(FeatureFlag.DEV_VIEW)) ||
      (targetView === ViewType.TEAM &&
        !FeatureFlags.isEnabled(FeatureFlag.TEAM_VIEW))
    ) {
      // View is not enabled, redirect to hygiene view
      router.push(VIEW_ROUTES[ViewType.HYGIENE]);
      return;
    }

    // Map context between views
    const mappedContext = mapContextBetweenViews(
      currentView,
      targetView,
      currentContext
    );

    // Save the mapped context for the target view
    saveViewContext(targetView, mappedContext);

    // Navigate to the target view
    router.push(VIEW_ROUTES[targetView]);
  };

  /**
   * Generate a deep link to content in a different view
   */
  const createDeepLink = (
    targetView: ViewType,
    context: ViewContext
  ): string => {
    const baseUrl = VIEW_ROUTES[targetView];
    const params = new URLSearchParams();

    // Add context as query parameters
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  return {
    navigateToView,
    createDeepLink,
  };
}

/**
 * Extracts view context from URL query parameters
 */
export function getContextFromUrl(url: URL): ViewContext {
  const context: ViewContext = {};

  // Extract query parameters
  url.searchParams.forEach((value, key) => {
    context[key] = value;
  });

  return context;
}
