import { NextRequest, NextResponse } from 'next/server';
import { fetchTeamMRs, GitLabMR } from '@/lib/gitlab';
import { notUpdatedCache } from '@/lib/cache';

// Constants
const THRESHOLD_DAYS = 14;
const DEFAULT_GROUP_ID = '3180705';
const DEFAULT_PAGE_SIZE = 25;

/**
 * Filter MRs that haven't been updated within the threshold
 */
function filterNotUpdatedMRs(mrs: GitLabMR[]): GitLabMR[] {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS);

  return mrs.filter(mr => {
    const updatedAt = new Date(mr.updated_at);
    return updatedAt < thresholdDate;
  });
}

/**
 * GET /api/mrs/not-updated
 * Returns MRs that haven't been updated in 14 days
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
    const cacheKey = `not-updated-${page}-${perPage}`;

    // Try to get from cache first
    if (!skipCache) {
      const cachedData = notUpdatedCache.get(cacheKey);
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

    // Filter MRs that haven't been updated
    const notUpdatedMRs = filterNotUpdatedMRs(response.items);

    // Prepare response
    const result = {
      items: notUpdatedMRs,
      metadata: {
        ...response.metadata,
        threshold: THRESHOLD_DAYS,
        lastRefreshed: new Date().toISOString(),
      },
    };

    // Cache the result
    if (!skipCache) {
      notUpdatedCache.set(cacheKey, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/mrs/not-updated:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 