import { NextRequest, NextResponse } from "next/server";
import { fetchUserIdsByGroupName, getTeamUserIds } from "@/lib/gitlab";
import { logger } from "@/lib/logger";
import { Cache } from "@/lib/cache";

// Create a cache instance for the users endpoint
const usersCache = new Cache(60); // 60 seconds TTL

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const groupName = searchParams.get("group");
    const refresh = searchParams.has("refresh");

    // Check if this is a request to get current team user IDs
    if (!groupName) {
      // Return current team user IDs from environment variable
      const teamUserIds = getTeamUserIds();

      return NextResponse.json({
        ids: teamUserIds,
        count: teamUserIds.length,
      });
    }

    // Check cache first (unless refresh is specified)
    const cacheKey = `group:${groupName}`;
    if (!refresh) {
      const cachedData = usersCache.get(cacheKey);
      if (cachedData) {
        logger.info(
          "Returned cached user data for group",
          { groupName },
          "API:users"
        );
        return NextResponse.json(cachedData);
      }
    }

    // Fetch user IDs by group name
    const { ids, users } = await fetchUserIdsByGroupName(groupName);

    const response = {
      ids,
      users,
      count: ids.length,
      metadata: {
        lastRefreshed: new Date().toISOString(),
      },
    };

    // Cache the result
    usersCache.set(cacheKey, response);

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
