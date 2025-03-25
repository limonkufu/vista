# Incremental Implementation Plan: Adding Context-Aware Views While Preserving Existing Functionality

This revised plan focuses on safely extending the existing dashboard with new context-aware views while keeping all current functionality intact. The approach uses feature flags, parallel implementation paths, and gradual integration to minimize risks.

## Step-by-Step Implementation Plan

### Phase 1: Foundation & Infrastructure (Non-disruptive Additions)

#### Step 1.1: View Types and Feature Flag System

```markdown
Your task is to implement a feature flag system and define view types for the context-aware dashboard extension without modifying existing functionality.

Current context:
- The application has a working dashboard tracking MRs in three categories (Old, Inactive, Pending Review)
- We need to add new views without disrupting the existing functionality
- We need a way to selectively enable/disable the new features

Requirements:
1. Create a feature flag service at `src/services/FeatureFlags.ts` that:
   - Provides methods to check if features are enabled
   - Allows enabling/disabling features via localStorage
   - Includes a simple admin UI toggle for development
   - Has default configurations for production/development

2. Define view type enums and interfaces at `src/types/ViewTypes.ts` that:
   - Define the existing hygiene view type (for type safety)
   - Add new view types: PO, Dev, Team
   - Keep the types as an extension rather than replacement
   - Include utility functions to work with these types

3. Create a small, unobtrusive "Labs" menu in the navbar at `src/components/LabsMenu.tsx` that:
   - Only appears in development or for admin users
   - Allows toggling new features
   - Shows which experimental features are active
   - Doesn't interfere with existing UI

The key is to add these components without modifying existing code - they should be purely additive at this stage.
```

#### Step 1.2: Extended Layout Container

```markdown
Let's create an extended layout container that can switch between the existing dashboard and new views based on feature flags.

Current context:
- We have added feature flags in `src/services/FeatureFlags.ts`
- The current dashboard uses a straightforward layout
- We need to add support for the new views without changing existing pages

Requirements:
1. Create a new layout wrapper component at `src/components/layouts/DashboardLayout.tsx` that:
   - Renders either the classic dashboard or new dashboard based on feature flags
   - Preserves all existing behavior when feature flag is off
   - Adds additional wrapper UI only when features are enabled
   - Uses the same props/children interface as existing layout

2. Extend the navbar component for the new layout at `src/components/layouts/EnhancedNavbar.tsx` that:
   - Inherits all functionality from the existing navbar
   - Adds the view switcher when feature flag is enabled
   - Maintains all existing actions and UI
   - Has a clean fallback to original navbar

3. Create a layout context at `src/contexts/LayoutContext.tsx` that:
   - Manages shared state between layout components
   - Tracks which view type is active
   - Provides methods to switch between views
   - Persists view preference in localStorage

This approach allows us to conditionally render either the original dashboard or the new one without modifying existing code.
```

#### Step 1.3: Jira Data Types & Mock Service

```markdown
Let's implement the Jira data types and a mock service that can be used in development without requiring actual Jira integration yet.

Current context:
- We need Jira data for the new PO view
- We want to develop and test without requiring actual Jira credentials
- These types and services should not affect existing functionality

Requirements:
1. Define Jira data types at `src/types/Jira.ts` that:
   - Include interfaces for Jira tickets (id, title, status, etc.)
   - Define relationship types between MRs and tickets
   - Include utility types for filtering and grouping
   - Match the structure we'll use with real Jira data later

2. Create a mock Jira service at `src/services/mockJira.ts` that:
   - Generates realistic sample Jira data
   - Randomly associates existing MRs with mock tickets
   - Includes methods matching what the real service will have
   - Has configurable delay/error simulation for testing

3. Implement a Jira service factory at `src/services/JiraServiceFactory.ts` that:
   - Returns either mock or real implementation based on configuration
   - Presents a consistent interface regardless of implementation
   - Includes proper typing for all methods
   - Handles initialization and authentication

This approach lets us build and test Jira-dependent features without modifying existing code or requiring immediate integration.
```

### Phase 2: View Components (Parallel Implementation)

#### Step 2.1: View Mode Switcher Component

