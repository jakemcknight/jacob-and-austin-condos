// Retroactive Enrichment Endpoint
// Re-applies floor plan/orientation data to all existing analytics listings
// Triggered manually via "Re-enrich All Transactions" button

import { NextRequest, NextResponse } from "next/server";
import { buildings } from "@/data/buildings";
import {
  readAnalyticsListings,
  writeAnalyticsListings,
} from "@/lib/mls/analytics-cache";
import {
  readAllEnrichmentMaps,
  enrichListings,
  getEnrichmentStats,
} from "@/lib/mls/enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const UNMATCHED_SLUG = "_unmatched";

export async function POST(_request: NextRequest) {
  const startTime = Date.now();

  try {
    // Load all enrichment maps
    const enrichmentMaps = await readAllEnrichmentMaps();
    const enrichedBuildingSlugs = Object.keys(enrichmentMaps);

    if (enrichedBuildingSlugs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No enrichment data found. Upload floor plan data first.",
        enriched: 0,
        buildingsProcessed: 0,
      });
    }

    let totalEnriched = 0;
    let totalProcessed = 0;
    let buildingsUpdated = 0;
    const buildingResults: Array<{
      slug: string;
      processed: number;
      enriched: number;
    }> = [];

    // Process each building (including unmatched)
    const slugsToProcess = [
      ...buildings.map((b) => b.slug),
      UNMATCHED_SLUG,
    ];

    for (const slug of slugsToProcess) {
      const listings = await readAnalyticsListings(slug);
      if (listings.length === 0) continue;

      const before = listings.filter((l) => l.floorPlan || l.orientation).length;
      const enriched = enrichListings(listings, enrichmentMaps);
      const after = enriched.filter((l) => l.floorPlan || l.orientation).length;
      const newlyEnriched = after - before;

      if (newlyEnriched > 0) {
        await writeAnalyticsListings(slug, enriched);
        buildingsUpdated++;
      }

      totalProcessed += listings.length;
      totalEnriched += newlyEnriched;

      if (listings.length > 0) {
        buildingResults.push({
          slug,
          processed: listings.length,
          enriched: newlyEnriched,
        });
      }
    }

    const stats = await getEnrichmentStats();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalEnriched,
      buildingsUpdated,
      buildingResults: buildingResults.filter((r) => r.enriched > 0),
      enrichmentStats: stats,
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error("[Enrichment Apply] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Re-enrichment failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
