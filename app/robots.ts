import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/downtown-condos/",
        disallow: [
          "/downtown-condos/api/",
          "/downtown-condos/data-v2/",
          "/downtown-condos/seo-dashboard/",
        ],
      },
      // Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
      {
        userAgent: "GPTBot",
        allow: "/downtown-condos/",
        disallow: ["/downtown-condos/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/downtown-condos/",
        disallow: ["/downtown-condos/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/downtown-condos/",
        disallow: ["/downtown-condos/api/", "/downtown-condos/seo-dashboard/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/downtown-condos/",
        disallow: ["/downtown-condos/api/", "/downtown-condos/seo-dashboard/"],
      },
    ],
    sitemap: "https://jacobinaustin.com/downtown-condos/sitemap.xml",
  };
}
