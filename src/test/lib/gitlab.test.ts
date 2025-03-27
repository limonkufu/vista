// File: src/test/lib/gitlab.test.ts
import axios from "axios";
import {
  fetchUsersByGroupName,
  searchUsersByNameOrUsername,
  fetchUsersByIds,
  getDefaultTeamUsers,
  getTeamUserIds,
  isTeamMember,
  isTeamRelevantMR,
  fetchAllTeamMRs,
  GitLabUser,
  GitLabMR,
} from "@/lib/gitlab"; // Adjust path as needed
import { gitlabApiCache } from "@/lib/gitlabCache"; // Import cache

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  measurePerformance: jest.fn((name, fn) => fn()),
}));

// --- Mock Data ---
const mockTeamUser1: GitLabUser = {
  id: 1,
  name: "Team User One",
  username: "team_user_1",
  state: "active",
};
const mockTeamUser2: GitLabUser = {
  id: 2,
  name: "Team User Two",
  username: "team_user_2",
  state: "active",
};
const mockNonTeamUser: GitLabUser = {
  id: 99,
  name: "Non Team User",
  username: "non_team_user",
  state: "active",
};
const mockTeamUsers = [mockTeamUser1, mockTeamUser2];

const mockMR1: Partial<GitLabMR> = {
  id: 101,
  title: "MR by Team Member",
  author: mockTeamUser1,
  assignees: [mockNonTeamUser],
  reviewers: [],
};
const mockMR2: Partial<GitLabMR> = {
  id: 102,
  title: "MR assigned to Team Member",
  author: mockNonTeamUser,
  assignees: [mockTeamUser2],
  reviewers: [],
};
const mockMR3: Partial<GitLabMR> = {
  id: 103,
  title: "MR reviewed by Team Member",
  author: mockNonTeamUser,
  assignees: [],
  reviewers: [mockTeamUser1],
};
const mockMR4: Partial<GitLabMR> = {
  id: 104,
  title: "MR not relevant to team",
  author: mockNonTeamUser,
  assignees: [mockNonTeamUser],
  reviewers: [mockNonTeamUser],
};

