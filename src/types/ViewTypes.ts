// View types for the GitLab MR Dashboard

import {
  ClipboardList,
  UserCog,
  GitMerge,
  Users,
  LucideIcon,
} from "lucide-react";

/**
 * Enum for all available view types in the dashboard
 * - HYGIENE: The original view focused on MR hygiene (Old, Inactive, Pending Review)
 * - PO: Product Owner view organized by Jira tickets
 * - DEV: Developer view organized by action needed
 * - TEAM: Team-wide view with aggregated metrics
 */
export enum ViewType {
  HYGIENE = "hygiene",
  PO = "po",
  DEV = "dev",
  TEAM = "team",
}

/**
 * Interface for view configuration
 */
export interface ViewConfig {
  type: ViewType;
  label: string;
  description: string;
  icon: LucideIcon;
  requiresFeatureFlag?: boolean;
  featureFlag?: string;
}

/**
 * Available dashboard views with their configurations
 */
export const DASHBOARD_VIEWS: ViewConfig[] = [
  {
    type: ViewType.PO,
    label: "PO View",
    description: "Organize MRs by Jira tickets",
    icon: UserCog,
    requiresFeatureFlag: true,
    featureFlag: "poView",
  },
  {
    type: ViewType.DEV,
    label: "Dev View",
    description: "MRs organized by action needed",
    icon: GitMerge,
    requiresFeatureFlag: true,
    featureFlag: "devView",
  },
  {
    type: ViewType.TEAM,
    label: "Team View",
    description: "Team-wide metrics and insights",
    icon: Users,
    requiresFeatureFlag: true,
    featureFlag: "teamView",
  },
  {
    type: ViewType.HYGIENE,
    label: "Hygiene",
    description: "Track technical debt and MR hygiene",
    icon: ClipboardList,
  },
];

/**
 * Get views that are available based on enabled feature flags
 */
export function getAvailableViews(
  isFeatureEnabled: (flag: string) => boolean
): ViewConfig[] {
  return DASHBOARD_VIEWS.filter((view) => {
    // Always include views that don't require a feature flag
    if (!view.requiresFeatureFlag) return true;

    // For views that require a feature flag, check if it's enabled
    return view.featureFlag && isFeatureEnabled(view.featureFlag);
  });
}

/**
 * Get a view configuration by type
 */
export function getViewByType(type: ViewType): ViewConfig | undefined {
  return DASHBOARD_VIEWS.find((view) => view.type === type);
}

/**
 * Check if a view type is valid
 */
export function isValidViewType(type: string): type is ViewType {
  return Object.values(ViewType).includes(type as ViewType);
}

/**
 * Get the default view type
 */
export function getDefaultViewType(): ViewType {
  return ViewType.HYGIENE; // Always default to the original view
}
