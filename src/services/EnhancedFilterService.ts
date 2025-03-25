/**
 * Enhanced Filter Service
 *
 * Provides advanced filtering capabilities for both GitLab MRs and Jira tickets,
 * supporting the original filtering logic while adding new filter types for the
 * context-aware views.
 */

import { GitLabMR } from "@/lib/gitlab";
import {
  JiraTicket,
  JiraTicketWithMRs,
  GitLabMRWithJira,
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
} from "@/types/Jira";
import { logger } from "@/lib/logger";

// Base filter interface
export interface BaseFilter {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
}

// GitLab MR filters (supporting existing filters)
export interface MRAuthorFilter extends BaseFilter {
  type: "author";
  value: string | number; // User ID
}

export interface MRAssigneeFilter extends BaseFilter {
  type: "assignee";
  value: string | number; // User ID
}

export interface MRReviewerFilter extends BaseFilter {
  type: "reviewer";
  value: string | number; // User ID
}

export interface MRRepositoryFilter extends BaseFilter {
  type: "repository";
  value: number; // Project ID
}

export interface MRLabelFilter extends BaseFilter {
  type: "label";
  value: string;
}

export interface MRStateFilter extends BaseFilter {
  type: "state";
  value: "opened" | "closed" | "locked" | "merged";
}

export interface MRAgeFilter extends BaseFilter {
  type: "age";
  value: number; // Days
  operator: "gt" | "lt" | "eq"; // Greater than, less than, equal
}

export interface MRLastUpdatedFilter extends BaseFilter {
  type: "lastUpdated";
  value: number; // Days
  operator: "gt" | "lt" | "eq"; // Greater than, less than, equal
}

export interface MRTextSearchFilter extends BaseFilter {
  type: "textSearch";
  value: string;
  fields: ("title" | "description")[];
}

// Jira-specific filters
export interface JiraKeyFilter extends BaseFilter {
  type: "jiraKey";
  value: string;
}

export interface JiraProjectFilter extends BaseFilter {
  type: "jiraProject";
  value: string;
}

export interface JiraStatusFilter extends BaseFilter {
  type: "jiraStatus";
  value: JiraTicketStatus;
}

export interface JiraPriorityFilter extends BaseFilter {
  type: "jiraPriority";
  value: JiraTicketPriority;
}

export interface JiraTypeFilter extends BaseFilter {
  type: "jiraType";
  value: JiraTicketType;
}

export interface JiraAssigneeFilter extends BaseFilter {
  type: "jiraAssignee";
  value: string; // User ID
}

export interface JiraLabelFilter extends BaseFilter {
  type: "jiraLabel";
  value: string;
}

export interface JiraSprintFilter extends BaseFilter {
  type: "jiraSprint";
  value: string;
}

export interface JiraEpicFilter extends BaseFilter {
  type: "jiraEpic";
  value: string;
}

export interface JiraTextSearchFilter extends BaseFilter {
  type: "jiraTextSearch";
  value: string;
  fields: ("title" | "description" | "key")[];
}

// Combined filter type
export type Filter =
  | MRAuthorFilter
  | MRAssigneeFilter
  | MRReviewerFilter
  | MRRepositoryFilter
  | MRLabelFilter
  | MRStateFilter
  | MRAgeFilter
  | MRLastUpdatedFilter
  | MRTextSearchFilter
  | JiraKeyFilter
  | JiraProjectFilter
  | JiraStatusFilter
  | JiraPriorityFilter
  | JiraTypeFilter
  | JiraAssigneeFilter
  | JiraLabelFilter
  | JiraSprintFilter
  | JiraEpicFilter
  | JiraTextSearchFilter;

// Filter collections by view type
export interface FilterSet {
  id: string;
  name: string;
  viewType: "hygiene" | "po" | "dev" | "team";
  filters: Filter[];
}

// Local storage key for saved filter sets
const SAVED_FILTERS_KEY = "enhanced-filters-saved-sets";

class EnhancedFilterService {
  private activeFilters: Map<string, Filter[]> = new Map();
  private savedFilterSets: FilterSet[] = [];

  constructor() {
    this.loadSavedFilters();
  }

  /**
   * Load saved filter sets from localStorage
   */
  private loadSavedFilters(): void {
    try {
      const saved = localStorage.getItem(SAVED_FILTERS_KEY);
      if (saved) {
        this.savedFilterSets = JSON.parse(saved);
        logger.info("Loaded saved filter sets", {
          count: this.savedFilterSets.length,
        });
      }
    } catch (error) {
      logger.error("Error loading saved filter sets", { error });
      this.savedFilterSets = [];
    }
  }

