import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/downtown-condos/data/",
          "/downtown-condos/seo-dashboard/",
        ],
      },
      // Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/api/", "/downtown-condos/seo-dashboard/"],
      },
    ],
    sitemap: "https://jacobinaustin.com/sitemap.xml",
  };
}
