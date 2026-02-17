// Analytics CSV Import Endpoint
// Accepts a CSV upload of MLS transaction data (all statuses) and imports into KV cache

import { NextRequest, NextResponse } from "next/server";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import { buildings } from "@/data/buildings";
import {
  upsertAnalyticsListings,
  writeAnalyticsImportState,
} from "@/lib/mls/analytics-cache";
import { readAllEnrichmentMaps, enrichListings } from "@/lib/mls/enrichment";
import { AnalyticsListing } from "@/lib/mls/analytics-types";
import {
  parseCsv,
  detectColumnMapping,
  rowToAnalyticsListing,
} from "@/lib/mls/analytics-import-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large imports

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body — expect JSON with csvText field
    const body = await request.json();
    const csvText: string = body.csvText;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing csvText in request body" },
        { status: 400 }
      );
    }

    // Parse CSV
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Detect column mapping
    const headers = Object.keys(rows[0]);
    const columnMap = detectColumnMapping(headers);

    console.log(
      `[Analytics Import] Detected columns: ${JSON.stringify(columnMap)}`
    );
    console.log(`[Analytics Import] Parsing ${rows.length} rows...`);

    // Load enrichment maps for auto-enrichment
    const enrichmentMaps = await readAllEnrichmentMaps();

    // Convert CSV rows to AnalyticsListing
    const listings: AnalyticsListing[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const listing = rowToAnalyticsListing(rows[i], columnMap);
        if (listing) {
          listings.push(listing);
        }
      } catch (err) {
        if (errors.length < 20) {
          errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    console.log(
      `[Analytics Import] Parsed ${listings.length} valid listings (${errors.length} errors)`
    );

    // Address match to buildings
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const listing of listings) {
      const slug = matchListingToBuilding(
        listing.address,
        listing.buildingName || undefined
      );
      if (slug) {
        listing.buildingSlug = slug;
        const building = buildings.find((b) => b.slug === slug);
        if (building) {
          listing.buildingName = building.name;
        }
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    // Enrich with floor plan/orientation data (enrichment maps override CSV values if present)
    const enriched = enrichListings(listings, enrichmentMaps);

    // Group by building slug and upsert
    const byBuilding = new Map<string, AnalyticsListing[]>();
    for (const listing of enriched) {
      const key = listing.buildingSlug || "_unmatched";
      if (!byBuilding.has(key)) {
        byBuilding.set(key, []);
      }
      byBuilding.get(key)!.push(listing);
    }

    let totalAdded = 0;
    let totalUpdated = 0;

    for (const [slug, buildingListings] of Array.from(byBuilding)) {
      const result = await upsertAnalyticsListings(slug, buildingListings);
      totalAdded += result.added;
      totalUpdated += result.updated;
    }

    // Compute date range
    const closeDates = enriched
      .map((l) => l.closeDate)
      .filter((d): d is string => !!d && d.length > 0)
      .sort();
    const listDates = enriched
      .map((l) => l.listingContractDate)
      .filter((d): d is string => !!d && d.length > 0)
      .sort();
    const allDates = [...closeDates, ...listDates].sort();

    // Save import state
    await writeAnalyticsImportState({
      lastImportDate: new Date().toISOString(),
      totalImported: enriched.length,
      matchedCount,
      unmatchedCount,
      dateRangeStart: allDates[0] || "",
      dateRangeEnd: allDates[allDates.length - 1] || "",
      buildingsAffected: byBuilding.size,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      totalImported: enriched.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      added: totalAdded,
      updated: totalUpdated,
      buildingsAffected: byBuilding.size,
      dateRange: {
        start: allDates[0] || null,
        end: allDates[allDates.length - 1] || null,
      },
      detectedColumns: columnMap,
      errors: errors.slice(0, 20),
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error("[Analytics Import] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Import failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
