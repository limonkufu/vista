// File: src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchUserIdsByGroupName, getTeamUserIds } from "@/lib/gitlab";
import { logger } from "@/lib/logger";
// Removed: import { Cache } from "@/lib/cache";
import { gitlabApiCache } from "@/lib/gitlabCache"; // Import the GitLab API cache

// Removed: const usersCache = new Cache(60); // 60 seconds TTL

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const groupName = searchParams.get("group");
    const refresh =
      searchParams.has("refresh") || searchParams.get("skipCache") === "true"; // Consolidate refresh flags

    // Check if this is a request to get current team user IDs
    if (!groupName) {
      // Return current team user IDs from environment variable
      const teamUserIds = getTeamUserIds();
      // This part doesn't need caching as it reads directly from env vars
      return NextResponse.json({
        ids: teamUserIds,
        count: teamUserIds.length,
      });
    }

    // --- Caching Logic using gitlabApiCache ---
    const cacheKeyParams = { group: groupName };
    // Use a distinct endpoint name for the cache key
    const cacheKey = gitlabApiCache.generateKey("usersByGroup", cacheKeyParams);

    if (!refresh) {
      const cachedData = gitlabApiCache.get(cacheKey);
      if (cachedData) {
        // Assuming cachedData structure matches the expected response format
        // The gitlabApiCache stores { data: ..., headers: ... }
        // We need to adapt if the structure is different or just cache the final response object
        // Let's assume we cache the final response object directly for simplicity here.
        // We'll adjust the .set() call below.
        const cachedResponse = cachedData.data; // Assuming data holds the response object
        if (cachedResponse) {
          logger.info(
            "Returned cached user data for group",
            { groupName, cacheKey },
            "API:users"
          );
          // Return the cached *response data* directly
          return NextResponse.json(cachedResponse);
        }
      }
    }
    // --- End Caching Logic ---

    // Fetch user IDs by group name (if not cached or refreshing)
    logger.info(
      "Fetching user IDs by group name from GitLab",
      { groupName },
      "API:users"
    );
    const { ids, users } = await fetchUserIdsByGroupName(groupName);

    // Prepare the response object
    const response = {
      ids,
      users,
      count: ids.length,
      metadata: {
        lastRefreshed: new Date().toISOString(),
      },
    };

    // Cache the *response object* itself.
    // gitlabApiCache expects data and headers. We'll store the response in 'data' and use empty headers.
    // Set TTL (e.g., 5 minutes = 300 seconds)
    gitlabApiCache.set(cacheKey, response as any, {}, 300 * 1000);

    logger.info(
      "Successfully fetched user IDs by group name",
      { groupName, count: ids.length },
      "API:users"
    );

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      "Error fetching user IDs",
      { error: error instanceof Error ? error.message : "Unknown error" },
      "API:users"
    );

    return NextResponse.json(
      {
        error: "Failed to fetch user IDs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