  /**
   * Save filter sets to localStorage
   */
  private saveFilerSets(): void {
    try {
      localStorage.setItem(
        SAVED_FILTERS_KEY,
        JSON.stringify(this.savedFilterSets)
      );
      logger.info("Saved filter sets", { count: this.savedFilterSets.length });
    } catch (error) {
      logger.error("Error saving filter sets", { error });
    }
  }

  /**
   * Set active filters for a specific view
   */
  setFilters(viewType: string, filters: Filter[]): void {
    this.activeFilters.set(viewType, [...filters]);
    logger.info("Set active filters", { viewType, count: filters.length });
  }

  /**
   * Get active filters for a specific view
   */
  getFilters(viewType: string): Filter[] {
    return this.activeFilters.get(viewType) || [];
  }

  /**
   * Add a filter to a specific view
   */
  addFilter(viewType: string, filter: Filter): void {
    const filters = this.getFilters(viewType);

    // Check for duplicates (same type and value)
    const isDuplicate = filters.some(
      (f) =>
        f.type === filter.type &&
        "value" in f &&
        "value" in filter &&
        f.value === filter.value
    );

    if (!isDuplicate) {
      filters.push(filter);
      this.setFilters(viewType, filters);
    }
  }

  /**
   * Remove a filter from a specific view
   */
  removeFilter(viewType: string, filterId: string): void {
    const filters = this.getFilters(viewType);
    const updatedFilters = filters.filter((f) => f.id !== filterId);
    this.setFilters(viewType, updatedFilters);
  }

  /**
   * Toggle a filter's enabled state
   */
  toggleFilter(viewType: string, filterId: string): void {
    const filters = this.getFilters(viewType);
    const updatedFilters = filters.map((f) => {
      if (f.id === filterId) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    });
    this.setFilters(viewType, updatedFilters);
  }

  /**
   * Clear all filters for a specific view
   */
  clearFilters(viewType: string): void {
    this.activeFilters.set(viewType, []);
    logger.info("Cleared filters", { viewType });
  }

  /**
   * Save current filters as a named set
   */
  saveFilterSet(viewType: string, name: string): FilterSet {
    const filters = this.getFilters(viewType);

    const newSet: FilterSet = {
      id: `filter-set-${Date.now()}`,
      name,
      viewType: viewType as any,
      filters: [...filters],
    };

    this.savedFilterSets.push(newSet);
    this.saveFilerSets();

    logger.info("Saved filter set", {
      name,
      viewType,
      filters: filters.length,
    });

    return newSet;
  }

  /**
   * Get all saved filter sets for a view type
   */
  getSavedFilterSets(viewType: string): FilterSet[] {
    return this.savedFilterSets.filter((set) => set.viewType === viewType);
  }

  /**
   * Delete a saved filter set
   */
  deleteFilterSet(setId: string): void {
    this.savedFilterSets = this.savedFilterSets.filter(
      (set) => set.id !== setId
    );
    this.saveFilerSets();

    logger.info("Deleted filter set", { setId });
  }

  /**
   * Apply a saved filter set
   */
  applyFilterSet(setId: string): void {
    const set = this.savedFilterSets.find((s) => s.id === setId);
    if (set) {
      this.setFilters(set.viewType, [...set.filters]);
      logger.info("Applied filter set", { setId, viewType: set.viewType });
    }
  }

  /**
   * Apply a filter to GitLab MRs
   */
  applyMRFilters(items: GitLabMR[], filters: Filter[]): GitLabMR[] {
    // Filter only enabled filters
    const activeFilters = filters.filter((f) => f.enabled);

    if (activeFilters.length === 0) {
      return items;
    }

    return items.filter((item) => this.mrPassesFilters(item, activeFilters));
  }

  /**
   * Apply a filter to GitLab MRs with Jira data
   */
  applyMRWithJiraFilters(
    items: GitLabMRWithJira[],
    filters: Filter[]
  ): GitLabMRWithJira[] {
    // Filter only enabled filters
    const activeFilters = filters.filter((f) => f.enabled);

    if (activeFilters.length === 0) {
      return items;
    }

    return items.filter((item) =>
      this.mrWithJiraPassesFilters(item, activeFilters)
    );
  }

  /**
   * Apply filters to Jira tickets with MRs
   */
  applyTicketFilters(
    items: JiraTicketWithMRs[],
    filters: Filter[]
  ): JiraTicketWithMRs[] {
    // Filter only enabled filters
    const activeFilters = filters.filter((f) => f.enabled);

    if (activeFilters.length === 0) {
      return items;
    }

    return items.filter((item) =>
      this.ticketPassesFilters(item, activeFilters)
    );
  }