describe("GitLab API Utility", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env }; // Store original env
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gitlabApiCache.clear(); // Clear cache before each test
    // Set default env vars for tests
    process.env.GITLAB_API_TOKEN = "mock-api-token";
    process.env.GITLAB_USER_IDS = "1:2"; // Default team for tests
    process.env.GITLAB_GROUP_ID = "mock-group-id";
  });

  afterAll(() => {
    process.env = originalEnv; // Restore original env
  });

  // --- Helper Function Tests ---
  describe("getTeamUserIds", () => {
    it("should parse valid IDs from environment variable", () => {
      process.env.GITLAB_USER_IDS = "1:2:3:invalid:4";
      expect(getTeamUserIds()).toEqual([1, 2, 3, 4]);
    });

    it("should return empty array if env var is missing or empty", () => {
      delete process.env.GITLAB_USER_IDS;
      expect(getTeamUserIds()).toEqual([]);
      process.env.GITLAB_USER_IDS = "";
      expect(getTeamUserIds()).toEqual([]);
    });
  });

  describe("isTeamMember", () => {
    it("should return true if user is in the team list", () => {
      expect(isTeamMember(mockTeamUser1, mockTeamUsers)).toBe(true);
    });

    it("should return false if user is not in the team list", () => {
      expect(isTeamMember(mockNonTeamUser, mockTeamUsers)).toBe(false);
    });

    it("should return false for invalid input", () => {
      expect(isTeamMember(null as any, mockTeamUsers)).toBe(false);
      expect(isTeamMember(mockTeamUser1, null as any)).toBe(false);
      expect(isTeamMember(mockTeamUser1, [])).toBe(false);
    });
  });

  describe("isTeamRelevantMR", () => {
    it("should return true if author is a team member", () => {
      expect(isTeamRelevantMR(mockMR1 as GitLabMR, mockTeamUsers)).toBe(true);
    });

    it("should return true if an assignee is a team member", () => {
      expect(isTeamRelevantMR(mockMR2 as GitLabMR, mockTeamUsers)).toBe(true);
    });

    it("should return true if a reviewer is a team member", () => {
      expect(isTeamRelevantMR(mockMR3 as GitLabMR, mockTeamUsers)).toBe(true);
    });

    it("should return false if no team members are involved", () => {
      expect(isTeamRelevantMR(mockMR4 as GitLabMR, mockTeamUsers)).toBe(false);
    });

    it("should return false for invalid input", () => {
      expect(isTeamRelevantMR(null as any, mockTeamUsers)).toBe(false);
      expect(isTeamRelevantMR(mockMR1 as GitLabMR, null as any)).toBe(false);
    });
  });

  // --- API Function Tests ---

  describe("fetchUsersByGroupName", () => {
    it("should fetch users for a valid group name", async () => {
      const mockGroup = { id: 123, name: "target-group", path: "target-group" };
      const mockMembers = [
        { id: 1, name: "User A", username: "user_a", state: "active" },
        { id: 2, name: "User B", username: "user_b", state: "blocked" }, // Should be filtered out
      ];
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockGroup] }) // Subgroup search
        .mockResolvedValueOnce({ data: mockMembers }); // Member fetch

      const users = await fetchUsersByGroupName("target-group");

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("user_a");
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/groups/ska-telescope%2Fska-dev/subgroups"),
        expect.objectContaining({ params: { search: "target-group" } })
      );
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(`/groups/${mockGroup.id}/members`),
        expect.any(Object)
      );
    });

    it("should return empty array if group not found", async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] }); // Subgroup search returns empty

      const users = await fetchUsersByGroupName("nonexistent-group");

      expect(users).toEqual([]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only subgroup search called
    });

    // Add tests for caching (check if axios is called only once on second call)
    it("should use cache on subsequent calls", async () => {
      const mockGroup = { id: 123, name: "target-group", path: "target-group" };
      const mockMembers = [
        { id: 1, name: "User A", username: "user_a", state: "active" },
      ];
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockGroup] })
        .mockResolvedValueOnce({ data: mockMembers });

      await fetchUsersByGroupName("target-group"); // First call
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      mockedAxios.get.mockClear(); // Reset mock call count

      const users = await fetchUsersByGroupName("target-group"); // Second call
      expect(users).toHaveLength(1);
      expect(mockedAxios.get).not.toHaveBeenCalled(); // Should hit cache
    });

    it("should skip cache when skipCache is true", async () => {
      const mockGroup = { id: 123, name: "target-group", path: "target-group" };
      const mockMembers = [
        { id: 1, name: "User A", username: "user_a", state: "active" },
      ];
      mockedAxios.get
        .mockResolvedValue({ data: [mockGroup] }) // Mock subgroup search for both calls
        .mockResolvedValue({ data: mockMembers }); // Mock member fetch for both calls

      await fetchUsersByGroupName("target-group", undefined, false); // Call 1 (caches)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      mockedAxios.get.mockClear();

      await fetchUsersByGroupName("target-group", undefined, true); // Call 2 (skip cache)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Should fetch again
    });
  });

  describe("searchUsersByNameOrUsername", () => {
    it("should search for active users", async () => {
      const mockSearchResults = [
        { id: 1, name: "Test User", username: "test_user", state: "active" },
        { id: 2, name: "Blocked User", username: "blocked", state: "blocked" },
      ];
      mockedAxios.get.mockResolvedValueOnce({ data: mockSearchResults });

      const users = await searchUsersByNameOrUsername("test");

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("test_user");
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/users"),
        expect.objectContaining({
          params: expect.objectContaining({ search: "test" }),
        })
      );
    });
    // Add cache tests similar to fetchUsersByGroupName
  });

  describe("fetchUsersByIds", () => {
    it("should fetch multiple active users by their IDs", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockTeamUser1 })
        .mockResolvedValueOnce({ data: mockTeamUser2 })
        .mockResolvedValueOnce({
          data: { ...mockNonTeamUser, state: "blocked" },
        }); // Mock one blocked user

      const users = await fetchUsersByIds([1, 2, 99]);

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.id)).toEqual([1, 2]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/users/1"),
        expect.any(Object)
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/users/2"),
        expect.any(Object)
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/users/99"),
        expect.any(Object)
      );
    });
    // Add cache tests
  });

  describe("getDefaultTeamUsers", () => {
    it("should fetch users based on GITLAB_USER_IDS", async () => {
      process.env.GITLAB_USER_IDS = "1:2";
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockTeamUser1 })
        .mockResolvedValueOnce({ data: mockTeamUser2 });

      const users = await getDefaultTeamUsers();

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.id)).toEqual([1, 2]);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Called fetchUsersByIds internally
    });

    it("should return empty array if GITLAB_USER_IDS is not set", async () => {
      delete process.env.GITLAB_USER_IDS;
      const users = await getDefaultTeamUsers();
      expect(users).toEqual([]);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("fetchAllTeamMRs", () => {
    // Mock team users for filtering
    const teamUsersForFetch = [
      { id: 1, name: "User 1", username: "user1", state: "active" },
      { id: 2, name: "User 2", username: "user2", state: "active" },
    ];

    const mockMRPage1 = [
      { id: 1, title: "MR 1", author: { id: 1 }, assignees: [], reviewers: [] }, // Relevant
      {
        id: 2,
        title: "MR 2",
        author: { id: 99 },
        assignees: [{ id: 2 }],
        reviewers: [],
      }, // Relevant
    ];
    const mockMRPage2 = [
      {
        id: 3,
        title: "MR 3",
        author: { id: 99 },
        assignees: [],
        reviewers: [{ id: 1 }],
      }, // Relevant
      {
        id: 4,
        title: "MR 4",
        author: { id: 99 },
        assignees: [{ id: 99 }],
        reviewers: [],
      }, // Not relevant
    ];

    it("should fetch all pages and filter relevant MRs", async () => {
      // Mock page 1 response
      mockedAxios.get.mockResolvedValueOnce({
        data: mockMRPage1,
        headers: { "x-total-pages": "2", "x-next-page": "2" },
      });
      // Mock page 2 response
      mockedAxios.get.mockResolvedValueOnce({
        data: mockMRPage2,
        headers: { "x-total-pages": "2", "x-next-page": "" },
      });

      const result = await fetchAllTeamMRs(
        { groupId: "mock-group-id" },
        teamUsersForFetch
      );

      expect(result.items).toHaveLength(3); // MRs 1, 2, 3 are relevant
      expect(result.items.map((mr) => mr.id)).toEqual([1, 2, 3]);
      expect(result.totalItems).toBe(3);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      // Check params for page 1
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/groups/mock-group-id/merge_requests"),
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, per_page: 100 }),
        })
      );
      // Check params for page 2
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/groups/mock-group-id/merge_requests"),
        expect.objectContaining({
          params: expect.objectContaining({ page: 2, per_page: 100 }),
        })
      );
    });

    it("should handle retries on API errors", async () => {
      // Mock failure then success
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 500 } }) // Fail page 1 once
        .mockResolvedValueOnce({
          // Success page 1
          data: mockMRPage1,
          headers: { "x-total-pages": "1", "x-next-page": "" },
        });

      // Mock setTimeout for immediate retry
      jest.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });

      const result = await fetchAllTeamMRs(
        { groupId: "mock-group-id", maxRetries: 1 },
        teamUsersForFetch
      );

      expect(result.items).toHaveLength(2); // Both MRs from page 1 are relevant
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Called twice due to retry

      (global.setTimeout as jest.Mock).mockRestore(); // Restore setTimeout
    });

    // Add cache tests for fetchAllTeamMRs (raw data cache and filtered cache)
  });
});
