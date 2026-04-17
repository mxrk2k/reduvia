/*
 * OWASP Top 10 — coverage in this file and across the stack
 * ===========================================================
 * A01 Broken Access Control         → Supabase RLS policies enforce per-user data
 *                                     isolation at the DB layer; this middleware
 *                                     redirects unauthenticated requests away from
 *                                     all protected routes.
 * A02 Cryptographic Failures        → Passwords hashed by Supabase (bcrypt); all
 *                                     traffic encrypted via HTTPS enforced by Vercel.
 * A03 Injection                     → All DB access uses Supabase's parameterised
 *                                     queries (PostgREST); no raw SQL constructed
 *                                     from user input.
 * A05 Security Misconfiguration     → Security headers (CSP, X-Frame-Options,
 *                                     X-Content-Type-Options, Referrer-Policy,
 *                                     Permissions-Policy) added in next.config.mjs.
 * A07 Identification & Auth Failure → Rate limiting enforced here: 10 req/min on
 *                                     auth endpoints per IP, 20 req/min on
 *                                     AI-powered server actions per user, 100 req/min
 *                                     on the Stripe webhook per IP, 60 req/min on
 *                                     all other API routes per IP.
 * A09 Security Logging              → Sentry error monitoring active via
 *                                     @sentry/nextjs; all unhandled errors are
 *                                     captured with full stack traces.
 */

import { createServerClient } from "@supabase/ssr";
import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROTECTED_ROUTES = ["/dashboard", "/transactions", "/budgets", "/accounts", "/settings"];
const AUTH_ROUTES      = ["/login", "/signup"];

// ── Rate limiters ─────────────────────────────────────────────────────────────

type Limiters = {
  auth:   Ratelimit; // 10 req/min per IP   — auth & callback endpoints
  ai:     Ratelimit; // 20 req/min per user  — Anthropic-powered server actions
  stripe: Ratelimit; // 100 req/min per IP   — Stripe webhook
  api:    Ratelimit; // 60 req/min per IP    — all other API routes
};

// Initialised once on first use; null when Redis is not configured (local dev).
let _limiters: Limiters | null | undefined;

function getLimiters(): Limiters | null {
  if (_limiters !== undefined) return _limiters;
  const redis = getRedis();
  if (!redis) return (_limiters = null);
  return (_limiters = {
    auth:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10,  "1 m"), prefix: "rl:auth" }),
    ai:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20,  "1 m"), prefix: "rl:ai" }),
    stripe: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1 m"), prefix: "rl:stripe" }),
    api:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60,  "1 m"), prefix: "rl:api" }),
  });
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

async function applyRateLimit(
  request: NextRequest,
  pathname: string,
  userId: string | undefined
): Promise<NextResponse | null> {
  const limiters = getLimiters();
  if (!limiters) return null; // Redis not configured — skip in local dev

  const ip = clientIp(request);
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");

  let limiter: Ratelimit;
  let identifier: string;

  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/")) {
    limiter    = limiters.auth;
    identifier = ip;
  } else if (pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/stripe")) {
    limiter    = limiters.stripe;
    identifier = ip;
  } else if (isServerAction) {
    // Rate-limit Anthropic-powered server actions by user ID when authenticated,
    // falling back to IP for unauthenticated callers.
    limiter    = limiters.ai;
    identifier = userId ?? ip;
  } else if (pathname.startsWith("/api/")) {
    limiter    = limiters.api;
    identifier = ip;
  } else {
    return null; // no rate limit for regular page routes
  }

  const { success, reset } = await limiter.limit(identifier);
  if (success) return null;

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After":  String(retryAfter),
    },
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not add logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rateLimitResponse = await applyRateLimit(request, pathname, user?.id);
  if (rateLimitResponse) return rateLimitResponse;

  // ── Auth redirects ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute  = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
