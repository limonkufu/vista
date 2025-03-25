"use client";

import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { ViewContext } from "@/services/NavigationService";

/**
 * Get the appropriate route for a specific view
 */
export function getRouteForView(viewType: ViewType): string {
  switch (viewType) {
    case ViewType.HYGIENE:
      return "/dashboard";
    case ViewType.PO:
      return "/dashboard/po-view";
    case ViewType.DEV:
      return "/dashboard/dev-view";
    case ViewType.TEAM:
      return "/dashboard/team-view";
    default:
      return "/dashboard";
  }
}

/**
 * Check if a view is available based on feature flags
 */
export function isViewAvailable(viewType: ViewType): boolean {
  // Hygiene view is always available
  if (viewType === ViewType.HYGIENE) {
    return true;
  }

  // All role-based views require the main feature flag
  if (!FeatureFlags.isEnabled(FeatureFlag.ROLE_BASED_VIEWS)) {
    return false;
  }

  // Check specific view flags
  switch (viewType) {
    case ViewType.PO:
      return FeatureFlags.isEnabled(FeatureFlag.PO_VIEW);
    case ViewType.DEV:
      return FeatureFlags.isEnabled(FeatureFlag.DEV_VIEW);
    case ViewType.TEAM:
      return FeatureFlags.isEnabled(FeatureFlag.TEAM_VIEW);
    default:
      return false;
  }
}

/**
 * Build a URL with context parameters
 */
export function buildUrlWithContext(
  baseUrl: string,
  context: ViewContext
): string {
  const url = new URL(baseUrl, window.location.origin);

  // Add context as query parameters
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
}

/**
 * Calculate an appropriate view for a specific MR
 * This helps suggest the most relevant view for a particular MR
 */
export function getSuggestedViewForMR(
  mrId: string,
  hasJiraTicket: boolean,
  mrStatus: string,
  userRole?: string
): ViewType {
  // If user has a specific role preference, use that
  if (userRole === "po" && isViewAvailable(ViewType.PO)) {
    return ViewType.PO;
  }

  if (userRole === "dev" && isViewAvailable(ViewType.DEV)) {
    return ViewType.DEV;
  }

  // Otherwise suggest based on MR properties

  // If MR has a Jira ticket, suggest PO view
  if (hasJiraTicket && isViewAvailable(ViewType.PO)) {
    return ViewType.PO;
  }

  // If MR needs review or has changes requested, suggest Dev view
  if (
    ["needs_review", "changes_requested"].includes(mrStatus) &&
    isViewAvailable(ViewType.DEV)
  ) {
    return ViewType.DEV;
  }

  // Default to hygiene view
  return ViewType.HYGIENE;
}

/**
 * Extract view type from a URL path
 */
export function getViewTypeFromPath(path: string): ViewType {
  if (path.includes("/po-view")) {
    return ViewType.PO;
  }

  if (path.includes("/dev-view")) {
    return ViewType.DEV;
  }

  if (path.includes("/team-view")) {
    return ViewType.TEAM;
  }

  return ViewType.HYGIENE;
}
