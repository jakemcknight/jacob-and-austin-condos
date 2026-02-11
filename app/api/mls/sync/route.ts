// MLS Sync Cron Job - Replicates listings from MLSGrid every 15 minutes
// Follows MLSGrid best practices for replication
// Called by Vercel Cron (see vercel.json)

import { NextRequest, NextResponse } from "next/server";
import { MLSGridClient } from "@/lib/mls/client";
import { writeMlsCache, updateMlsCache } from "@/lib/mls/cache";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import { buildings } from "@/data/buildings";
import {
  getLastSyncTimestamp,
  updateSyncState,
  markSyncInProgress,
  markSyncFailed,
  findLatestTimestamp,
} from "@/lib/mls/sync-state";

// Disable static optimization - this is a dynamic route
export const dynamic = "force-dynamic";

// Maximum execution time for Vercel (10 min for Pro, 60s for Hobby)
// Set conservatively to avoid timeouts
export const maxDuration = 300; // 5 minutes

/**
 * Vercel Cron Job Handler
 * Triggered by Vercel Cron every 15 minutes
 *
 * Authentication: Vercel Cron Secret (CRON_SECRET env var)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify this is a legitimate cron request
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error("[MLS Sync] Unauthorized sync request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[MLS Sync] Starting MLS replication...");
    await markSyncInProgress();

    // 2. Determine if this is initial import or incremental sync
    const lastSyncTimestamp = await getLastSyncTimestamp();
    const isInitialImport = !lastSyncTimestamp;

    console.log(
      `[MLS Sync] Mode: ${isInitialImport ? "INITIAL IMPORT" : "INCREMENTAL SYNC"}`
    );
    if (lastSyncTimestamp) {
      console.log(`[MLS Sync] Last sync: ${lastSyncTimestamp}`);
    }

    // 3. Replicate listings from MLSGrid
    const mlsClient = new MLSGridClient();
    const allListings = await mlsClient.replicateListings({
      mode: isInitialImport ? "initial" : "incremental",
      lastSyncTimestamp: lastSyncTimestamp || undefined,
      originatingSystemName: "actris", // Unlock MLS (Austin Board of REALTORS) uses 'actris'
    });

    console.log(`[MLS Sync] Fetched ${allListings.length} listings from MLSGrid`);

    // 4. Group listings by building using address matching
    const listingsByBuilding = new Map<string, typeof allListings>();

    for (const listing of allListings) {
      const buildingSlug = matchListingToBuilding(listing.address);

      if (buildingSlug) {
        if (!listingsByBuilding.has(buildingSlug)) {
          listingsByBuilding.set(buildingSlug, []);
        }
        listingsByBuilding.get(buildingSlug)!.push(listing);
      }
    }

    console.log(`[MLS Sync] Matched listings to ${listingsByBuilding.size} buildings`);

    // 5. Update cache for each building
    let totalCached = 0;
    const buildingEntries = Array.from(listingsByBuilding.entries());

    if (isInitialImport) {
      // Initial import: replace all caches
      for (const [buildingSlug, listings] of buildingEntries) {
        await writeMlsCache(buildingSlug, listings);
        totalCached += listings.length;
      }
    } else {
      // Incremental sync: update existing caches
      for (const [buildingSlug, listings] of buildingEntries) {
        await updateMlsCache(buildingSlug, listings);
        totalCached += listings.length;
      }
    }

    // 6. Find the latest ModificationTimestamp for next sync
    const latestTimestamp = findLatestTimestamp(allListings);

    // 7. Count by listing type for reporting
    const salesCount = allListings.filter(l => l.listingType === "Sale").length;
    const leasesCount = allListings.filter(l => l.listingType === "Lease").length;

    // 8. Update sync state
    await updateSyncState(salesCount, leasesCount, latestTimestamp);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const result = {
      success: true,
      mode: isInitialImport ? "initial" : "incremental",
      totalListings: allListings.length,
      salesCount,
      leasesCount,
      buildingsUpdated: listingsByBuilding.size,
      latestTimestamp,
      duration: `${duration}s`,
      nextSyncTimestamp: latestTimestamp,
    };

    console.log(`[MLS Sync] ✅ Completed successfully in ${duration}s`);
    console.log(`[MLS Sync] ${result.totalListings} listings → ${result.buildingsUpdated} buildings`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MLS Sync] ❌ Error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    await markSyncFailed(errorMessage);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json(
      {
        success: false,
        error: "MLS sync failed",
        details: errorMessage,
        duration: `${duration}s`,
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger endpoint (for testing/debugging)
 * POST /api/mls/sync with proper authentication
 */
export async function POST(request: NextRequest) {
  // Reuse the GET handler for manual triggers
  return GET(request);
}
