import { NextRequest } from 'next/server';
import { GET } from './route';
import { fetchTeamMRs } from '@/lib/gitlab';
import { pendingReviewCache } from '@/lib/cache';

// Mock the GitLab API utility
jest.mock('@/lib/gitlab');
const mockedFetchTeamMRs = fetchTeamMRs as jest.MockedFunction<typeof fetchTeamMRs>;

// Mock environment variables
const originalEnv = { ...process.env };
beforeAll(() => {
  process.env.API_KEY = 'test-api-key';
  process.env.GITLAB_USER_IDS = '123:456:789';
});

afterAll(() => {
  process.env = originalEnv;
});

describe('/api/mrs/pending-review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pendingReviewCache.clear();
  });

  // Helper to create mock MRs with different update dates and reviewers
  const createMockMR = (id: number, daysAgo: number, reviewers: Array<{ id: number }>) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      id,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      reviewers,
      // Add other required fields...
    };
  };

  // Helper to create mock request
  const createMockRequest = (params: Record<string, string> = {}, headers: Record<string, string> = {}) => {
    const searchParams = new URLSearchParams(params);
    return new NextRequest('http://localhost/api/mrs/pending-review?' + searchParams.toString(), {
      headers: {
        'x-api-key': process.env.API_KEY!,
        ...headers,
      },
    });
  };

  test('returns 401 without valid API key', async () => {
    const req = createMockRequest({}, { 'x-api-key': 'invalid-key' });
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  test('filters MRs pending review not updated in 7 days', async () => {
    const mockMRs = [
      createMockMR(1, 10, [{ id: 123 }]), // Team member reviewer, not updated
      createMockMR(2, 3, [{ id: 123 }]),  // Team member reviewer, recently updated
      createMockMR(3, 10, [{ id: 999 }]), // Non-team reviewer, not updated
      createMockMR(4, 10, [{ id: 123 }, { id: 456 }]), // Multiple team reviewers
    ];

    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: mockMRs,
      metadata: {
        totalItems: 4,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    const req = createMockRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items.map((mr: any) => mr.id)).toEqual([1, 4]);
    expect(data.metadata.threshold).toBe(7);
    expect(data.metadata.lastRefreshed).toBeDefined();
  });

  test('handles multiple team member reviewers correctly', async () => {
    const mockMR = createMockMR(1, 10, [
      { id: 123 }, // Team member
      { id: 456 }, // Team member
      { id: 999 }, // Non-team member
    ]);

    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: [mockMR],
      metadata: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    const req = createMockRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe(1);
  });

  test('handles pagination correctly', async () => {
    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: [createMockMR(1, 10, [{ id: 123 }])],
      metadata: {
        totalItems: 10,
        totalPages: 2,
        currentPage: 2,
        perPage: 5,
        nextPage: undefined,
        prevPage: 1,
      },
    });

    const req = createMockRequest({ page: '2', per_page: '5' });
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockedFetchTeamMRs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        per_page: 5,
      })
    );
    expect(data.metadata.currentPage).toBe(2);
    expect(data.metadata.perPage).toBe(5);
  });

  test('uses cache for repeated requests', async () => {
    const mockMRs = [createMockMR(1, 10, [{ id: 123 }])];
    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: mockMRs,
      metadata: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    // First request
    const req1 = createMockRequest();
    await GET(req1);

    // Second request should use cache
    const req2 = createMockRequest();
    await GET(req2);

    expect(mockedFetchTeamMRs).toHaveBeenCalledTimes(1);
  });

  test('skips cache when skip_cache=true', async () => {
    const mockMRs = [createMockMR(1, 10, [{ id: 123 }])];
    mockedFetchTeamMRs.mockResolvedValue({
      items: mockMRs,
      metadata: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    // First request
    const req1 = createMockRequest();
    await GET(req1);

    // Second request with skip_cache=true
    const req2 = createMockRequest({ skip_cache: 'true' });
    await GET(req2);

    expect(mockedFetchTeamMRs).toHaveBeenCalledTimes(2);
  });

  test('handles empty reviewers array', async () => {
    const mockMR = {
      id: 1,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      reviewers: [],
    };

    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: [mockMR],
      metadata: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    const req = createMockRequest();
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(0);
  });

  test('handles GitLab API errors', async () => {
    mockedFetchTeamMRs.mockRejectedValueOnce(new Error('GitLab API error'));

    const req = createMockRequest();
    const response = await GET(req);
    
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
}); 