import { withSentryConfig } from "@sentry/nextjs";

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
