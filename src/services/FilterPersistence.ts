/**
 * Filter Persistence Service
 *
 * Manages saving and restoring filter state to localStorage and URL parameters,
 * allowing users to maintain context when navigating between views.
 */

import { Filter, enhancedFilterService } from "./EnhancedFilterService";
import { logger } from "@/lib/logger";

// Storage keys for each view type
const STORAGE_KEYS = {
  hygiene: "filter-state-hygiene",
  po: "filter-state-po",
  dev: "filter-state-dev",
  team: "filter-state-team",
};

// URL parameter name for filters
const URL_PARAM_NAME = "filters";

class FilterPersistenceService {
  /**
   * Save filter state to localStorage
   */
  saveFiltersToStorage(viewType: string, filters: Filter[]): void {
    try {
      const key =
        STORAGE_KEYS[viewType as keyof typeof STORAGE_KEYS] ||
        `filter-state-${viewType}`;
      localStorage.setItem(key, JSON.stringify(filters));
      logger.info("Saved filters to storage", {
        viewType,
        count: filters.length,
      });
    } catch (error) {
      logger.error("Error saving filters to storage", { error, viewType });
    }
  }

  /**
   * Load filter state from localStorage
   */
  loadFiltersFromStorage(viewType: string): Filter[] | null {
    try {
      const key =
        STORAGE_KEYS[viewType as keyof typeof STORAGE_KEYS] ||
        `filter-state-${viewType}`;
      const stored = localStorage.getItem(key);

      if (stored) {
        const filters = JSON.parse(stored) as Filter[];
        logger.info("Loaded filters from storage", {
          viewType,
          count: filters.length,
        });
        return filters;
      }

      return null;
    } catch (error) {
      logger.error("Error loading filters from storage", { error, viewType });
      return null;
    }
  }

  /**
   * Encode filters as URL parameters
   */
  encodeFiltersAsParams(filters: Filter[]): string {
    return encodeURIComponent(JSON.stringify(filters));
  }

  /**
   * Decode filters from URL parameters
   */
  decodeFiltersFromParams(paramValue: string): Filter[] | null {
    try {
      return JSON.parse(decodeURIComponent(paramValue)) as Filter[];
    } catch (error) {
      logger.error("Error decoding filters from URL parameters", { error });
      return null;
    }
  }

  /**
   * Get current URL with filter parameters
   */
  getUrlWithFilters(viewType: string, filters: Filter[]): string {
    const url = new URL(window.location.href);

    // Remove any existing filter parameters
    url.searchParams.delete(URL_PARAM_NAME);

    // Add new filters if there are any
    if (filters.length > 0) {
      url.searchParams.set(URL_PARAM_NAME, this.encodeFiltersAsParams(filters));
    }

    return url.toString();
  }

  /**
   * Update URL with current filters without navigating
   */
  updateUrlWithFilters(viewType: string, filters: Filter[]): void {
    const url = this.getUrlWithFilters(viewType, filters);
    window.history.replaceState({}, "", url);
    logger.info("Updated URL with filters", {
      viewType,
      count: filters.length,
    });
  }

  /**
   * Extract filters from current URL
   */
  getFiltersFromUrl(): Filter[] | null {
    try {
      const url = new URL(window.location.href);
      const filterParam = url.searchParams.get(URL_PARAM_NAME);

      if (filterParam) {
        return this.decodeFiltersFromParams(filterParam);
      }

      return null;
    } catch (error) {
      logger.error("Error getting filters from URL", { error });
      return null;
    }
  }

  /**
   * Save current filters to both localStorage and URL
   */
  persistFilters(viewType: string): void {
    const filters = enhancedFilterService.getFilters(viewType);

    // Save to localStorage
    this.saveFiltersToStorage(viewType, filters);

    // Update URL
    this.updateUrlWithFilters(viewType, filters);
  }

