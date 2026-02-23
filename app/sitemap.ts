import { MetadataRoute } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { buildings } from "@/data/buildings";
import { getAllFloorPlanParams } from "@/lib/floor-plans";
import { readMlsCache } from "@/lib/mls/cache";
import { getAllInsights } from "@/lib/blog/mdx";

const SITE_URL = "https://jacobinaustin.com";
const CONDOS_URL = `${SITE_URL}/downtown-condos`;

// Strip originating system prefix (e.g. "ACT") from mlsNumber
function stripMlsPrefix(mlsNumber: string): string {
  return mlsNumber.replace(/^[A-Z]+/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  noStore();

  // 1. Site-wide pages
  const sitePages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/newsletter`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/insights`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // 2. Insight/newsletter pages
  const insights = getAllInsights();
  const insightPages: MetadataRoute.Sitemap = insights.map((post) => ({
    url: `${SITE_URL}/insights/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // 3. Condo static pages
  const condoStaticPages: MetadataRoute.Sitemap = [
    {
      url: CONDOS_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${CONDOS_URL}/for-sale`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${CONDOS_URL}/views`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // 4. Building pages
  const buildingPages: MetadataRoute.Sitemap = buildings.map((b) => ({
    url: `${CONDOS_URL}/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // 5. Floor plan pages
  const floorPlanParams = getAllFloorPlanParams();
  const floorPlanPages: MetadataRoute.Sitemap = floorPlanParams.map((fp) => ({
    url: `${CONDOS_URL}/${fp.slug}/${fp.floorplan}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // 6. Active listing pages (dynamic from KV cache)
  const listingPages: MetadataRoute.Sitemap = [];
  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached?.data) {
      for (const listing of cached.data) {
        const cleanMls = stripMlsPrefix(listing.mlsNumber);
        listingPages.push({
          url: `${CONDOS_URL}/listings/${cleanMls}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    }
  }

  return [
    ...sitePages,
    ...insightPages,
    ...condoStaticPages,
    ...buildingPages,
    ...floorPlanPages,
    ...listingPages,
  ];
}
