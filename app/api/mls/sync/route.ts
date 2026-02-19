// MLS Sync Cron Job - Replicates listings from MLSGrid every 15 minutes
// Follows MLSGrid best practices for replication
// Called by Vercel Cron (see vercel.json)

import { NextRequest, NextResponse } from "next/server";
import { MLSGridClient } from "@/lib/mls/client";
import { writeMlsCache, readMlsCache, writeListingIndex } from "@/lib/mls/cache";
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
import {
  upsertAnalyticsListings,
  readAnalyticsSyncState,
  writeAnalyticsSyncState,
  appendListingSnapshots,
  countAnalyticsListings,
} from "@/lib/mls/analytics-cache";
import { readAllEnrichmentMaps, enrichListing, enrichActiveListingWithFloorPlan, writeEnrichmentMap, deleteEnrichmentMap } from "@/lib/mls/enrichment";
import { unitLookup } from "@/data/unitLookup";
import type { AnalyticsListing, AnalyticsSyncState, ListingSnapshot } from "@/lib/mls/analytics-types";
import type { MLSListing } from "@/lib/mls/types";

// Disable static optimization - this is a dynamic route
export const dynamic = "force-dynamic";

// Reserved cache key for DT condo listings that don't match any defined building
const UNMATCHED_SLUG = "_unmatched";

// Maximum execution time for Vercel (10 min for Pro, 60s for Hobby)
// Set conservatively to avoid timeouts
export const maxDuration = 300; // 5 minutes

/**
 * Convert an MLSListing (active listings format) to AnalyticsListing format.
 * Used to feed already-fetched active listings into the analytics pipeline
 * without making a duplicate API call.
 */