```markdown
Implement a view mode switcher component that allows toggling between the hygiene view and new role-based views.

Current context:
- We have feature flags and layout context implemented
- We need a UI component to switch between different views
- The component should appear only when the feature is enabled

Requirements:
1. Create a view switcher component at `src/components/ViewSwitcher/ViewSwitcher.tsx` that:
   - Provides tabs/buttons for each view type (Hygiene, PO, Dev, Team)
   - Visually indicates the active view
   - Uses the layout context to change views
   - Has a clean, minimal design that fits with existing UI

2. Implement a role selector component at `src/components/ViewSwitcher/RoleSelector.tsx` that:
   - Appears only when a role-based view is selected
   - Allows selection between different roles within that view
   - Remembers the last selected role for each view type
   - Has appropriate accessibility attributes

3. Create animations for view transitions at `src/components/ViewSwitcher/transitions.ts` that:
   - Provide smooth transitions between views
   - Work with the existing animation system
   - Are subtle and not distracting
   - Respect reduced motion preferences

This component provides the primary UI for switching between the classic and new views.
```

#### Step 2.2: PO View Core Components

```markdown
Implement the core components for the PO view that will display MRs grouped by Jira tickets.

Current context:
- We have Jira data types and mock service in place
- The PO view needs components to display MRs grouped by tickets
- These components should be built without affecting existing dashboard

Requirements:
1. Create a PO view container at `src/components/POView/POView.tsx` that:
   - Serves as the main container for the PO-specific view
   - Fetches and organizes data from GitLab and Jira services
   - Handles loading and error states
   - Manages view-specific state (expanded tickets, etc.)

2. Implement a Jira ticket group component at `src/components/POView/TicketGroup.tsx` that:
   - Displays a collapsible group for each Jira ticket
   - Shows ticket summary information in the header
   - Contains associated MRs in an expandable section
   - Includes ticket-level actions and metrics

3. Create an enhanced MR row component at `src/components/POView/MRRow.tsx` that:
   - Shows MR information relevant to POs
   - Includes PO-specific action buttons
   - Displays relationship to parent ticket
   - Uses consistent styling with existing MR tables

These components will form the foundation of the PO view without modifying existing code.
```

#### Step 2.3: Dev View Core Components

```markdown
Implement the core components for the Dev view that will focus on MRs requiring developer attention.

Current context:
- The view switcher and feature flag system are in place
- The Dev view needs components to organize MRs by status and action needed
- These components should be built without affecting the existing dashboard

Requirements:
1. Create a Dev view container at `src/components/DevView/DevView.tsx` that:
   - Serves as the main container for the developer-specific view
   - Organizes MRs by status categories (Needs Review, Changes Requested, etc.)
   - Handles data fetching, loading and error states
   - Prioritizes MRs needing immediate attention

2. Implement a status group component at `src/components/DevView/StatusGroup.tsx` that:
   - Creates collapsible groups for each status category
   - Shows count and summary information for the group
   - Contains MRs in that status category
   - Includes visual indicators for urgent items

3. Create a developer-focused MR row at `src/components/DevView/DevMRRow.tsx` that:
   - Emphasizes information relevant to developers (comments, CI status)
   - Includes developer-specific action buttons
   - Shows time since last update prominently
   - Links to Jira tickets when available

These components form the foundation of the Dev view without modifying existing code.
```

#### Step 2.4: Team View Core Components

```markdown
Implement the core components for the Team view that provides aggregated metrics and insights.

Current context:
- The feature flag system and view switching are implemented
- The Team view needs components to display aggregated metrics
- These components should be built separately from existing code

Requirements:
1. Create a Team view container at `src/components/TeamView/TeamView.tsx` that:
   - Serves as the main container for the team-wide metrics view
   - Fetches and aggregates data from GitLab and Jira
   - Computes key performance indicators
   - Handles loading and error states

2. Implement a metrics dashboard component at `src/components/TeamView/MetricsDashboard.tsx` that:
   - Displays key metrics in a card-based layout
   - Includes simple visualizations for important metrics
   - Shows trends over time where applicable
   - Provides appropriate context for the numbers

3. Create a ticket summary table at `src/components/TeamView/TicketSummaryTable.tsx` that:
   - Shows Jira tickets with aggregated MR statistics
   - Includes indicators for problematic tickets
   - Provides expandable rows for detailed information
   - Includes filtering and sorting capabilities

These components will form the foundation of the Team view while keeping it separate from existing code.
```

