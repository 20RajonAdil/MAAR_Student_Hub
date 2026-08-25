import type { MetadataRoute } from "next";

const SITE_URL = "https://maar-student-hub.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing under these routes is meant to be indexed — they're
        // either student-specific app screens or pure API endpoints.
        disallow: ["/api/", "/dashboard", "/subjects/", "/notes", "/settings", "/onboarding"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
