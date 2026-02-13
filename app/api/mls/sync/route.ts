// MLS Sync Cron Job - Replicates listings from MLSGrid every 15 minutes
// Follows MLSGrid best practices for replication
// Called by Vercel Cron (see vercel.json)

import { NextRequest, NextResponse } from "next/server";
import { MLSGridClient } from "@/lib/mls/client";
import { writeMlsCache, updateMlsCache, readMlsCache } from "@/lib/mls/cache";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import { buildings } from "@/data/buildings";
import {
  getLastSyncTimestamp,
  updateSyncState,
  markSyncInProgress,
  markSyncFailed,
  findLatestTimestamp,
  isSyncInProgress,
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

    // Check if another sync is already running
    const syncAlreadyInProgress = await isSyncInProgress();
    if (syncAlreadyInProgress) {
      console.warn("[MLS Sync] ⚠️  Sync already in progress - aborting to prevent overlap");
      return NextResponse.json(
        {
          success: false,
          error: "Sync already in progress",
          message: "Another sync is currently running. Please wait for it to complete.",
        },
        { status: 409 } // 409 Conflict
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

    // 3b. Guard against incomplete initial imports
    // If an initial import returns very few listings, something went wrong — don't save the
    // timestamp or we'll be stuck in incremental mode with an almost-empty cache
    const MINIMUM_INITIAL_LISTINGS = 50;
    if (isInitialImport && allListings.length < MINIMUM_INITIAL_LISTINGS) {
      const msg = `Initial import seems incomplete: only ${allListings.length} listings (expected at least ${MINIMUM_INITIAL_LISTINGS})`;
      console.error(`[MLS Sync] ${msg}`);
      await markSyncFailed(msg);
      return NextResponse.json(
        {
          success: false,
          error: "Initial import incomplete",
          totalListings: allListings.length,
          message: msg,
          duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
        },
        { status: 500 }
      );
    }

    // 4. Group listings by building using address and building name matching
    const listingsByBuilding = new Map<string, typeof allListings>();
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const listing of allListings) {
      const buildingSlug = matchListingToBuilding(listing.address, listing.buildingName);

      if (buildingSlug) {
        if (!listingsByBuilding.has(buildingSlug)) {
          listingsByBuilding.set(buildingSlug, []);
        }
        listingsByBuilding.get(buildingSlug)!.push(listing);
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    console.log(`[MLS Sync] Address matching results:`);
    console.log(`[MLS Sync]   Matched: ${matchedCount} listings → ${listingsByBuilding.size} buildings`);
    console.log(`[MLS Sync]   Unmatched: ${unmatchedCount} listings`);

    // Log building-specific counts
    const buildingEntries = Array.from(listingsByBuilding.entries());
    for (const [buildingSlug, listings] of buildingEntries) {
      const building = buildings.find(b => b.slug === buildingSlug);
      console.log(`[MLS Sync]   ${building?.name || buildingSlug}: ${listings.length} listings`);
    }

    // 5. Update cache for each building
    let totalCached = 0;

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

    // 7. Count batch listings (what this sync fetched)
    const batchSalesCount = allListings.filter(l => l.listingType === "Sale").length;
    const batchLeasesCount = allListings.filter(l => l.listingType === "Lease").length;

    // 8. Count TOTAL listings across all building caches (not just this batch)
    let totalCachedSales = 0;
    let totalCachedLeases = 0;

    for (const building of buildings) {
      const cached = await readMlsCache(building.slug);
      if (cached && cached.data) {
        totalCachedSales += cached.data.filter((l: any) => l.listingType === "Sale").length;
        totalCachedLeases += cached.data.filter((l: any) => l.listingType === "Lease").length;
      }
    }

    // 9. Update sync state with total cache counts and batch counts
    await updateSyncState(totalCachedSales, totalCachedLeases, latestTimestamp, batchSalesCount, batchLeasesCount);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const result = {
      success: true,
      mode: isInitialImport ? "initial" : "incremental",
      batchListings: allListings.length,
      batchSalesCount,
      batchLeasesCount,
      totalCachedSales,
      totalCachedLeases,
      totalCachedListings: totalCachedSales + totalCachedLeases,
      buildingsUpdated: listingsByBuilding.size,
      latestTimestamp,
      duration: `${duration}s`,
      nextSyncTimestamp: latestTimestamp,
    };

    console.log(`[MLS Sync] Completed successfully in ${duration}s`);
    console.log(`[MLS Sync] Batch: ${allListings.length} listings | Total cached: ${totalCachedSales + totalCachedLeases} (${totalCachedSales} sales, ${totalCachedLeases} leases)`);

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
