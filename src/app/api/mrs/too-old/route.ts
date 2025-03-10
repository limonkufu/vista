import { NextRequest, NextResponse } from 'next/server';
import { fetchTeamMRs, GitLabMR } from '@/lib/gitlab';
import { tooOldCache } from '@/lib/cache';

// Constants
const THRESHOLD_DAYS = 28;
const DEFAULT_GROUP_ID = '3180705';
const DEFAULT_PAGE_SIZE = 25;

/**
 * Filter MRs that are older than the threshold
 */
function filterTooOldMRs(mrs: GitLabMR[]): GitLabMR[] {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS);

  return mrs.filter(mr => {
    const createdAt = new Date(mr.created_at);
    return createdAt < thresholdDate;
  });
}

/**
 * GET /api/mrs/too-old
 * Returns MRs that are older than 28 days
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || String(DEFAULT_PAGE_SIZE), 10);
    const skipCache = searchParams.get('skip_cache') === 'true';

    // Check for API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate cache key based on pagination params
    const cacheKey = `too-old-${page}-${perPage}`;

    // Try to get from cache first
    if (!skipCache) {
      const cachedData = tooOldCache.get(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
    }

    // Fetch MRs from GitLab
    const response = await fetchTeamMRs({
      groupId: DEFAULT_GROUP_ID,
      page,
      per_page: perPage,
      state: 'opened', // Only get open MRs
    });

    // Filter too old MRs
    const tooOldMRs = filterTooOldMRs(response.items);

    // Prepare response
    const result = {
      items: tooOldMRs,
      metadata: {
        ...response.metadata,
        threshold: THRESHOLD_DAYS,
        lastRefreshed: new Date().toISOString(),
      },
    };

    // Cache the result
    if (!skipCache) {
      tooOldCache.set(cacheKey, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/mrs/too-old:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 