import { NextRequest, NextResponse } from 'next/server';
import { fetchTeamMRs, GitLabMR, isTeamMember } from '@/lib/gitlab';
import { pendingReviewCache } from '@/lib/cache';

// Constants
const THRESHOLD_DAYS = 7;
const DEFAULT_GROUP_ID = '3180705';
const DEFAULT_PAGE_SIZE = 25;

/**
 * Filter MRs that are pending review and haven't been updated within the threshold
 */
function filterPendingReviewMRs(mrs: GitLabMR[]): GitLabMR[] {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - THRESHOLD_DAYS);

  return mrs.filter(mr => {
    // Check if any reviewer is a team member
    const hasTeamReviewer = mr.reviewers?.some(isTeamMember);
    if (!hasTeamReviewer) return false;

    // Check if the MR hasn't been updated recently
    const updatedAt = new Date(mr.updated_at);
    return updatedAt < thresholdDate;
  });
}

/**
 * GET /api/mrs/pending-review
 * Returns MRs that are pending review and haven't been updated in 7 days
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
    const cacheKey = `pending-review-${page}-${perPage}`;

    // Try to get from cache first
    if (!skipCache) {
      const cachedData = pendingReviewCache.get(cacheKey);
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

    // Filter MRs that are pending review
    const pendingReviewMRs = filterPendingReviewMRs(response.items);

    // Prepare response
    const result = {
      items: pendingReviewMRs,
      metadata: {
        ...response.metadata,
        threshold: THRESHOLD_DAYS,
        lastRefreshed: new Date().toISOString(),
      },
    };

    // Cache the result
    if (!skipCache) {
      pendingReviewCache.set(cacheKey, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in /api/mrs/pending-review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 