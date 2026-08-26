import type { NextConfig } from "next";

/**
 * Sections that must never be served from cache or browser history.
 *
 * Set here rather than in the proxy because Next writes its own Cache-Control
 * for dynamic pages, which overrides a header the proxy adds. A next.config
 * rule is applied to the final response, so no-store survives.
 */
const PRIVATE_SECTIONS = [
  "/dashboard",
  "/student/:path*",
  "/tutor/:path*",
  "/parent/:path*",
  "/admin/:path*",
  "/checkout/:path*",
];

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't infer C:\Users\User
  // from the stray package-lock.json sitting in the home directory.
  turbopack: {
    root: __dirname,
  },

  async headers() {
    return PRIVATE_SECTIONS.map((source) => ({
      source,
      headers: [
        {
          key: "Cache-Control",
          // no-store keeps the page out of the disk cache and out of the
          // back/forward cache, so leaving a dashboard and pressing Back
          // cannot repaint a child's marks for whoever holds the device next.
          value: "no-store, no-cache, must-revalidate, max-age=0",
        },
        { key: "Pragma", value: "no-cache" },
        // Private pages should never be framed or indexed.
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
  },
};

export default nextConfig;
