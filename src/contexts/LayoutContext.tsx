"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  ViewType,
  getDefaultViewType,
  isValidViewType,
} from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";

// Storage key for persisting the active view
const STORAGE_KEY = "gitlab-mrs-dashboard-active-view";

// Interface for the context value
interface LayoutContextValue {
  // Current view type (hygiene, po, dev, team)
  activeView: ViewType;
  // Switch to a different view
  setActiveView: (view: ViewType) => void;
  // Check if a view is available (through feature flags)
  isViewAvailable: (view: ViewType) => boolean;
  // Check if role-based views are enabled
  areRoleBasedViewsEnabled: boolean;
}

// Create the context with default values
const LayoutContext = createContext<LayoutContextValue>({
  activeView: ViewType.HYGIENE,
  setActiveView: () => {},
  isViewAvailable: () => false,
  areRoleBasedViewsEnabled: false,
});

// Custom hook to use the layout context
export const useLayout = () => useContext(LayoutContext);

// Props for the provider component
interface LayoutProviderProps {
  children: React.ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  // Initialize with the default hygiene view
  const [activeView, setActiveViewState] = useState<ViewType>(
    getDefaultViewType()
  );

  // Track if role-based views are enabled
  const [areRoleBasedViewsEnabled, setRoleBasedViewsEnabled] = useState(false);

  // Load the saved view from localStorage on initial render
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedView = localStorage.getItem(STORAGE_KEY);

      if (savedView && isValidViewType(savedView)) {
        // Only set the view if it's available through feature flags
        if (isViewAvailableInternal(savedView as ViewType)) {
          setActiveViewState(savedView as ViewType);
        }
      }
    } catch (error) {
      console.error("Failed to load saved view:", error);
    }

    // Check if role-based views are enabled
    const roleBasedEnabled = FeatureFlags.isEnabled(
      FeatureFlag.ROLE_BASED_VIEWS
    );
    setRoleBasedViewsEnabled(roleBasedEnabled);

    // Listen for feature flag changes
    const handleFlagChange = () => {
      const enabled = FeatureFlags.isEnabled(FeatureFlag.ROLE_BASED_VIEWS);
      setRoleBasedViewsEnabled(enabled);

      // If role-based views were disabled, switch back to hygiene view
      if (!enabled && activeView !== ViewType.HYGIENE) {
        setActiveView(ViewType.HYGIENE);
      }
    };

    window.addEventListener("feature-flag-change", handleFlagChange);
    return () => {
      window.removeEventListener("feature-flag-change", handleFlagChange);
    };
  }, [activeView]);

  // Check if a view is available through feature flags
  const isViewAvailableInternal = (view: ViewType): boolean => {
    // The hygiene view is always available
    if (view === ViewType.HYGIENE) return true;

    // Role-based views require the main feature flag
    if (!FeatureFlags.isEnabled(FeatureFlag.ROLE_BASED_VIEWS)) return false;

    // Check specific view flags
    switch (view) {
      case ViewType.PO:
        return FeatureFlags.isEnabled(FeatureFlag.PO_VIEW);
      case ViewType.DEV:
        return FeatureFlags.isEnabled(FeatureFlag.DEV_VIEW);
      case ViewType.TEAM:
        return FeatureFlags.isEnabled(FeatureFlag.TEAM_VIEW);
      default:
        return false;
    }
  };

  // Set the active view and save it to localStorage
  const setActiveView = (view: ViewType) => {
    if (!isViewAvailableInternal(view)) {
      console.warn(`Attempted to switch to unavailable view: ${view}`);
      return;
    }

    setActiveViewState(view);

    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch (error) {
      console.error("Failed to save view preference:", error);
    }
  };

  // Context value
  const value: LayoutContextValue = {
    activeView,
    setActiveView,
    isViewAvailable: isViewAvailableInternal,
    areRoleBasedViewsEnabled,
  };

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
};
