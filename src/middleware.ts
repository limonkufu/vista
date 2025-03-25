import { NextResponse, NextRequest } from "next/server";
import { RateLimiter } from "limiter";
import { cookies } from "next/headers";
import { FeatureFlag } from "./services/FeatureFlags";

// Store rate limiters for each client
const limiters = new Map<string, RateLimiter>();

// Rate limiting configuration
const RATE_LIMIT = {
  tokens: 100, // requests
  interval: 60 * 1000, // per minute
};

// Feature flag check for server components
const isFeatureEnabled = (flagName: string): boolean => {
  try {
    if (typeof window !== "undefined") {
      // Client-side not handled here - use FeatureFlags service instead
      return false;
    }

    // Get feature flags from cookies
    const cookieStore = cookies();
    const featureFlagsCookie = cookieStore.get(
      "gitlab-mrs-dashboard-feature-flags"
    );

    if (featureFlagsCookie && featureFlagsCookie.value) {
      const flags = JSON.parse(featureFlagsCookie.value);
      return flags[flagName] === true;
    }
  } catch (error) {
    console.error("Error checking feature flag in middleware:", error);
  }

  return false;
};

export async function middleware(request: NextRequest) {
  // Check role-based view access for new routes
  if (request.nextUrl.pathname.startsWith("/dashboard/")) {
    // Skip middleware for the main dashboard route
    if (request.nextUrl.pathname === "/dashboard") {
      return NextResponse.next();
    }

    // Check feature flags for role-based view pages
    const isRoleBasedEnabled = isFeatureEnabled(FeatureFlag.ROLE_BASED_VIEWS);

    // Handle view-specific routes
    if (request.nextUrl.pathname.startsWith("/dashboard/po-view")) {
      if (!isRoleBasedEnabled || !isFeatureEnabled(FeatureFlag.PO_VIEW)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } else if (request.nextUrl.pathname.startsWith("/dashboard/dev-view")) {
      if (!isRoleBasedEnabled || !isFeatureEnabled(FeatureFlag.DEV_VIEW)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } else if (request.nextUrl.pathname.startsWith("/dashboard/team-view")) {
      if (!isRoleBasedEnabled || !isFeatureEnabled(FeatureFlag.TEAM_VIEW)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  // Skip middleware for non-API routes and healthcheck
  if (
    !request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname === "/api/healthcheck"
  ) {
    return NextResponse.next();
  }

  // Check if this is a request from our own dashboard
  const referer = request.headers.get("referer") || "";
  const isInternalDashboardRequest =
    referer.includes("/dashboard") &&
    request.headers.get("host") === request.nextUrl.host;

  // Validate API key (skip for our own dashboard)
  if (!isInternalDashboardRequest) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Rate limiting
  const clientIp = request.ip || "unknown";
  let limiter = limiters.get(clientIp);

  if (!limiter) {
    limiter = new RateLimiter({
      tokensPerInterval: RATE_LIMIT.tokens,
      interval: RATE_LIMIT.interval,
    });
    limiters.set(clientIp, limiter);
  }

  const hasToken = await limiter.tryRemoveTokens(1);
  if (!hasToken) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

// Run middleware on both API routes and dashboard view routes
export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/po-view/:path*",
    "/dashboard/dev-view/:path*",
    "/dashboard/team-view/:path*",
  ],
};