### Phase 3: Data Integration & Enhancement

#### Step 3.1: Unified Data Service

```markdown
Create a unified data service that can provide data for both existing and new views.

Current context:
- Each view currently has its own data fetching logic
- We need a central service that can efficiently provide data for all views
- This should enhance existing data fetching without breaking it

Requirements:
1. Create a unified data service at `src/services/UnifiedDataService.ts` that:
   - Centralizes data fetching for MRs and Jira tickets
   - Implements efficient caching and refresh strategies
   - Provides data transformation methods for different views
   - Maintains backward compatibility with existing data usage

2. Implement specialized data hooks for each view:
   - Enhance existing hooks to optionally use the unified service
   - Create new hooks for the new views (`usePOViewData`, etc.)
   - Ensure consistent error and loading states
   - Add proper typing for all return values

3. Create a data synchronization service at `src/services/DataSyncService.ts` that:
   - Periodically refreshes data in the background
   - Intelligently invalidates cache based on expected data lifetime
   - Provides real-time updates when possible
   - Minimizes redundant network requests


This unified approach ensures efficient data handling across the application while maintaining compatibility.
```

#### Step 3.2: MR-Jira Association Logic

```markdown
Implement the logic for associating GitLab MRs with Jira tickets, a key component for the PO and Team views.

Current context:
- We have mock Jira data for development
- We need to create associations between real MRs and Jira tickets
- This should work with both mock and real Jira integrations

Requirements:
1. Create an association service at `src/services/MRJiraAssociationService.ts` that:
   - Extracts Jira ticket IDs from MR titles, descriptions, and branches
   - Builds and maintains a mapping between MRs and tickets
   - Provides methods to query associations in both directions
   - Handles cache invalidation when data changes

2. Implement parsing utilities at `src/utils/jiraReferenceParser.ts` that:
   - Extract ticket IDs using configurable patterns
   - Handle different formats (e.g., "PROJECT-123", "#PROJECT-123")
   - Process branch names, titles, and descriptions
   - Provide confidence scores for potential matches

3. Create a manual association manager at `src/services/ManualAssociationManager.ts` that:
   - Allows manual creation/removal of associations
   - Persists manual associations between sessions
   - Provides UI for managing associations
   - Takes precedence over automatic associations

This association logic will enable the Jira integration features while working with both real and mock data.
```

#### Step 3.3: Enhanced Filtering Capabilities

```markdown
Implement enhanced filtering capabilities that work across all views while maintaining backward compatibility.

Current context:
- The existing dashboard has basic filtering
- New views need more advanced filtering options
- Filters should be shareable between views where appropriate

Requirements:
1. Create an enhanced filter service at `src/services/EnhancedFilterService.ts` that:
   - Supports all existing filter types
   - Adds new filters for Jira tickets, status categories, etc.
   - Provides a consistent interface for all views
   - Translates filters between different view contexts

2. Implement a filter persistence system at `src/services/FilterPersistence.ts` that:
   - Saves filter state to localStorage
   - Encodes filters in URL parameters for sharing
   - Restores filters when navigating between views
   - Maintains separate filter sets for different views

3. Create an enhanced filter UI at `src/components/EnhancedFilters/FilterPanel.tsx` that:
   - Extends the existing filter UI
   - Shows view-specific filters when appropriate
   - Includes saved filter presets
   - Provides clear visual indication of active filters

These enhanced filtering capabilities will improve the user experience across all views while maintaining compatibility with existing code.
```

### Phase 4: Integration & View Routing

#### Step 4.1: View-Specific Pages & Routing