function mlsListingToAnalytics(
  listing: MLSListing,
  buildingSlug: string | null,
  buildingName: string
): AnalyticsListing {
  const priceSf = listing.livingArea > 0 ? listing.listPrice / listing.livingArea : 0;

  return {
    listingId: listing.listingId,
    buildingSlug,
    buildingName,
    address: listing.address,
    unitNumber: listing.unitNumber,
    listPrice: listing.listPrice,
    originalListPrice: listing.originalListPrice ?? listing.listPrice,
    closePrice: undefined,
    previousListPrice: undefined,
    currentPrice: undefined,
    bedroomsTotal: listing.bedroomsTotal,
    bathroomsTotalInteger: listing.bathroomsTotalInteger,
    livingArea: listing.livingArea,
    priceSf,
    status: listing.status,
    listingContractDate: listing.listDate || undefined,
    closeDate: undefined,
    daysOnMarket: listing.daysOnMarket,
    hoaFee: listing.hoaFee,
    associationFeeFrequency: listing.associationFeeFrequency,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    yearBuilt: listing.yearBuilt,
    listAgentFullName: listing.listAgentFullName,
    listOfficeName: listing.listOfficeName,
    source: "api-sync",
    importedAt: new Date().toISOString(),
  };
}

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

    // 2. Always do a full fetch so photo tokens stay fresh (they expire after ~1 hour)
    // MLSGrid media URLs contain time-limited tokens that expire.
    // A full fetch is only ~4 API calls (with $top=500), well within rate limits.
    const lastSyncTimestamp = await getLastSyncTimestamp();
    const isInitialImport = !lastSyncTimestamp;

    console.log(
      `[MLS Sync] Mode: FULL FETCH (${isInitialImport ? "initial import" : "refresh — photo tokens expire hourly"})`
    );

    // 3. Replicate listings from MLSGrid — always use "initial" mode to get ALL active listings
    // This ensures photo tokens are refreshed every sync cycle
    const mlsClient = new MLSGridClient();
    const allListings = await mlsClient.replicateListings({
      mode: "initial",
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
    const unmatchedLogEntries: Array<{ address: string; buildingName: string; unit: string; listingType: string }> = [];
    const unmatchedFullListings: typeof allListings = [];

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
        unmatchedFullListings.push(listing);
        unmatchedLogEntries.push({
          address: listing.address,
          buildingName: listing.buildingName,
          unit: listing.unitNumber,
          listingType: listing.listingType,
        });
      }
    }

    console.log(`[MLS Sync] Address matching results:`);
    console.log(`[MLS Sync]   Matched: ${matchedCount} listings → ${listingsByBuilding.size} buildings`);
    console.log(`[MLS Sync]   Unmatched: ${unmatchedCount} listings`);
    if (unmatchedLogEntries.length > 0) {
      console.log(`[MLS Sync]   Unmatched addresses:`);
      for (const ul of unmatchedLogEntries) {
        console.log(`[MLS Sync]     "${ul.address}" unit=${ul.unit} building="${ul.buildingName}" type=${ul.listingType}`);
      }
    }

    // Log building-specific counts
    const buildingEntries = Array.from(listingsByBuilding.entries());
    for (const [buildingSlug, listings] of buildingEntries) {
      const building = buildings.find(b => b.slug === buildingSlug);
      console.log(`[MLS Sync]   ${building?.name || buildingSlug}: ${listings.length} listings`);
    }

    // 5. Enrich listings with floor plan data, then update cache
    let totalCached = 0;
    let totalEnriched = 0;

    for (const [buildingSlug, listings] of buildingEntries) {
      const buildingLookup = unitLookup[buildingSlug];
      let enrichedListings = listings;
      if (buildingLookup) {
        enrichedListings = listings.map(l => enrichActiveListingWithFloorPlan(l, buildingLookup));
        const enrichedCount = enrichedListings.filter(l => l.floorPlan).length;
        totalEnriched += enrichedCount;
      }
      await writeMlsCache(buildingSlug, enrichedListings);
      totalCached += enrichedListings.length;
    }
    console.log(`[MLS Sync] Enriched ${totalEnriched} listings with floor plan data`);

    // 5a. Sync unitLookup into KV enrichment maps (for analytics enrichment)
    // Write fresh maps from unitLookup, then delete any stale maps from old CSV data
    const unitLookupSlugs = new Set(Object.keys(unitLookup));
    for (const [slug, units] of Object.entries(unitLookup)) {
      const kvMap: Record<string, { floorPlan: string; orientation: string }> = {};
      for (const [unit, entry] of Object.entries(units)) {
        kvMap[unit] = { floorPlan: entry.floorPlan, orientation: entry.orientation };
      }
      await writeEnrichmentMap(slug, kvMap);
    }
    // Delete stale enrichment maps for buildings not in unitLookup
    const existingMaps = await readAllEnrichmentMaps();
    for (const existingSlug of Object.keys(existingMaps)) {
      if (!unitLookupSlugs.has(existingSlug)) {
        await deleteEnrichmentMap(existingSlug);
        console.log(`[MLS Sync] Deleted stale enrichment map: ${existingSlug}`);
      }
    }

    // Also cache unmatched listings so they appear on the /for-sale page
    if (unmatchedFullListings.length > 0) {
      await writeMlsCache(UNMATCHED_SLUG, unmatchedFullListings);
      totalCached += unmatchedFullListings.length;
    }

    // 5b. Build listing-to-building reverse index for photo proxy lookups
    //     Maps listingId → buildingSlug so photos can be served from KV cache
    //     instead of calling the MLSGrid API for every photo request
    const listingIndex: Record<string, string> = {};
    for (const [buildingSlug, listings] of buildingEntries) {
      for (const listing of listings) {
        listingIndex[listing.listingId] = buildingSlug;
      }
    }
    for (const listing of unmatchedFullListings) {
      listingIndex[listing.listingId] = UNMATCHED_SLUG;
    }
    await writeListingIndex(listingIndex);
    console.log(`[MLS Sync] Built listing index: ${Object.keys(listingIndex).length} entries`);

    // 6. Find the latest ModificationTimestamp for next sync
    const latestTimestamp = findLatestTimestamp(allListings);

    // 7. Count batch listings (what this sync fetched)
    const batchSalesCount = allListings.filter(l => l.listingType === "Sale").length;
    const batchLeasesCount = allListings.filter(l => l.listingType === "Lease").length;

    // 8. Count TOTAL listings across all building caches + unmatched (not just this batch)
    let totalCachedSales = 0;
    let totalCachedLeases = 0;

    for (const building of buildings) {
      const cached = await readMlsCache(building.slug);
      if (cached && cached.data) {
        totalCachedSales += cached.data.filter((l: any) => l.listingType === "Sale").length;
        totalCachedLeases += cached.data.filter((l: any) => l.listingType === "Lease").length;
      }
    }

    // Include unmatched listings in totals
    const unmatchedCached = await readMlsCache(UNMATCHED_SLUG);
    if (unmatchedCached && unmatchedCached.data) {
      totalCachedSales += unmatchedCached.data.filter((l: any) => l.listingType === "Sale").length;
      totalCachedLeases += unmatchedCached.data.filter((l: any) => l.listingType === "Lease").length;
    }

    // 9. Update sync state with total cache counts and batch counts
    await updateSyncState(totalCachedSales, totalCachedLeases, latestTimestamp, batchSalesCount, batchLeasesCount);

    // ========== ANALYTICS SYNC PHASE ==========
    // After active listings are synced, fetch recently changed non-active listings
    // (Closed, Pending, Withdrawn, Hold) for analytics tracking
    let analyticsResult: Record<string, any> = {};

    try {
      console.log("[MLS Sync] Starting analytics sync phase...");

      const analyticsSyncState = await readAnalyticsSyncState();
      const analyticsTimestamp = analyticsSyncState?.lastSyncTimestamp;

      // Fetch recently modified non-active listings (Active/AUC handled by converting already-fetched data)
      const analyticsStatuses = ["Closed", "Pending", "Withdrawn", "Hold", "Expired", "Canceled"];
      const analyticsListings = await mlsClient.fetchAnalyticsListings(
        analyticsStatuses,
        analyticsTimestamp || undefined
      );

      console.log(`[MLS Sync] Analytics: fetched ${analyticsListings.length} non-active listings`);

      // Convert already-fetched active listings to analytics format (avoids duplicate API call)
      const convertedActiveListings: AnalyticsListing[] = [];
      for (const [slug, listings] of buildingEntries) {
        const building = buildings.find(b => b.slug === slug);
        for (const listing of listings) {
          convertedActiveListings.push(
            mlsListingToAnalytics(listing, slug, building?.name || listing.buildingName)
          );
        }
      }
      for (const listing of unmatchedFullListings) {
        convertedActiveListings.push(
          mlsListingToAnalytics(listing, null, listing.buildingName)
        );
      }

      // De-duplicate: if a listing appears in the analytics fetch (with a non-active
      // status like Pending/Closed), don't let the converted active version overwrite it
      const analyticsListingIds = new Set(analyticsListings.map(l => l.listingId));
      const filteredActiveListings = convertedActiveListings.filter(
        l => !analyticsListingIds.has(l.listingId)
      );

      const superseded = convertedActiveListings.length - filteredActiveListings.length;
      console.log(`[MLS Sync] Analytics: converted ${convertedActiveListings.length} active listings (${superseded} superseded by analytics fetch)`);

      // Combine: analytics-fetched listings (authoritative for status changes) first,
      // then active listings that don't conflict
      const allAnalyticsListings = [...analyticsListings, ...filteredActiveListings];

      // Load enrichment maps for auto-enrichment
      const enrichmentMaps = await readAllEnrichmentMaps();

      // Address match and enrich each analytics listing
      const analyticsByBuilding = new Map<string, AnalyticsListing[]>();
      let analyticsMatched = 0;
      let analyticsUnmatched = 0;

      for (const listing of allAnalyticsListings) {
        const slug = matchListingToBuilding(listing.address, listing.buildingName || undefined);
        if (slug) {
          listing.buildingSlug = slug;
          const building = buildings.find(b => b.slug === slug);
          if (building) listing.buildingName = building.name;
          analyticsMatched++;
        } else {
          analyticsUnmatched++;
        }

        // Auto-enrich with floor plan/orientation data
        const enriched = enrichListing(listing, enrichmentMaps);
        const key = enriched.buildingSlug || "_unmatched";
        if (!analyticsByBuilding.has(key)) {
          analyticsByBuilding.set(key, []);
        }
        analyticsByBuilding.get(key)!.push(enriched);
      }

      // Upsert analytics listings into cache
      let analyticsAdded = 0;
      let analyticsUpdated = 0;

      for (const [slug, listings] of Array.from(analyticsByBuilding)) {
        const result = await upsertAnalyticsListings(slug, listings);
        analyticsAdded += result.added;
        analyticsUpdated += result.updated;
      }

      // Capture snapshots of current active/pending listings for lifecycle tracking
      const snapshots: ListingSnapshot[] = allListings.map(l => ({
        listingId: l.listingId,
        capturedAt: new Date().toISOString(),
        status: l.status,
        listPrice: l.listPrice,
        daysOnMarket: l.daysOnMarket,
      }));

      if (snapshots.length > 0) {
        await appendListingSnapshots(snapshots);
      }

      // Update analytics sync state
      const analyticsCounts = await countAnalyticsListings();
      // Use the main sync's latest timestamp (always fresh from full fetch)
      const analyticsLatest = latestTimestamp || analyticsTimestamp || new Date().toISOString();

      const newAnalyticsSyncState: AnalyticsSyncState = {
        lastSyncTimestamp: analyticsLatest || new Date().toISOString(),
        lastSyncDate: new Date().toLocaleString(),
        closedCount: analyticsCounts.closed,
        pendingCount: analyticsCounts.pending,
        activeCount: analyticsCounts.active,
        otherCount: analyticsCounts.other,
        totalCount: analyticsCounts.total,
        status: "success",
      };
      await writeAnalyticsSyncState(newAnalyticsSyncState);

      analyticsResult = {
        analyticsListingsFetched: analyticsListings.length,
        analyticsActiveConverted: convertedActiveListings.length,
        analyticsMatched,
        analyticsUnmatched,
        analyticsAdded,
        analyticsUpdated,
        analyticsTotalCached: analyticsCounts.total,
        snapshotsCaptured: snapshots.length,
      };

      console.log(
        `[MLS Sync] Analytics phase: ${analyticsListings.length} API-fetched + ${convertedActiveListings.length} converted active, ` +
        `${analyticsAdded} added, ${analyticsUpdated} updated, ` +
        `${analyticsCounts.total} total cached`
      );
    } catch (analyticsError) {
      // Analytics sync failure should NOT fail the main sync
      console.error("[MLS Sync] Analytics phase error (non-fatal):", analyticsError);
      analyticsResult = {
        analyticsError: analyticsError instanceof Error ? analyticsError.message : String(analyticsError),
      };
    }

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
      unmatchedCount: unmatchedLogEntries.length,
      unmatchedListings: unmatchedLogEntries.slice(0, 50),
      latestTimestamp,
      duration: `${duration}s`,
      nextSyncTimestamp: latestTimestamp,
      ...analyticsResult,
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
