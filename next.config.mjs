import { withSentryConfig } from "@sentry/nextjs";

// ── Security headers ──────────────────────────────────────────────────────────

// Content-Security-Policy — keeps 'unsafe-inline' for scripts because Next.js
// injects inline scripts for hydration; a nonce-based CSP would remove this
// requirement but requires middleware changes beyond the current scope.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' data: blob:",
  [
    "connect-src 'self'",
    "*.supabase.co",
    "api.stripe.com js.stripe.com m.stripe.com",
    "api.anthropic.com",
    "app.posthog.com eu.posthog.com",
    "*.sentry.io o*.ingest.sentry.io",
    "*.inngest.com",
  ].join(" "),
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy",   value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pdf-parse out of the Next.js server-components bundle so Node.js
  // resolves it natively (avoids webpack/pdfjs-dist compatibility issues).
  experimental: { serverComponentsExternalPackages: ["pdf-parse"] },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "pdf-parse"];
    config.watchOptions = { ignored: ["**/mobile/**"] };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source map uploads require SENTRY_ORG and SENTRY_PROJECT env vars.
  // Disable in development to avoid upload noise.
  sourcemaps: {
    disable: process.env.NODE_ENV === "development",
  },

  // Suppress the Sentry CLI output during builds
  silent: !process.env.CI,

  // Tree-shake Sentry logger statements out of the production bundle
  disableLogger: true,

  // Automatically instrument Vercel cron monitors
  automaticVercelMonitors: true,
});
