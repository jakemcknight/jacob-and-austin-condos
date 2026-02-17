// API route for reading MLS listings from cache
// CACHE-ONLY: Does not call MLSGrid API directly
// Listings are updated by the /api/mls/sync cron job

import { NextRequest, NextResponse } from "next/server";
import { readMlsCache } from "@/lib/mls/cache";
import { buildings } from "@/data/buildings";

// Force dynamic rendering - no ISR caching since data is already cached in KV
export const dynamic = 'force-dynamic';

// Reserved cache key for DT condo listings not matched to a specific building
const UNMATCHED_SLUG = "_unmatched";

// Strip originating system prefix (e.g. "ACT") from mlsNumber for display
// Handles both old cached data (with prefix) and new data (already stripped)
function cleanMlsNumber(listing: any): any {
  if (listing.mlsNumber && /^[A-Z]+\d/.test(listing.mlsNumber)) {
    return { ...listing, mlsNumber: listing.mlsNumber.replace(/^[A-Z]+/, "") };
  }
  return listing;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const buildingSlug = searchParams.get("building");

    if (!buildingSlug) {
      // Fetch all listings from all buildings
      console.log(`[MLS API] Fetching all listings across all buildings`);
      const allListings: any[] = [];

      for (const building of buildings) {
        const cached = await readMlsCache(building.slug);
        if (cached && cached.data) {
          // Add building metadata to each listing for filtering/display
          const listingsWithBuilding = cached.data.map((listing: any) => cleanMlsNumber({
            ...listing,
            buildingSlug: building.slug,
            buildingName: building.name,
          }));
          allListings.push(...listingsWithBuilding);
        }
      }

      // Include unmatched DT condo listings (not tied to a specific building)
      const unmatchedCached = await readMlsCache(UNMATCHED_SLUG);
      if (unmatchedCached && unmatchedCached.data) {
        const unmatchedWithMeta = unmatchedCached.data.map((listing: any) => cleanMlsNumber({
          ...listing,
          buildingSlug: null,
          buildingName: listing.buildingName || "Downtown Austin",
        }));
        allListings.push(...unmatchedWithMeta);
      }

      console.log(`[MLS API] Returning ${allListings.length} total listings across all buildings`);
      return NextResponse.json(allListings);
    }

    // Verify building exists
    const building = buildings.find(b => b.slug === buildingSlug);
    if (!building) {
      return NextResponse.json(
        { error: `Building not found: ${buildingSlug}` },
        { status: 404 }
      );
    }

    // Read from cache only - never call MLSGrid directly
    const cached = await readMlsCache(buildingSlug);

    if (!cached) {
      console.log(`[MLS API] No cache for ${buildingSlug} - returning empty array`);
      // Return empty array if cache doesn't exist yet
      // Cache will be populated by the cron job
      return NextResponse.json([]);
    }

    console.log(`[MLS API] Cache hit for ${buildingSlug} (${cached.data.length} listings)`);
    return NextResponse.json(cached.data.map(cleanMlsNumber));
  } catch (error) {
    console.error("[MLS API] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to read MLS listings from cache",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