  /**
   * Check if an MR passes all filters
   */
  private mrPassesFilters(mr: GitLabMR, filters: Filter[]): boolean {
    return filters.every((filter) => {
      switch (filter.type) {
        case "author":
          return mr.author.id === filter.value;

        case "assignee":
          return mr.assignees.some((a) => a.id === filter.value);

        case "reviewer":
          return mr.reviewers.some((r) => r.id === filter.value);

        case "repository":
          return mr.project_id === filter.value;

        case "label":
          return mr.labels.includes(filter.value as string);

        case "state":
          return mr.state === filter.value;

        case "age":
          const ageInDays = this.getDaysDifference(
            new Date(mr.created_at),
            new Date()
          );
          return this.compareValues(ageInDays, filter.value, filter.operator);

        case "lastUpdated":
          const updatedDaysAgo = this.getDaysDifference(
            new Date(mr.updated_at),
            new Date()
          );
          return this.compareValues(
            updatedDaysAgo,
            filter.value,
            filter.operator
          );

        case "textSearch":
          const searchValue = (filter.value as string).toLowerCase();
          return filter.fields.some((field) => {
            if (field === "title") {
              return mr.title.toLowerCase().includes(searchValue);
            } else if (field === "description") {
              return mr.description?.toLowerCase().includes(searchValue);
            }
            return false;
          });

        // Skip Jira-specific filters for regular MRs
        case "jiraKey":
        case "jiraProject":
        case "jiraStatus":
        case "jiraPriority":
        case "jiraType":
        case "jiraAssignee":
        case "jiraLabel":
        case "jiraSprint":
        case "jiraEpic":
        case "jiraTextSearch":
          return true;

        default:
          logger.warn("Unknown filter type", { type: filter.type });
          return true;
      }
    });
  }

  /**
   * Check if an MR with Jira data passes all filters
   */
  private mrWithJiraPassesFilters(
    mr: GitLabMRWithJira,
    filters: Filter[]
  ): boolean {
    // First check GitLab MR filters
    if (
      !this.mrPassesFilters(
        mr,
        filters.filter((f) => !f.type.startsWith("jira"))
      )
    ) {
      return false;
    }

    // Then check Jira-specific filters
    return filters
      .filter((f) => f.type.startsWith("jira"))
      .every((filter) => {
        // If MR doesn't have a Jira ticket and we're filtering by Jira properties,
        // it fails unless it's a jiraKey filter with empty/null value
        if (!mr.jiraTicket && filter.type !== "jiraKey") {
          return false;
        }

        switch (filter.type) {
          case "jiraKey":
            if (!filter.value) {
              // Filter for MRs without Jira tickets
              return !mr.jiraTicketKey;
            }
            return mr.jiraTicketKey === filter.value;

          case "jiraProject":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.key.startsWith(filter.value + "-");

          case "jiraStatus":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.status === filter.value;

          case "jiraPriority":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.priority === filter.value;

          case "jiraType":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.type === filter.value;

          case "jiraAssignee":
            if (!mr.jiraTicket || !mr.jiraTicket.assignee) return false;
            return mr.jiraTicket.assignee.id === filter.value;

          case "jiraLabel":
            if (!mr.jiraTicket || !mr.jiraTicket.labels) return false;
            return mr.jiraTicket.labels.includes(filter.value as string);

          case "jiraSprint":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.sprintName === filter.value;

          case "jiraEpic":
            if (!mr.jiraTicket) return false;
            return mr.jiraTicket.epicKey === filter.value;

          case "jiraTextSearch":
            if (!mr.jiraTicket) return false;

            const searchValue = (filter.value as string).toLowerCase();
            return filter.fields.some((field) => {
              if (field === "title") {
                return mr.jiraTicket!.title.toLowerCase().includes(searchValue);
              } else if (field === "description") {
                return mr
                  .jiraTicket!.description?.toLowerCase()
                  .includes(searchValue);
              } else if (field === "key") {
                return mr.jiraTicket!.key.toLowerCase().includes(searchValue);
              }
              return false;
            });

          default:
            return true;
        }
      });
  }

