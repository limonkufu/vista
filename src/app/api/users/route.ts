// File: src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  fetchUsersByGroupName,
  searchUsersByNameOrUsername,
  getDefaultTeamUsers,
  fetchUsersByIds,
  GitLabUser,
} from "@/lib/gitlab";
import { logger } from "@/lib/logger";
import { gitlabApiCache } from "@/lib/gitlabCache"; // Use the specific cache

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const groupName = searchParams.get("group");
  const searchTerm = searchParams.get("search");
  const idsParam = searchParams.get("ids");
  const skipCache =
    searchParams.has("refresh") || searchParams.get("skipCache") === "true";

  try {
    // --- Fetch Users by Group Name ---
    if (groupName) {
      logger.info(
        "API: Handling request for users by group",
        { groupName, skipCache },
        "API:users"
      );
      const users = await fetchUsersByGroupName(
        groupName,
        undefined,
        skipCache
      );
      return NextResponse.json({
        users,
        count: users.length,
        metadata: { source: "group", groupName },
      });
    }

    // --- Search Users by Name/Username ---
    if (searchTerm) {
      logger.info(
        "API: Handling request to search users",
        { searchTerm, skipCache },
        "API:users"
      );
      // Consider adding a default group ID if needed for search context
      const users = await searchUsersByNameOrUsername(
        searchTerm,
        undefined,
        skipCache
      );
      return NextResponse.json({
        users,
        count: users.length,
        metadata: { source: "search", searchTerm },
      });
    }

    // --- Fetch Users by Specific IDs ---
    if (idsParam) {
      logger.info(
        "API: Handling request to fetch users by IDs",
        { idsParam, skipCache },
        "API:users"
      );
      const ids = idsParam
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
      if (ids.length === 0) {
        return NextResponse.json({
          users: [],
          count: 0,
          metadata: { source: "ids", ids: [] },
        });
      }
      const users = await fetchUsersByIds(ids, skipCache);
      return NextResponse.json({
        users,
        count: users.length,
        metadata: { source: "ids", requestedIds: ids },
      });
    }

    // --- Fetch Default Team Users ---
    logger.info(
      "API: Handling request for default team users",
      { skipCache },
      "API:users"
    );
    const defaultUsers = await getDefaultTeamUsers(skipCache);
    return NextResponse.json({
      users: defaultUsers,
      count: defaultUsers.length,
      metadata: { source: "default" },
    });
  } catch (error) {
    logger.error(
      "API: Error fetching users",
      {
        error: error instanceof Error ? error.message : "Unknown error",
        groupName,
        searchTerm,
        idsParam,
      },
      "API:users"
    );
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
