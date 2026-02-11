// API route for reading MLS listings from cache
// CACHE-ONLY: Does not call MLSGrid API directly
// Listings are updated by the /api/mls/sync cron job

import { NextRequest, NextResponse } from "next/server";
import { readMlsCache } from "@/lib/mls/cache";
import { buildings } from "@/data/buildings";

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';
// ISR: Revalidate every 1 hour
export const revalidate = 3600;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const buildingSlug = searchParams.get("building");

    if (!buildingSlug) {
      return NextResponse.json(
        { error: "Building slug required" },
        { status: 400 }
      );
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
    return NextResponse.json(cached.data);
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
