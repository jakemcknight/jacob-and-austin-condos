// API route for reading MLS listings from cache
// CACHE-ONLY: Does not call MLSGrid API directly
// Listings are updated by the /api/mls/sync cron job
//
// Query parameters:
//   ?building={slug}  — filter to a specific building
//   ?status=active|sold|offmarket|all — filter by listing status (default: active)

import { NextRequest, NextResponse } from "next/server";
import { readMlsCache } from "@/lib/mls/cache";
import { readAnalyticsListings, readAllAnalyticsListings } from "@/lib/mls/analytics-cache";
import { buildings } from "@/data/buildings";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";

// Force dynamic rendering - no ISR caching since data is already cached in KV
export const dynamic = 'force-dynamic';

// Reserved cache key for DT condo listings not matched to a specific building
const UNMATCHED_SLUG = "_unmatched";

// Status values considered "active" in the analytics cache
const ACTIVE_STATUSES = new Set(["active", "active under contract"]);
const SOLD_STATUSES = new Set(["closed"]);
const OFFMARKET_STATUSES = new Set(["withdrawn", "hold", "expired", "canceled", "deleted"]);

// Strip originating system prefix (e.g. "ACT") from mlsNumber for display
// Handles both old cached data (with prefix) and new data (already stripped)
function cleanMlsNumber(listing: any): any {
  if (listing.mlsNumber && /^[A-Z]+\d/.test(listing.mlsNumber)) {
    return { ...listing, mlsNumber: listing.mlsNumber.replace(/^[A-Z]+/, "") };
  }
  return listing;
}

/**
 * Convert an AnalyticsListing to the MLSListingDisplay-compatible shape
 * used by the frontend. Strips closePrice per Unlock MLS rules.
 */
function analyticsToDisplayListing(al: AnalyticsListing): any {
  const isClosed = al.status === "Closed";
  const isLease = al.propertyType?.toLowerCase().includes("lease");

  return {
    listingId: al.listingId,
    mlsNumber: al.listingId, // Analytics listings use listingId as the MLS number
    address: al.address,
    unitNumber: al.unitNumber,
    // Always show list price publicly — close price hidden per Unlock MLS rules
    listPrice: al.listPrice,
    bedroomsTotal: al.bedroomsTotal,
    bathroomsTotalInteger: al.bathroomsTotalInteger,
    livingArea: al.livingArea,
    priceSf: al.livingArea > 0 ? al.listPrice / al.livingArea : 0,
    status: al.status,
    listDate: al.listingContractDate || "",
    daysOnMarket: al.daysOnMarket,
    listingType: isLease ? "Lease" as const : "Sale" as const,
    // For Closed listings: only primary photo per Unlock MLS rules
    // For other off-market: no cached photos (will use on-demand fetch on detail page)
    photos: [],
    hoaFee: al.hoaFee,
    yearBuilt: al.yearBuilt,
    propertySubType: al.propertySubType,
    floorPlan: al.floorPlan,
    orientation: al.orientation,
    buildingSlug: al.buildingSlug,
    buildingName: al.buildingName,
    // Off-market metadata
    offMarket: true,
    originalStatus: al.status,
    statusChangeDate: isClosed
      ? al.closeDate
      : al.offMarketDate || al.withdrawnDate || al.cancellationDate || al.holdDate || al.statusChangeTimestamp,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const buildingSlug = searchParams.get("building");
    const statusFilter = searchParams.get("status") || "active";

    // Determine which data sources to read
    const includeActive = statusFilter === "active" || statusFilter === "all";
    const includeSold = statusFilter === "sold" || statusFilter === "all";
    const includeOffmarket = statusFilter === "offmarket" || statusFilter === "all";
    const includeAnalytics = includeSold || includeOffmarket;

    const allListings: any[] = [];

    if (buildingSlug) {
      // ===== SINGLE BUILDING =====
      const building = buildings.find(b => b.slug === buildingSlug);
      if (!building) {
        return NextResponse.json(
          { error: `Building not found: ${buildingSlug}` },
          { status: 404 }
        );
      }

      // Active listings from main cache
      if (includeActive) {
        const cached = await readMlsCache(buildingSlug);
        if (cached && cached.data) {
          allListings.push(...cached.data.map(cleanMlsNumber));
        }
      }

      // Analytics listings (sold/offmarket)
      if (includeAnalytics) {
        const analyticsListings = await readAnalyticsListings(buildingSlug);
        const activeIds = new Set(allListings.map((l: any) => l.listingId));

        for (const al of analyticsListings) {
          // Skip if already in active listings (active wins)
          if (activeIds.has(al.listingId)) continue;

          const s = al.status.toLowerCase();
          // Skip active-status analytics listings (they're in the active cache)
          if (ACTIVE_STATUSES.has(s)) continue;

          // Filter by requested status
          if (includeSold && SOLD_STATUSES.has(s)) {
            allListings.push(analyticsToDisplayListing(al));
          } else if (includeOffmarket && OFFMARKET_STATUSES.has(s)) {
            allListings.push(analyticsToDisplayListing(al));
          }
        }
      }

      console.log(`[MLS API] Cache hit for ${buildingSlug} (${allListings.length} listings, status=${statusFilter})`);
      return NextResponse.json(allListings);
    }

    // ===== ALL BUILDINGS =====
    console.log(`[MLS API] Fetching all listings across all buildings (status=${statusFilter})`);

    // Collect active listing IDs for de-duplication
    const activeIds = new Set<string>();

    // Active listings from main cache
    if (includeActive) {
      for (const building of buildings) {
        const cached = await readMlsCache(building.slug);
        if (cached && cached.data) {
          const listingsWithBuilding = cached.data.map((listing: any) => cleanMlsNumber({
            ...listing,
            buildingSlug: building.slug,
            buildingName: building.name,
          }));
          for (const l of listingsWithBuilding) {
            activeIds.add(l.listingId);
          }
          allListings.push(...listingsWithBuilding);
        }
      }

      // Include unmatched DT condo listings
      const unmatchedCached = await readMlsCache(UNMATCHED_SLUG);
      if (unmatchedCached && unmatchedCached.data) {
        const unmatchedWithMeta = unmatchedCached.data.map((listing: any) => cleanMlsNumber({
          ...listing,
          buildingSlug: null,
          buildingName: listing.buildingName || "Downtown Austin",
        }));
        for (const l of unmatchedWithMeta) {
          activeIds.add(l.listingId);
        }
        allListings.push(...unmatchedWithMeta);
      }
    }

    // Analytics listings (sold/offmarket)
    if (includeAnalytics) {
      const allAnalytics = await readAllAnalyticsListings();

      for (const al of allAnalytics) {
        // Skip if already in active listings (active wins)
        if (activeIds.has(al.listingId)) continue;

        const s = al.status.toLowerCase();
        // Skip active-status analytics listings
        if (ACTIVE_STATUSES.has(s)) continue;

        // Filter by requested status
        if (includeSold && SOLD_STATUSES.has(s)) {
          allListings.push(analyticsToDisplayListing(al));
        } else if (includeOffmarket && OFFMARKET_STATUSES.has(s)) {
          allListings.push(analyticsToDisplayListing(al));
        }
      }
    }

    console.log(`[MLS API] Returning ${allListings.length} total listings (status=${statusFilter})`);
    return NextResponse.json(allListings);
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
