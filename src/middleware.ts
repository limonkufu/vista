import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RateLimiter } from 'limiter';

// In-memory store for rate limiters
const limiters = new Map<string, RateLimiter>();

// Rate limit configuration
const RATE_LIMIT = {
  tokens: 100, // requests
  interval: 60 * 1000, // per minute
};

export async function middleware(request: NextRequest) {
  // Skip middleware for non-API routes and healthcheck
  if (!request.nextUrl.pathname.startsWith('/api') || 
      request.nextUrl.pathname === '/api/healthcheck') {
    return NextResponse.next();
  }

  // Validate API key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Rate limiting
  const clientIp = request.ip || 'unknown';
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
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { 
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      }
    );
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
} 