```markdown
Implement dedicated pages and routing for the new views while preserving existing routes.

Current context:
- We have components for all view types
- The current application uses Next.js routing
- We need to add new routes without breaking existing ones

Requirements:
1. Create view-specific pages:
   - `src/app/dashboard/po-view/page.tsx` for the PO view
   - `src/app/dashboard/dev-view/page.tsx` for the Dev view
   - `src/app/dashboard/team-view/page.tsx` for the Team view
   - Use feature flags to conditionally enable these routes

2. Implement route guards at `src/middleware.ts` that:
   - Check feature flags before allowing access to new routes
   - Redirect to appropriate fallback pages when features are disabled
   - Pass through all existing routes unchanged
   - Add appropriate metadata for new pages

3. Create a navigation service at `src/services/NavigationService.ts` that:
   - Handles transitions between different views
   - Preserves context when switching views (selected items, filters)
   - Updates URL to reflect current view
   - Manages browser history appropriately

This routing implementation adds new pages without disrupting existing routes.
```

#### Step 4.2: Context Preservation Between Views

```markdown
Implement context preservation to maintain user context when switching between views.

Current context:
- We have separate views with different organization schemes
- Users need to switch views while maintaining context
- The transition should feel seamless and logical

Requirements:
1. Create a context tracking service at `src/services/ContextTrackingService.ts` that:
   - Tracks selected items, filters, and page state
   - Maps context between different view types
   - Persists context during navigation
   - Handles cases where direct mapping isn't possible

2. Implement cross-view navigation helpers at `src/utils/viewNavigation.ts` that:
   - Provide methods to navigate between views with context
   - Calculate appropriate target state in the destination view
   - Generate deep links to specific items across views
   - Handle fallbacks when context can't be mapped

3. Create UI components for cross-view links at `src/components/shared/CrossViewLink.tsx` that:
   - Render links to the same content in different views
   - Include tooltips explaining the relationship
   - Handle cases where links aren't applicable
   - Use consistent visual styling

This context preservation creates a seamless experience when switching between different views of the same data.
```

#### Step 4.3: View Integration with Existing Dashboard

```markdown
Integrate the new views with the existing dashboard to create a cohesive experience.

Current context:
- We have implemented all new view components
- The existing dashboard remains the primary entry point
- We need to create a smooth transition between old and new

Requirements:
1. Enhance the dashboard home at `src/app/dashboard/page.tsx` to:
   - Include links to new views when features are enabled
   - Show preview cards for new views with key metrics
   - Maintain existing functionality as the default
   - Provide clear way to explore new features

2. Create transitional UI elements at `src/components/TransitionElements.tsx` that:
   - Appear within existing views to highlight new capabilities
   - Provide contextual links to relevant new views
   - Use subtle, non-disruptive styling
   - Include dismissible introductions to new features

3. Implement a unified dashboard experience at `src/components/UnifiedDashboard.tsx` that:
   - Acts as container for both existing and new views
   - Maintains consistent header and navigation
   - Smoothly transitions between views
   - Preserves user preferences across the application

This integration creates a cohesive experience that introduces new features while preserving existing functionality.
```

### Phase 5: Polish & Optimization

#### Step 5.1: Performance Optimization

```markdown
Optimize performance across the application, focusing on areas that may be affected by the new views.

Current context:
- The application has new views with potentially complex data needs
- Performance should remain good with large datasets
- Existing functionality should not be slowed down

Requirements:
1. Implement virtualized lists for table components:
   - Add virtualization to `src/components/POView/TicketGroup.tsx`
   - Optimize `src/components/DevView/StatusGroup.tsx` for large lists
   - Enhance `src/components/TeamView/TicketSummaryTable.tsx` for performance
   - Ensure smooth scrolling with large datasets

2. Create a data prefetching strategy at `src/services/DataPrefetching.ts` that:
   - Intelligently loads data likely to be needed soon
   - Prioritizes data for the active view
   - Cancels unnecessary requests on navigation
   - Uses idle time for background loading

3. Implement code splitting and lazy loading:
   - Set up dynamic imports for view-specific components
   - Add loading indicators for lazy-loaded content
   - Preload components when appropriate
   - Configure chunking for optimal loading

These optimizations ensure the application remains performant even with the additional views and data.
```

#### Step 5.2: Visual Consistency & Design System Alignment

