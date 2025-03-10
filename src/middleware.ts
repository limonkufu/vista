import { NextResponse, NextRequest } from "next/server";
import { RateLimiter } from "limiter";

// Store rate limiters for each client
const limiters = new Map<string, RateLimiter>();

// Rate limiting configuration
const RATE_LIMIT = {
  tokens: 100, // requests
  interval: 60 * 1000, // per minute
};

export async function middleware(request: NextRequest) {
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

// Only run middleware on API routes
export const config = {
  matcher: "/api/:path*",
};
