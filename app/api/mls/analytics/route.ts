// Analytics Data API Endpoint
// Serves analytics listings from KV cache to the frontend
// Cache-only — never hits MLSGrid directly

import { NextRequest, NextResponse } from "next/server";
import {
  readAllAnalyticsListings,
  readAnalyticsListings,
  readAnalyticsSyncState,
  readAnalyticsImportState,
} from "@/lib/mls/analytics-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const building = searchParams.get("building");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Get listings
    let listings;
    if (building) {
      listings = await readAnalyticsListings(building);
    } else {
      listings = await readAllAnalyticsListings();
    }

    // Filter by status
    if (status !== "all") {
      const statusMap: Record<string, string[]> = {
        closed: ["Closed"],
        pending: ["Pending", "Active Under Contract"],
        offmarket: ["Withdrawn", "Hold", "Expired", "Canceled", "Deleted"],
        active: ["Active"],
      };

      const allowedStatuses = statusMap[status];
      if (allowedStatuses) {
        listings = listings.filter((l) =>
          allowedStatuses.some(
            (s) => l.status.toLowerCase() === s.toLowerCase()
          )
        );
      }
    }

    // Filter by date range
    if (from || to) {
      listings = listings.filter((l) => {
        // Use closeDate for closed, listingContractDate for others
        const date =
          l.status === "Closed" ? l.closeDate : l.listingContractDate;
        if (!date) return true; // Include if no date

        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      });
    }

    // Get sync and import state for metadata
    const [syncState, importState] = await Promise.all([
      readAnalyticsSyncState(),
      readAnalyticsImportState(),
    ]);

    return NextResponse.json({
      listings,
      count: listings.length,
      syncState,
      importState,
    });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to read analytics data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