```markdown
Ensure visual consistency across both existing and new components, aligning with the design system.

Current context:
- The application uses a shadcn/ui based design system
- New components should be visually consistent with existing ones
- The transition between views should feel seamless

Requirements:
1. Conduct a comprehensive style audit:
   - Review all new components for consistency with design system
   - Ensure proper use of color tokens, spacing, and typography
   - Verify dark mode compatibility across all components
   - Standardize animation patterns and timings

2. Create shared UI utilities at `src/components/shared/DesignSystem.tsx` that:
   - Provide consistent cards, headings, and layout elements
   - Ensure visual harmony between old and new components
   - Include standard patterns for loading states
   - Provide accessible color combinations

3. Implement consistent motion design at `src/utils/motionPatterns.ts` that:
   - Defines standard animations for transitions
   - Creates consistent interaction feedback
   - Respects user preferences for reduced motion
   - Optimizes animations for performance

This polish ensures a cohesive visual experience across the entire application.
```

#### Step 5.3: Accessibility Enhancements

```markdown
Enhance accessibility across both existing and new components to ensure the application is usable by everyone.

Current context:
- The application needs to be accessible to all users
- New views introduce additional interaction patterns
- We need to ensure a consistent accessibility experience

Requirements:
1. Implement focus management improvements:
   - Review tab order across all views
   - Ensure consistent focus indicators
   - Implement proper focus containment in modals
   - Add keyboard shortcuts for common actions

2. Enhance screen reader support:
   - Add ARIA labels and descriptions to all components
   - Create screen reader announcements for dynamic content
   - Ensure proper semantic structure
   - Test with multiple screen reader technologies

3. Create accessible data visualizations:
   - Add text alternatives for charts and graphs
   - Ensure color is not the only means of conveying information
   - Provide keyboard interaction for interactive visuals
   - Include screen reader descriptions for trends and patterns

These accessibility enhancements ensure the application is usable by all team members, regardless of abilities.
```

#### Step 5.4: Documentation & User Guidance

```markdown
Create documentation and user guidance for the new features to help users adapt to the enhanced functionality.

Current context:
- The application has new views and interaction patterns
- Users need to understand how to use the new features
- Documentation should be accessible within the application

Requirements:
1. Create in-app guides at `src/components/Guides/ViewGuides.tsx` that:
   - Provide overview of each new view
   - Highlight key features and capabilities
   - Show contextual hints for new interactions
   - Allow users to dismiss or recall guides as needed

2. Implement feature tours at `src/services/FeatureTours.ts` that:
   - Walk users through new functionality
   - Highlight relevant UI elements
   - Progress at the user's pace
   - Remember which tours have been completed

3. Create a help center at `src/components/HelpCenter/HelpCenter.tsx` that:
   - Provides searchable documentation
   - Includes frequently asked questions
   - Shows keyboard shortcuts and tips
   - Links to more detailed external documentation

This documentation and guidance will help users understand and adopt the new features.
```

## LLM Code Generation Approach

For each step in this plan, you'll want to:

1. **Provide Context**: Begin by showing the LLM the relevant existing code files that the new code will interact with
2. **Define the Task**: Clearly describe what needs to be implemented, referencing the step description
3. **Request Test-First Development**: Ask for tests before implementation code
4. **Request Implementation Code**: After tests, ask for the implementation code
5. **Request Integration Instructions**: Finally, ask for instructions on how to integrate the new code with existing code

Here's a template for each LLM prompt:

```
# Task: [Step Title]

## Context
- Current files in the codebase that relate to this task:
  - `[file path 1]`: [brief description]
  - `[file path 2]`: [brief description]
  
[Paste relevant portions of existing code here]

## Requirements
[Copy requirements from the step description]

## Request
Please help me implement this feature using test-driven development:

1. First, write comprehensive tests for the required functionality
2. Then, provide the implementation code that satisfies these tests
3. Finally, explain how to integrate this with the existing codebase

Please ensure backward compatibility with existing functionality and follow the project's coding style.
```

This approach will help the LLM generate code that fits seamlessly with your existing codebase while adding the new context-aware dashboard features without disrupting current functionality.
