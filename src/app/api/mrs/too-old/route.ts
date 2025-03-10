import { NextRequest, NextResponse } from 'next/server';
import { fetchTooOldMRs } from "@/lib/gitlab";
import { Cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { thresholds } from "@/lib/config";

// Create a cache for too-old MRs with 60 seconds TTL
const cache = new Cache(60);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const per_page = parseInt(searchParams.get("per_page") || "25");

  // Check for a custom threshold in the query parameters
  const customThreshold = searchParams.get("threshold");
  const threshold = customThreshold
    ? parseInt(customThreshold)
    : thresholds.TOO_OLD_THRESHOLD;

  // Check for cache-busting refresh parameter
  const shouldRefresh = searchParams.get("refresh") === "true";

  // Create cache key based on page, per_page and threshold
  const cacheKey = `too-old-mrs-page-${page}-per-${per_page}-threshold-${threshold}`;

  // Try to get data from cache if not refreshing
  if (!shouldRefresh) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
  }

  try {
    logger.info(
      "Fetching too-old MRs from GitLab",
      { page, per_page, threshold },
      "API"
    );

    // Fetch MRs from GitLab API
    const response = await fetchTooOldMRs({
      page,
      per_page,
      threshold,
    });

    // Format the response
    const apiResponse = {
      items: response.items,
      metadata: {
        lastRefreshed: new Date().toISOString(),
        threshold,
        currentPage: response.metadata.currentPage,
        totalPages: response.metadata.totalPages || 1,
        perPage: response.metadata.perPage,
        totalItems: response.metadata.totalItems,
      },
    };

    // Cache the response
    cache.set(cacheKey, apiResponse);

    return NextResponse.json(apiResponse);
  } catch (error) {
    logger.error("Error fetching too-old MRs", { error }, "API");

    return NextResponse.json(
      {
        error: "Failed to fetch too-old MRs",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
} 