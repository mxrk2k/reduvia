/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep pdf-parse out of the Next.js server-components bundle so Node.js
  // resolves it natively (avoids webpack/pdfjs-dist compatibility issues).
  experimental: { serverComponentsExternalPackages: ["pdf-parse"] },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "pdf-parse"];
    return config;
  },
};

export default nextConfig;
