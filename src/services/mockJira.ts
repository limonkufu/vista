/**
 * Mock Jira service for development
 *
 * This service provides realistic Jira data for development without requiring
 * actual Jira integration. It generates random tickets and associates them with
 * existing MRs.
 */

import {
  JiraTicket,
  JiraTicketStatus,
  JiraTicketPriority,
  JiraTicketType,
  JiraUser,
  JiraTicketWithMRs,
  JiraQueryOptions,
  GitLabMRWithJira,
  extractJiraKeyFromText,
} from "@/types/Jira";

// Sample project keys for generating tickets
const PROJECT_KEYS = ["PROJ", "FE", "BE", "INFRA", "UI", "API"];

// Sample epic names
const EPIC_NAMES = [
  "User Authentication Redesign",
  "Performance Optimization",
  "Mobile Responsiveness",
  "API Modernization",
  "Dashboard Improvements",
  "Search Enhancement",
];

// Sample sprint names
const SPRINT_NAMES = [
  "Sprint 23",
  "Sprint 24",
  "Sprint 25",
  "Q2 Planning",
  "Bug Bash Week",
];

// Sample users
const SAMPLE_USERS: JiraUser[] = [
  { id: "user1", name: "Alex Johnson", email: "alex@example.com" },
  { id: "user2", name: "Taylor Smith", email: "taylor@example.com" },
  { id: "user3", name: "Jordan Lee", email: "jordan@example.com" },
  { id: "user4", name: "Casey Brown", email: "casey@example.com" },
  { id: "user5", name: "Morgan Wilson", email: "morgan@example.com" },
];

// Sample labels
const SAMPLE_LABELS = [
  "frontend",
  "backend",
  "critical",
  "documentation",
  "tech-debt",
  "enhancement",
  "refactor",
  "security",
  "performance",
  "ux",
];

// Cache for generated tickets
let mockTicketsCache: JiraTicket[] = [];

/**
 * Generate a random Jira ticket
 */
function generateMockTicket(id: number): JiraTicket {
  const projectKey =
    PROJECT_KEYS[Math.floor(Math.random() * PROJECT_KEYS.length)];
  const ticketNumber = id + 100; // Start from 100
  const key = `${projectKey}-${ticketNumber}`;

  const typeValues = Object.values(JiraTicketType);
  const type = typeValues[Math.floor(Math.random() * typeValues.length)];

  const statusValues = Object.values(JiraTicketStatus);
  const status = statusValues[Math.floor(Math.random() * statusValues.length)];

  const priorityValues = Object.values(JiraTicketPriority);
  const priority =
    priorityValues[Math.floor(Math.random() * priorityValues.length)];

  const assignee =
    Math.random() > 0.2
      ? SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)]
      : undefined;

  const reporter =
    SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];

  // Generate random dates within reasonable range
  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 60));

  const updatedDate = new Date(createdDate);
  updatedDate.setDate(updatedDate.getDate() + Math.floor(Math.random() * 30));

  // Maybe add a due date
  const dueDate =
    Math.random() > 0.5
      ? new Date(
          updatedDate.getTime() +
            Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
        ).toISOString()
      : undefined;

  // Random epic
  const hasEpic = Math.random() > 0.3;
  const epicIndex = Math.floor(Math.random() * EPIC_NAMES.length);
  const epicKey = hasEpic ? `${projectKey}-${epicIndex + 1}` : undefined;
  const epicName = hasEpic ? EPIC_NAMES[epicIndex] : undefined;

  // Random sprint
  const sprintName =
    Math.random() > 0.2
      ? SPRINT_NAMES[Math.floor(Math.random() * SPRINT_NAMES.length)]
      : undefined;

  // Random labels
  const labelCount = Math.floor(Math.random() * 4);
  const labels =
    labelCount > 0
      ? Array.from(
          { length: labelCount },
          () => SAMPLE_LABELS[Math.floor(Math.random() * SAMPLE_LABELS.length)]
        ).filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      : undefined;

  // Random story points
  const storyPoints =
    type === JiraTicketType.STORY || type === JiraTicketType.TASK
      ? [1, 2, 3, 5, 8, 13][Math.floor(Math.random() * 6)]
      : undefined;

  // Generate title based on type
  let title = "";
  switch (type) {
    case JiraTicketType.BUG:
      title = `Fix issue with ${
        ["login", "signup", "dashboard", "navigation", "search", "filtering"][
          Math.floor(Math.random() * 6)
        ]
      }`;
      break;
    case JiraTicketType.STORY:
      title = `As a user, I want to ${
        [
          "see my profile",
          "filter results",
          "export data",
          "customize settings",
          "receive notifications",
        ][Math.floor(Math.random() * 5)]
      }`;
      break;
    case JiraTicketType.TASK:
      title = `${
        ["Update", "Refactor", "Optimize", "Document", "Test"][
          Math.floor(Math.random() * 5)
        ]
      } ${
        ["API", "component", "function", "database query", "UI"][
          Math.floor(Math.random() * 5)
        ]
      }`;
      break;
    case JiraTicketType.EPIC:
      title = epicName || "Epic without name";
      break;
    default:
      title = `Ticket ${key}`;
  }

  return {
    id: `jira-${id}`,
    key,
    title,
    description: `This is a mock description for ticket ${key}. It's generated for development purposes.`,
    url: `https://jira.example.com/browse/${key}`,
    status,
    priority,
    type,
    created: createdDate.toISOString(),
    updated: updatedDate.toISOString(),
    dueDate,
    assignee,
    reporter,
    labels,
    epicKey,
    epicName,
    storyPoints,
    sprintName,
  };
}

