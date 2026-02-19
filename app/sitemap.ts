import { MetadataRoute } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { buildings } from "@/data/buildings";
import { getAllFloorPlanParams } from "@/lib/floor-plans";
import { readMlsCache } from "@/lib/mls/cache";
const BASE_URL = "https://jacobinaustin.com/downtown-condos";

// Strip originating system prefix (e.g. "ACT") from mlsNumber
function stripMlsPrefix(mlsNumber: string): string {
  return mlsNumber.replace(/^[A-Z]+/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  noStore();

  // 1. Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/for-sale`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/views`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/data`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  // 2. Building pages
  const buildingPages: MetadataRoute.Sitemap = buildings.map((b) => ({
    url: `${BASE_URL}/${b.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // 3. Floor plan pages
  const floorPlanParams = getAllFloorPlanParams();
  const floorPlanPages: MetadataRoute.Sitemap = floorPlanParams.map((fp) => ({
    url: `${BASE_URL}/${fp.slug}/${fp.floorplan}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // 4. Active listing pages (dynamic from KV cache)
  const listingPages: MetadataRoute.Sitemap = [];
  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached?.data) {
      for (const listing of cached.data) {
        const cleanMls = stripMlsPrefix(listing.mlsNumber);
        listingPages.push({
          url: `${BASE_URL}/listings/${cleanMls}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    }
  }

  return [...staticPages, ...buildingPages, ...floorPlanPages, ...listingPages];
}
