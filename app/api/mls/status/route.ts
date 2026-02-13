// Diagnostic endpoint for MLS sync status
// Shows sync state, per-building cache counts, and overall health

import { NextRequest, NextResponse } from "next/server";
import { readMlsCache } from "@/lib/mls/cache";
import { readSyncState } from "@/lib/mls/sync-state";
import { buildings } from "@/data/buildings";

export const dynamic = "force-dynamic";

const AUTH_TOKEN = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncState = await readSyncState();

    const buildingStats = [];
    let totalSales = 0;
    let totalLeases = 0;

    for (const building of buildings) {
      const cached = await readMlsCache(building.slug);
      const sales = cached?.data?.filter((l: any) => l.listingType === "Sale").length || 0;
      const leases = cached?.data?.filter((l: any) => l.listingType === "Lease").length || 0;

      if (sales > 0 || leases > 0) {
        buildingStats.push({
          name: building.name,
          slug: building.slug,
          sales,
          leases,
          total: sales + leases,
          cacheTimestamp: cached?.timestamp ? new Date(cached.timestamp).toISOString() : null,
        });
      }

      totalSales += sales;
      totalLeases += leases;
    }

    const nextSyncMode = syncState?.lastSyncTimestamp ? "incremental" : "initial";

    return NextResponse.json({
      syncState,
      nextSyncMode,
      cache: {
        totalSales,
        totalLeases,
        totalListings: totalSales + totalLeases,
        buildingsWithListings: buildingStats.length,
        totalBuildings: buildings.length,
        buildings: buildingStats,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to read status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