/**
 * Generate mock Jira tickets
 */
function generateMockTickets(count: number): JiraTicket[] {
  if (mockTicketsCache.length === count) {
    return [...mockTicketsCache];
  }

  const tickets = Array.from({ length: count }, (_, i) =>
    generateMockTicket(i)
  );
  mockTicketsCache = [...tickets];
  return tickets;
}

/**
 * Filter tickets based on query options
 */
function filterTickets(
  tickets: JiraTicket[],
  options?: JiraQueryOptions
): JiraTicket[] {
  if (!options) return tickets;

  return tickets.filter((ticket) => {
    // Filter by status
    if (options.statuses && options.statuses.length > 0) {
      if (!options.statuses.includes(ticket.status)) return false;
    }

    // Filter by type
    if (options.types && options.types.length > 0) {
      if (!options.types.includes(ticket.type)) return false;
    }

    // Filter by priority
    if (options.priorities && options.priorities.length > 0) {
      if (!options.priorities.includes(ticket.priority)) return false;
    }

    // Filter by assignee
    if (options.assignees && options.assignees.length > 0) {
      if (!ticket.assignee || !options.assignees.includes(ticket.assignee.id))
        return false;
    }

    // Filter by sprint
    if (options.sprintName) {
      if (ticket.sprintName !== options.sprintName) return false;
    }

    // Filter by epic
    if (options.epicKey) {
      if (ticket.epicKey !== options.epicKey) return false;
    }

    // Filter by search term
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      const inTitle = ticket.title.toLowerCase().includes(searchLower);
      const inKey = ticket.key.toLowerCase().includes(searchLower);
      const inDescription =
        ticket.description?.toLowerCase().includes(searchLower) || false;

      if (!inTitle && !inKey && !inDescription) return false;
    }

    // Filter by labels
    if (options.labels && options.labels.length > 0) {
      if (!ticket.labels) return false;

      const hasAnyLabel = options.labels.some((label) =>
        ticket.labels?.includes(label)
      );

      if (!hasAnyLabel) return false;
    }

    // Passed all filters
    return true;
  });
}

/**
 * Map GitLab MRs to Jira tickets based on MR title and description
 */
function mapMRsToTickets(mrs: any[], tickets: JiraTicket[]): any[] {
  const ticketsByKey = tickets.reduce<Record<string, JiraTicket>>(
    (acc, ticket) => {
      acc[ticket.key] = ticket;
      return acc;
    },
    {}
  );

  return mrs.map((mr) => {
    // Try to extract Jira key from title or description
    const titleKey = mr.title ? extractJiraKeyFromText(mr.title) : null;
    const descriptionKey = mr.description
      ? extractJiraKeyFromText(mr.description)
      : null;
    const branchKey = mr.source_branch
      ? extractJiraKeyFromText(mr.source_branch)
      : null;

    // Use the first key found
    const jiraTicketKey = titleKey || descriptionKey || branchKey;

    // Look up the ticket if we found a key
    const jiraTicket = jiraTicketKey ? ticketsByKey[jiraTicketKey] : undefined;

    return {
      ...mr,
      jiraTicket,
      jiraTicketKey,
    };
  });
}

