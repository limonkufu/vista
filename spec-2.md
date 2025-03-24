# Context-Aware MR Dashboard Specification

## 1. Overview

The Context-Aware MR Dashboard is an enhancement to the existing GitLab MR Analytics Dashboard that preserves the current hygiene tracking functionality while adding new role-based views to provide different perspectives based on user needs.

### Objectives

1. Maintain existing MR hygiene tracking functionality
2. Add new role-based views (PO, Dev, Team-wide)
3. Implement Jira ticket integration for PO view
4. Create a seamless user experience for switching between views
5. Enhance filtering and grouping capabilities

## 2. Dashboard Modes

### 2.1 Hygiene Mode (Existing)

The current view focused on tracking technical debt with three panels:

- **Old Merge Requests**: MRs created more than 28 days ago
- **Inactive Merge Requests**: MRs not updated in the last 14 days
- **Pending Review**: MRs awaiting review for more than 7 days

All existing filtering, refresh, and pagination capabilities will be preserved.

### 2.2 Role-Based Mode (New)

A new set of views tailored to specific user roles:

#### 2.2.1 PO View

- **Primary Organization**: MRs grouped by Jira tickets
- **Key Information**: Jira ticket ID, ticket title, associated MRs, status
- **Actions**: View MR, Mark as Reviewed, Flag for Follow-up

#### 2.2.2 Dev View

- **Primary Organization**: MRs grouped by status (Needs Action, Changes Requested)
- **Key Information**: MR title, Jira ticket, reviewer, last updated
- **Actions**: View MR, Start Review, Request Changes

#### 2.2.3 Team-Wide View

- **Primary Organization**: Aggregated data by Jira ticket
- **Key Information**: Jira ticket, MR count, overdue MRs, stalled MRs
- **Actions**: View Details (expands to show individual MRs)

## 3. UI Components

### 3.1 Global Navigation

- **Header Bar**: Logo, global search, mode switcher, user profile
- **View Switcher**: Toggle between Hygiene, PO, Dev, and Team-Wide views
- **Quick Actions**: Refresh All, Clear Filters, Export Data

### 3.2 Sidebar

- **Filters**:
  - By Status: Dropdown for MR statuses
  - By Assignee: Dropdown for team members
  - By Repository: Dropdown for specific repositories
  - By Age: Options for various time ranges
- **Quick Links**: Customized by view type

### 3.3 Main Content Area

#### 3.3.1 PO View Table

- **Columns**: Jira Ticket ID, Jira Ticket Title, MR Title, Assignee, Status, Last Updated, Actions
- **Grouping**: Rows grouped by Jira tickets
- **Collapsible**: Jira ticket groups can be expanded/collapsed

#### 3.3.2 Dev View Table

- **Columns**: MR Title, Jira Ticket ID, Status, Reviewer, Last Updated, Actions
- **Grouping**: Rows grouped by status
- **Indicators**: Visual indicators for urgent items

#### 3.3.3 Team-Wide View Table

- **Columns**: Jira Ticket ID, Jira Ticket Title, MR Count, Overdue MRs, Stalled MRs, Actions
- **Expandable**: Each row expands to show detailed MR information

## 4. Data Requirements

### 4.1 GitLab Data (Existing)

- Merge request details (title, author, assignees, reviewers, dates)
- User information
- Repository information

### 4.2 Jira Integration (New)

- Jira ticket ID
- Jira ticket title
- Jira ticket status
- Mapping between MRs and Jira tickets

### 4.3 Data Structure

```typescript
interface JiraTicket {
  id: string;
  title: string;
  status: string;
  url: string;
  assignee?: string;
}

interface GitLabMRWithJira extends GitLabMR {
  jiraTicket?: JiraTicket;
}

interface JiraTicketWithMRs {
  ticket: JiraTicket;
  mergeRequests: GitLabMR[];
  overdueMRs: number;
  stalledMRs: number;
}
```

## 5. API Endpoints

### 5.1 Existing Endpoints

- `/api/mrs/too-old`
- `/api/mrs/not-updated`
- `/api/mrs/pending-review`
- `/api/users`

### 5.2 New Endpoints

- `/api/jira/tickets`: Get Jira tickets associated with team
- `/api/jira/tickets/:id/mrs`: Get MRs associated with a specific Jira ticket
- `/api/mrs/:id/jira`: Get Jira information for a specific MR

## 6. User Experience

### 6.1 View Switching

- Users should be able to switch between views without losing their current context
- Filters should be preserved when possible when switching views
- Last used view should be remembered for subsequent sessions

### 6.2 Responsive Design

- All views must be fully responsive and usable on mobile devices
- Collapsible groups will help manage screen real estate on smaller devices
- Simplified views for mobile with focus on key information

### 6.3 Performance Considerations

- Caching strategy should be enhanced to support multiple view types
- Lazy loading for expanded content in grouped views
- Progressive loading for large datasets

## 7. Technical Considerations

### 7.1 Jira Integration

- Jira API access will require appropriate credentials
- Token-based authentication for secure API access
- Regular synchronization for up-to-date information

### 7.2 MR-Jira Association

- Parse Jira ticket IDs from MR titles, descriptions, or branch names
- Allow manual association for edge cases
- Store associations in local cache for performance

### 7.3 State Management

- Extend current state management to handle multiple view types
- Implement context providers for view-specific state
- Ensure consistent data across views

## 8. Future Expansion

### 8.1 Additional Views

- Individual Contributor View
- Manager View
- Project-Based View

### 8.2 Enhanced Analytics

- Trends over time
- Team performance metrics
- Predictive analytics for bottlenecks

## 9. Success Metrics

### 9.1 User Adoption

- Percentage of users using role-based views
- Time spent in each view type

### 9.2 Efficiency Improvements

- Reduction in MR review time
- Improvement in MR throughput
- Reduction in overdue MRs