  /**
   * Restore filters from localStorage or URL for a view
   */
  restoreFilters(viewType: string): void {
    // Try URL first (for shared links)
    const urlFilters = this.getFiltersFromUrl();

    if (urlFilters && urlFilters.length > 0) {
      enhancedFilterService.setFilters(viewType, urlFilters);
      logger.info("Restored filters from URL", {
        viewType,
        count: urlFilters.length,
      });
      return;
    }

    // Then try localStorage
    const storedFilters = this.loadFiltersFromStorage(viewType);

    if (storedFilters && storedFilters.length > 0) {
      enhancedFilterService.setFilters(viewType, storedFilters);
      logger.info("Restored filters from storage", {
        viewType,
        count: storedFilters.length,
      });
    }
  }

  /**
   * Create deep link URL with filters to share
   */
  createDeepLink(viewType: string, filters: Filter[] = []): string {
    // Start with the base URL for the app
    const baseUrl = window.location.origin;

    // Build path for the specific view
    let viewPath: string;
    switch (viewType) {
      case "po":
        viewPath = "/dashboard/po-view";
        break;
      case "dev":
        viewPath = "/dashboard/dev-view";
        break;
      case "team":
        viewPath = "/dashboard/team-view";
        break;
      case "hygiene":
      default:
        viewPath = "/dashboard";
        break;
    }

    // Create URL object
    const url = new URL(viewPath, baseUrl);

    // Add filters if provided
    if (filters.length > 0) {
      url.searchParams.set(URL_PARAM_NAME, this.encodeFiltersAsParams(filters));
    }

    return url.toString();
  }

  /**
   * Map filters between different view types
   * This allows some context to be maintained when switching views
   */
  mapFilters(
    sourceViewType: string,
    targetViewType: string,
    filters: Filter[]
  ): Filter[] {
    // Clone the filters to avoid modifying the original
    const mappedFilters: Filter[] = [];

    // Process each filter to see if it can be mapped
    filters.forEach((filter) => {
      // Some filters can be used directly across views
      const directMapFilters = [
        "author",
        "assignee",
        "reviewer",
        "repository",
        "label",
        "state",
        "textSearch",
      ];

      // Jira filters can be mapped directly between PO and Team views
      const jiraFilters = [
        "jiraKey",
        "jiraProject",
        "jiraStatus",
        "jiraPriority",
        "jiraType",
        "jiraAssignee",
        "jiraLabel",
        "jiraSprint",
        "jiraEpic",
        "jiraTextSearch",
      ];

      // Direct mapping for filters that work the same across views
      if (directMapFilters.includes(filter.type)) {
        mappedFilters.push({ ...filter });
      }

      // Map Jira filters between views that support them
      else if (
        jiraFilters.includes(filter.type) &&
        (targetViewType === "po" ||
          targetViewType === "team" ||
          targetViewType === "dev")
      ) {
        mappedFilters.push({ ...filter });
      }

      // Special mappings for specific view transitions
      else if (filter.type === "age" || filter.type === "lastUpdated") {
        // Keep age and lastUpdated filters when going to hygiene view
        if (targetViewType === "hygiene") {
          mappedFilters.push({ ...filter });
        }
      }
    });

    return mappedFilters;
  }

  /**
   * Transfer context (filters) when switching views
   */
  transferContext(sourceViewType: string, targetViewType: string): void {
    // Get current filters from source view
    const sourceFilters = enhancedFilterService.getFilters(sourceViewType);

    if (sourceFilters.length === 0) {
      return; // No filters to transfer
    }

    // Map filters to target view
    const mappedFilters = this.mapFilters(
      sourceViewType,
      targetViewType,
      sourceFilters
    );

    if (mappedFilters.length > 0) {
      // Set mapped filters on target view
      enhancedFilterService.setFilters(targetViewType, mappedFilters);
      logger.info("Transferred context between views", {
        from: sourceViewType,
        to: targetViewType,
        filtersTransferred: mappedFilters.length,
      });
    }
  }
}

// Export singleton instance
export const filterPersistenceService = new FilterPersistenceService();