/**
 * Group MRs by Jira ticket
 */
function groupMRsByTicket(
  mrs: unknown[],
  tickets: JiraTicket[]
): JiraTicketWithMRs[] {
  const ticketMap = new Map<string, unknown[]>();

  // Initialize the map with empty arrays for all tickets
  tickets.forEach((ticket) => {
    ticketMap.set(ticket.key, []);
  });

  // Group MRs by ticket key
  mrs.forEach((mr: any) => {
    if (mr.jiraTicketKey && ticketMap.has(mr.jiraTicketKey)) {
      ticketMap.get(mr.jiraTicketKey)?.push(mr);
    }
  });

  // Create JiraTicketWithMRs objects
  return tickets.map((ticket) => {
    const ticketMrs = ticketMap.get(ticket.key) || [];

    return {
      ticket,
      mrs: ticketMrs as GitLabMRWithJira[],
      totalMRs: ticketMrs.length,
      openMRs: (ticketMrs as any[]).filter((mr) => mr.state === "opened")
        .length,
      overdueMRs: Math.floor(Math.random() * ticketMrs.length),
      stalledMRs: Math.floor(Math.random() * ticketMrs.length),
    };
  });
}

/**
 * Mock Jira API service
 *
 * This service simulates the behavior of a real Jira API integration,
 * but generates mock data instead of making actual API calls.
 */
