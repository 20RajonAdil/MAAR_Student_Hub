import type { MetadataRoute } from "next";

const SITE_URL = "https://maar-student-hub.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing under these routes is meant to be indexed — they're
        // either student-specific app screens (gated behind onboarding,
        // so a crawler would just hit a redirect) or pure API endpoints.
        // Only the public landing page ("/") is meant to appear in search.
        disallow: [
          "/api/",
          "/dashboard",
          "/subjects/",
          "/notes",
          "/settings",
          "/onboarding",
          "/coach",
          "/past-papers",
          "/practice",
          "/progress",
          "/resources",
          "/tutor",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
