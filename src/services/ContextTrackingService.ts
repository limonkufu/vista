"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ViewType } from "@/types/ViewTypes";
import {
  ViewContext,
  getViewContext,
  saveViewContext,
  getContextFromUrl,
} from "@/services/NavigationService";
import { useLayout } from "@/contexts/LayoutContext";

/**
 * Hook that manages context persistence between views
 */
export function useContextTracking() {
  const { activeView } = useLayout();
  const searchParams = useSearchParams();
  const [currentContext, setCurrentContext] = useState<ViewContext>({});

  // Initialize context from URL and localStorage
  useEffect(() => {
    // First try to get context from URL parameters
    const urlContext: ViewContext = {};
    searchParams?.forEach((value, key) => {
      urlContext[key] = value;
    });

    // Then get saved context from localStorage
    const savedContext = getViewContext(activeView);

    // Merge with URL context taking precedence
    const mergedContext = {
      ...savedContext,
      ...urlContext,
    };

    // Update current context
    setCurrentContext(mergedContext);
  }, [activeView, searchParams]);

  /**
   * Update a specific context value
   */
  const updateContext = useCallback(
    (key: string, value: any, shouldPersist = true) => {
      setCurrentContext((prev) => {
        const updatedContext = {
          ...prev,
          [key]: value,
        };

        // Persist to localStorage if requested
        if (shouldPersist) {
          saveViewContext(activeView, updatedContext);
        }

        return updatedContext;
      });
    },
    [activeView]
  );

  /**
   * Update multiple context values at once
   */
  const updateContextBatch = useCallback(
    (updates: Partial<ViewContext>, shouldPersist = true) => {
      setCurrentContext((prev) => {
        const updatedContext = {
          ...prev,
          ...updates,
        };

        // Persist to localStorage if requested
        if (shouldPersist) {
          saveViewContext(activeView, updatedContext);
        }

        return updatedContext;
      });
    },
    [activeView]
  );

  /**
   * Clear all context for the current view
   */
  const clearContext = useCallback(
    (shouldPersist = true) => {
      setCurrentContext({});

      // Persist to localStorage if requested
      if (shouldPersist) {
        saveViewContext(activeView, {});
      }
    },
    [activeView]
  );

  return {
    context: currentContext,
    updateContext,
    updateContextBatch,
    clearContext,
  };
}

/**
 * Context tracking for specific data types
 */

/**
 * Track MR-specific context
 */
export function useMRContext() {
  const { context, updateContext } = useContextTracking();

  return {
    mrId: context.mrId,
    setMrId: (id: string) => updateContext("mrId", id),
  };
}

/**
 * Track Jira ticket-specific context
 */
export function useJiraTicketContext() {
  const { context, updateContext } = useContextTracking();

  return {
    jiraTicketId: context.jiraTicketId,
    setJiraTicketId: (id: string) => updateContext("jiraTicketId", id),
  };
}

/**
 * Track filter context
 */
export function useFilterContext() {
  const { context, updateContext, updateContextBatch } = useContextTracking();

  return {
    filters: context.filters || {},
    updateFilter: (key: string, value: any) => {
      const updatedFilters = {
        ...(context.filters || {}),
        [key]: value,
      };
      updateContext("filters", updatedFilters);
    },
    updateFilters: (filters: Record<string, any>) => {
      updateContext("filters", filters);
    },
    clearFilters: () => updateContext("filters", {}),
  };
}

/**
 * Track search query context
 */
export function useSearchContext() {
  const { context, updateContext } = useContextTracking();

  return {
    searchQuery: context.searchQuery || "",
    setSearchQuery: (query: string) => updateContext("searchQuery", query),
  };
}
