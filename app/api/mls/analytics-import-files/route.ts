// Server-Side CSV Import Endpoint
// Reads CSV files directly from data/imports/ on the filesystem
// Bypasses browser upload — processes all files in one request

import { NextResponse } from "next/server";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
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

interface FileResult {
  fileName: string;
  totalRows: number;
  parsed: number;
  errors: number;
}

export async function POST() {
  const startTime = Date.now();

  try {
    // Find CSV files in data/imports/
    const importsDir = join(process.cwd(), "data", "imports");
    let files: string[];

    try {
      files = readdirSync(importsDir).filter((f) =>
        f.toLowerCase().endsWith(".csv")
      );
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Could not read data/imports/ directory",
        },
        { status: 500 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No CSV files found in data/imports/" },
        { status: 400 }
      );
    }

    console.log(
      `[Import Files] Found ${files.length} CSV files: ${files.join(", ")}`
    );

    // Load enrichment maps once for all files
    const enrichmentMaps = await readAllEnrichmentMaps();

    // Process all files
    const allListings: AnalyticsListing[] = [];
    const allErrors: string[] = [];
    const fileResults: FileResult[] = [];

    for (const fileName of files) {
      const filePath = join(importsDir, fileName);
      console.log(`[Import Files] Processing ${fileName}...`);

      const csvText = readFileSync(filePath, "utf-8");
      const rows = parseCsv(csvText);

      if (rows.length === 0) {
        allErrors.push(`[${fileName}] No valid rows found`);
        fileResults.push({
          fileName,
          totalRows: 0,
          parsed: 0,
          errors: 1,
        });
        continue;
      }

      // Detect columns (should be the same for all files from the same export)
      const headers = Object.keys(rows[0]);
      const columnMap = detectColumnMapping(headers);

      let fileParsed = 0;
      let fileErrors = 0;

      for (let i = 0; i < rows.length; i++) {
        try {
          const listing = rowToAnalyticsListing(rows[i], columnMap);
          if (listing) {
            allListings.push(listing);
            fileParsed++;
          }
        } catch (err) {
          fileErrors++;
          if (allErrors.length < 50) {
            allErrors.push(
              `[${fileName} row ${i + 2}] ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }

      fileResults.push({
        fileName,
        totalRows: rows.length,
        parsed: fileParsed,
        errors: fileErrors,
      });

      console.log(
        `[Import Files] ${fileName}: ${fileParsed} parsed, ${fileErrors} errors`
      );
    }

    console.log(
      `[Import Files] Total: ${allListings.length} listings from ${files.length} files`
    );

    // Address match to buildings
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const listing of allListings) {
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

    console.log(
      `[Import Files] Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`
    );

    // Enrich with floor plan/orientation data
    const enriched = enrichListings(allListings, enrichmentMaps);

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
      console.log(
        `[Import Files] Upserting ${buildingListings.length} listings for ${slug}...`
      );
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

    console.log(
      `[Import Files] Complete in ${duration}s — Added: ${totalAdded}, Updated: ${totalUpdated}`
    );

    return NextResponse.json({
      success: true,
      filesProcessed: files.length,
      fileResults,
      totalRows: fileResults.reduce((sum, f) => sum + f.totalRows, 0),
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
      errors: allErrors.slice(0, 50),
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error("[Import Files] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Server-side import failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
