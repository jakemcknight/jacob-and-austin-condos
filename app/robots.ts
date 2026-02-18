import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/downtown-condos/",
      disallow: ["/downtown-condos/api/"],
    },
    sitemap: "https://jacobinaustin.com/downtown-condos/sitemap.xml",
  };
}