export const MockJiraService = {
  /**
   * Get all Jira tickets
   */
  async getTickets(options?: JiraQueryOptions): Promise<JiraTicket[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Apply filters
    return filterTickets(tickets, options);
  },

  /**
   * Get a single Jira ticket by key
   */
  async getTicket(key: string): Promise<JiraTicket | null> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 300 + Math.random() * 500)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Find the ticket with matching key
    return tickets.find((ticket) => ticket.key === key) || null;
  },

  /**
   * Map GitLab MRs to Jira tickets
   */
  async mapMRsToTickets(mrs: any[]): Promise<any[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 300 + Math.random() * 500)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Map MRs to tickets
    return mapMRsToTickets(mrs, tickets);
  },

  /**
   * Group MRs by Jira ticket
   */
  async getMRsGroupedByTicket(mrs: any[]): Promise<JiraTicketWithMRs[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 800 + Math.random() * 1000)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Map MRs to tickets
    const mappedMRs = mapMRsToTickets(mrs, tickets);

    // Group MRs by ticket
    return groupMRsByTicket(mappedMRs, tickets);
  },

  /**
   * Get users for assignee selection
   */
  async getUsers(): Promise<JiraUser[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 300 + Math.random() * 500)
    );

    return [...SAMPLE_USERS];
  },

  /**
   * Get Jira tickets with MRs directly
   * This is used by role-based views to get tickets with their associated MRs
   */
  async getTicketsWithMRs(
    options?: JiraQueryOptions
  ): Promise<JiraTicketWithMRs[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 800 + Math.random() * 1000)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Filter tickets based on options
    const filteredTickets = filterTickets(tickets, options);

    // Generate some mock MRs for each ticket
    const ticketsWithMRs: JiraTicketWithMRs[] = filteredTickets.map(
      (ticket) => {
        // Generate 0-4 mock MRs per ticket
        const mrCount = Math.floor(Math.random() * 5);
        const mrs = Array.from({ length: mrCount }, (_, i) => ({
          id: Math.floor(Math.random() * 10000),
          iid: Math.floor(Math.random() * 10000),
          project_id: Math.floor(Math.random() * 100),
          title: `Fix for ${ticket.key}: ${ticket.title.substring(0, 30)}...`,
          description: `This MR addresses the issue described in ${ticket.key}`,
          state: ["opened", "merged", "closed"][Math.floor(Math.random() * 3)],
          created_at: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          updated_at: new Date(
            Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000
          ).toISOString(),
          web_url: `https://gitlab.example.com/project/merge_requests/${Math.floor(
            Math.random() * 1000
          )}`,
          author: {
            id: Math.floor(Math.random() * 100),
            name: SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)]
              .name,
            username: `user${Math.floor(Math.random() * 5) + 1}`,
          },
          // Add additional required fields
          source_branch: `feature/branch-${i}`,
          target_branch: "main",
          merge_status: ["can_be_merged", "cannot_be_merged", "unchecked"][
            Math.floor(Math.random() * 3)
          ],
          user_notes_count: Math.floor(Math.random() * 10),
          upvotes: Math.floor(Math.random() * 5),
          downvotes: Math.floor(Math.random() * 2),
          reviewers: Array.from(
            { length: Math.floor(Math.random() * 4) },
            (_, j) => {
              const reviewer =
                SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];
              return {
                id: j + 1,
                name: reviewer.name,
                username: `reviewer${j + 1}`,
                avatar_url: undefined,
              };
            }
          ),
          jiraTicketKey: ticket.key,
          jiraTicket: ticket,
        }));

        return {
          ticket,
          mrs,
        };
      }
    );

    return ticketsWithMRs;
  },

  /**
   * Get merge requests with Jira information
   * This is used by the Dev View to show MRs with their Jira context
   */
  async getMergeRequestsWithJira(options?: {
    skipCache?: boolean;
    projectId?: number;
    authorId?: number;
  }): Promise<GitLabMRWithJira[]> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 600 + Math.random() * 800)
    );

    // Generate mock tickets
    const tickets = generateMockTickets(50);

    // Generate mock MRs with Jira info
    const totalMRs = 25;
    const mrs: GitLabMRWithJira[] = Array.from(
      { length: totalMRs },
      (_, index) => {
        // Random ticket for each MR
        const randomTicketIndex = Math.floor(Math.random() * tickets.length);
        const ticket = tickets[randomTicketIndex];

        // 75% chance of having a Jira ticket
        const hasJiraTicket = Math.random() > 0.25;

        // If options include project filtering, apply it
        const projectId =
          options?.projectId || Math.floor(Math.random() * 5) + 1;

        const mrId = 1000 + index;

        return {
          id: mrId,
          iid: 100 + index,
          project_id: projectId,
          title: hasJiraTicket
            ? `[${ticket.key}] Fix for ${ticket.title.substring(0, 30)}...`
            : `Generic MR without Jira reference ${index}`,
          description: hasJiraTicket
            ? `This MR addresses the issue described in ${ticket.key}`
            : `Description for MR ${index}`,
          state: ["opened", "merged", "closed"][Math.floor(Math.random() * 3)],
          created_at: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          updated_at: new Date(
            Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000
          ).toISOString(),
          web_url: `https://gitlab.example.com/project/merge_requests/${
            100 + index
          }`,
          author: {
            id: options?.authorId || Math.floor(Math.random() * 5) + 1,
            name: SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)]
              .name,
            username: `user${
              options?.authorId || Math.floor(Math.random() * 5) + 1
            }`,
          },
          // Add additional GitLab MR fields needed by DevView
          source_branch: `feature/branch-${index}`,
          target_branch: "main",
          merge_status: ["can_be_merged", "cannot_be_merged", "unchecked"][
            Math.floor(Math.random() * 3)
          ],
          user_notes_count: Math.floor(Math.random() * 10),
          upvotes: Math.floor(Math.random() * 5),
          downvotes: Math.floor(Math.random() * 2),
          // Add reviewers
          reviewers: Array.from(
            { length: Math.floor(Math.random() * 4) },
            (_, i) => {
              const reviewer =
                SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];
              return {
                id: i + 1,
                name: reviewer.name,
                username: `reviewer${i + 1}`,
                avatar_url: undefined,
              };
            }
          ),
          jiraTicketKey: hasJiraTicket ? ticket.key : undefined,
          jiraTicket: hasJiraTicket ? ticket : undefined,
        };
      }
    );

    // Apply filtering if options are provided
    if (options) {
      return mrs.filter((mr) => {
        // Filter by project
        if (
          options.projectId !== undefined &&
          mr.project_id !== options.projectId
        ) {
          return false;
        }

        // Filter by author
        if (
          options.authorId !== undefined &&
          mr.author.id !== options.authorId
        ) {
          return false;
        }

        return true;
      });
    }

    return mrs;
  },
};
