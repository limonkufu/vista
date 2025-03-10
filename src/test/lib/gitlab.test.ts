import axios from 'axios';

// Mock axios before importing the module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Save and mock environment variables
const originalEnv = { ...process.env };
process.env.GITLAB_API_TOKEN = 'mock-api-token';
process.env.GITLAB_USER_IDS = '123:456:789';

// Import the module after environment setup
import { 
  fetchTeamMRs,
  isTeamMember,
  isTeamRelevantMR,
  GitLabUser,
  GitLabMR 
} from '../../lib/gitlab';

describe('GitLab API Utility', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('isTeamMember', () => {
    test('identifies team members correctly', () => {
      // Team member (ID in env variable)
      const teamMember: GitLabUser = { id: 123, name: 'Team Member', username: 'team_member' };
      expect(isTeamMember(teamMember)).toBe(true);
      
      // Non-team member
      const nonTeamMember: GitLabUser = { id: 999, name: 'Non Team Member', username: 'non_team_member' };
      expect(isTeamMember(nonTeamMember)).toBe(false);
      
      // Edge cases
      expect(isTeamMember(undefined as unknown as GitLabUser)).toBe(false);
      expect(isTeamMember({} as GitLabUser)).toBe(false);
    });
  });
  
  describe('isTeamRelevantMR', () => {
    test('identifies MRs relevant to the team', () => {
      const teamMember: GitLabUser = { id: 123, name: 'Team Member', username: 'team_member' };
      const nonTeamMember: GitLabUser = { id: 999, name: 'Non Team Member', username: 'non_team_member' };
      
      // Author is team member
      expect(isTeamRelevantMR({ 
        author: teamMember, 
        assignees: [], 
        reviewers: []
      } as GitLabMR)).toBe(true);
      
      // Assignee is team member
      expect(isTeamRelevantMR({ 
        author: nonTeamMember, 
        assignees: [teamMember], 
        reviewers: []
      } as GitLabMR)).toBe(true);
      
      // Reviewer is team member
      expect(isTeamRelevantMR({ 
        author: nonTeamMember, 
        assignees: [], 
        reviewers: [teamMember]
      } as GitLabMR)).toBe(true);
      
      // No team members involved
      expect(isTeamRelevantMR({ 
        author: nonTeamMember, 
        assignees: [nonTeamMember], 
        reviewers: [nonTeamMember]
      } as GitLabMR)).toBe(false);
      
      // Edge cases
      expect(isTeamRelevantMR(undefined as unknown as GitLabMR)).toBe(false);
    });
  });
  
  describe('fetchTeamMRs', () => {
    test('fetches and filters MRs correctly', async () => {
      // Mock data
      const teamMember = { id: 123, name: 'Team Member', username: 'team_member' };
      const nonTeamMember = { id: 999, name: 'Non Team Member', username: 'non_team_member' };
      
      const mockMRs = [
        { id: 1, author: teamMember, assignees: [], reviewers: [] },
        { id: 2, author: nonTeamMember, assignees: [teamMember], reviewers: [] },
        { id: 3, author: nonTeamMember, assignees: [], reviewers: [teamMember] },
        { id: 4, author: nonTeamMember, assignees: [nonTeamMember], reviewers: [nonTeamMember] }
      ];
      
      // Mock API response
      mockedAxios.get.mockResolvedValueOnce({
        data: mockMRs,
        headers: {
          'x-total': '4',
          'x-total-pages': '1',
          'x-next-page': '',
          'x-prev-page': ''
        }
      });
      
      const result = await fetchTeamMRs({ groupId: '12345' });
      
      // Check axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/groups/12345/merge_requests',
        expect.objectContaining({
          headers: { 'PRIVATE-TOKEN': 'mock-api-token' },
          params: expect.objectContaining({
            page: 1,
            per_page: 100
          })
        })
      );
      
      // Should filter out item with ID 4 (no team members)
      expect(result.items.length).toBe(3);
      expect(result.items.map(mr => mr.id)).toEqual([1, 2, 3]);
    });
    
    test('handles pagination correctly', async () => {
      // Mock API response for page 2
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ id: 5, author: { id: 123 }, assignees: [], reviewers: [] }],
        headers: {
          'x-total': '10',
          'x-total-pages': '2',
          'x-next-page': '',
          'x-prev-page': '1'
        }
      });
      
      const result = await fetchTeamMRs({ 
        groupId: '12345',
        page: 2,
        per_page: 5
      });
      
      // Check correct page was requested
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
            per_page: 5
          })
        })
      );
      
      // Check pagination metadata
      expect(result.metadata).toEqual({
        totalItems: 10,
        totalPages: 2,
        currentPage: 2,
        perPage: 5,
        nextPage: undefined,
        prevPage: 1
      });
    });
    
    test('retries on server errors', async () => {
      // First call fails with 500, second succeeds
      mockedAxios.get
        .mockRejectedValueOnce({ 
          response: { status: 500 } 
        })
        .mockResolvedValueOnce({
          data: [{ id: 1, author: { id: 123 }, assignees: [], reviewers: [] }],
          headers: {
            'x-total': '1',
            'x-total-pages': '1',
            'x-next-page': '',
            'x-prev-page': ''
          }
        });
      
      // Don't actually wait for timeouts in the test
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });
      
      const result = await fetchTeamMRs({ 
        groupId: '12345',
        maxRetries: 1
      });
      
      // Should have been called twice
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result.items.length).toBe(1);
      
      // Restore setTimeout
      (global.setTimeout as jest.Mock).mockRestore();
    });
  });
}); 