  /**
   * Check if a ticket with MRs passes all filters
   */
  private ticketPassesFilters(
    ticket: JiraTicketWithMRs,
    filters: Filter[]
  ): boolean {
    return filters.every((filter) => {
      switch (filter.type) {
        case "jiraKey":
          return ticket.ticket.key === filter.value;

        case "jiraProject":
          return ticket.ticket.key.startsWith(filter.value + "-");

        case "jiraStatus":
          return ticket.ticket.status === filter.value;

        case "jiraPriority":
          return ticket.ticket.priority === filter.value;

        case "jiraType":
          return ticket.ticket.type === filter.value;

        case "jiraAssignee":
          if (!ticket.ticket.assignee) return false;
          return ticket.ticket.assignee.id === filter.value;

        case "jiraLabel":
          if (!ticket.ticket.labels) return false;
          return ticket.ticket.labels.includes(filter.value as string);

        case "jiraSprint":
          return ticket.ticket.sprintName === filter.value;

        case "jiraEpic":
          return ticket.ticket.epicKey === filter.value;

        case "jiraTextSearch":
          const searchValue = (filter.value as string).toLowerCase();
          return filter.fields.some((field) => {
            if (field === "title") {
              return ticket.ticket.title.toLowerCase().includes(searchValue);
            } else if (field === "description") {
              return ticket.ticket.description
                ?.toLowerCase()
                .includes(searchValue);
            } else if (field === "key") {
              return ticket.ticket.key.toLowerCase().includes(searchValue);
            }
            return false;
          });

        // Handle MR-related filters by checking if any associated MRs match
        case "author":
          return ticket.mergeRequests.some(
            (mr) => mr.author.id === filter.value
          );

        case "assignee":
          return ticket.mergeRequests.some((mr) =>
            mr.assignees.some((a) => a.id === filter.value)
          );

        case "reviewer":
          return ticket.mergeRequests.some((mr) =>
            mr.reviewers.some((r) => r.id === filter.value)
          );

        case "repository":
          return ticket.mergeRequests.some(
            (mr) => mr.project_id === filter.value
          );

        case "label":
          return ticket.mergeRequests.some((mr) =>
            mr.labels.includes(filter.value as string)
          );

        case "state":
          return ticket.mergeRequests.some((mr) => mr.state === filter.value);

        case "age":
          return ticket.mergeRequests.some((mr) => {
            const ageInDays = this.getDaysDifference(
              new Date(mr.created_at),
              new Date()
            );
            return this.compareValues(ageInDays, filter.value, filter.operator);
          });

        case "lastUpdated":
          return ticket.mergeRequests.some((mr) => {
            const updatedDaysAgo = this.getDaysDifference(
              new Date(mr.updated_at),
              new Date()
            );
            return this.compareValues(
              updatedDaysAgo,
              filter.value,
              filter.operator
            );
          });

        case "textSearch":
          const mrSearchValue = (filter.value as string).toLowerCase();
          return ticket.mergeRequests.some((mr) =>
            filter.fields.some((field) => {
              if (field === "title") {
                return mr.title.toLowerCase().includes(mrSearchValue);
              } else if (field === "description") {
                return mr.description?.toLowerCase().includes(mrSearchValue);
              }
              return false;
            })
          );

        default:
          logger.warn("Unknown filter type", { type: filter.type });
          return true;
      }
    });
  }

  /**
   * Calculate days difference between two dates
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Compare values using the specified operator
   */
  private compareValues(
    actual: number,
    expected: number,
    operator: "gt" | "lt" | "eq"
  ): boolean {
    switch (operator) {
      case "gt":
        return actual > expected;
      case "lt":
        return actual < expected;
      case "eq":
        return actual === expected;
      default:
        return false;
    }
  }

  /**
   * Export filters as URL parameters
   */
  exportFiltersAsParams(viewType: string): string {
    const filters = this.getFilters(viewType);
    if (filters.length === 0) return "";

    const filtersObj = { filters: filters.map((f) => ({ ...f })) };
    return encodeURIComponent(JSON.stringify(filtersObj));
  }

  /**
   * Import filters from URL parameters
   */
  importFiltersFromParams(viewType: string, paramsStr: string): boolean {
    try {
      const decoded = decodeURIComponent(paramsStr);
      const filtersObj = JSON.parse(decoded);

      if (
        filtersObj &&
        filtersObj.filters &&
        Array.isArray(filtersObj.filters)
      ) {
        this.setFilters(viewType, filtersObj.filters);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error importing filters from params", { error, paramsStr });
      return false;
    }
  }

  /**
   * Create a new filter with a unique ID
   */
  createFilter<T extends Filter>(filterData: Omit<T, "id">): T {
    return {
      ...filterData,
      id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    } as T;
  }
}

// Export singleton instance
export const enhancedFilterService = new EnhancedFilterService();
