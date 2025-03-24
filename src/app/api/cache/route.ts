import { NextRequest, NextResponse } from "next/server";
import { cacheManager } from "@/lib/cacheManager";
import { logger } from "@/lib/logger";
import { gitlabApiCache } from "@/lib/gitlabCache";

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case "clear_all":
        cacheManager.clearAll();
        return NextResponse.json({
          success: true,
          message: "All caches cleared",
        });

      case "clear_gitlab_api":
        cacheManager.clearGitLabCache();
        return NextResponse.json({
          success: true,
          message: "GitLab API cache cleared",
        });

      case "clear_api_responses":
        cacheManager.clearApiResponseCaches();
        return NextResponse.json({
          success: true,
          message: "API response caches cleared",
        });

      case "clear_client_cache":
        cacheManager.clearClientCache();
        return NextResponse.json({
          success: true,
          message: "Client cache cleared",
        });

      case "get_stats":
        const stats = cacheManager.getStats();
        return NextResponse.json({ success: true, stats });

      default:
        return NextResponse.json(
          { success: false, message: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error(
      "Error in cache management API",
      { error: error instanceof Error ? error.message : "Unknown error" },
      "API:Cache"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to process cache management request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
export async function GET(request: NextRequest) {
  try {
    // Use the request param to add a detail level option
    const showDetails = request.nextUrl.searchParams.get("details") === "true";

    const stats = cacheManager.getStats();
    return NextResponse.json({
      success: true,
      stats,
      // Only include detailed information if requested
      details: showDetails
        ? {
            cacheKeys: gitlabApiCache.getStats().keys,
          }
        : undefined,
    });
  } catch (error) {
    logger.error(
      "Error getting cache stats",
      { error: error instanceof Error ? error.message : "Unknown error" },
      "API:Cache"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to get cache statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}