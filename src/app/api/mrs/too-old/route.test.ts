import { NextRequest } from 'next/server';
import { GET } from './route';
import { fetchTeamMRs } from '@/lib/gitlab';
import { tooOldCache } from '@/lib/cache';

// Mock the GitLab API utility
jest.mock('@/lib/gitlab');
const mockedFetchTeamMRs = fetchTeamMRs as jest.MockedFunction<typeof fetchTeamMRs>;

// Mock environment variables
const originalEnv = { ...process.env };
beforeAll(() => {
  process.env.API_KEY = 'test-api-key';
});

afterAll(() => {
  process.env = originalEnv;
});

describe('/api/mrs/too-old', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tooOldCache.clear();
  });

  // Helper to create mock MRs with different creation dates
  const createMockMR = (id: number, daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      id,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      // Add other required fields...
    };
  };

  // Helper to create mock request
  const createMockRequest = (params: Record<string, string> = {}, headers: Record<string, string> = {}) => {
    const searchParams = new URLSearchParams(params);
    return new NextRequest('http://localhost/api/mrs/too-old?' + searchParams.toString(), {
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

  test('filters MRs older than 28 days', async () => {
    const mockMRs = [
      createMockMR(1, 30), // Too old
      createMockMR(2, 15), // Not too old
      createMockMR(3, 40), // Too old
    ];

    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: mockMRs,
      metadata: {
        totalItems: 3,
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
    expect(data.items.map((mr: any) => mr.id)).toEqual([1, 3]);
    expect(data.metadata.threshold).toBe(28);
    expect(data.metadata.lastRefreshed).toBeDefined();
  });

  test('handles pagination correctly', async () => {
    mockedFetchTeamMRs.mockResolvedValueOnce({
      items: [createMockMR(1, 30)],
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
    const mockMRs = [createMockMR(1, 30)];
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
    const mockMRs = [createMockMR(1, 30)];
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

  test('handles GitLab API errors', async () => {
    mockedFetchTeamMRs.mockRejectedValueOnce(new Error('GitLab API error'));

    const req = createMockRequest();
    const response = await GET(req);
    
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
}); 