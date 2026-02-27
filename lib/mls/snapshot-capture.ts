// Daily Market Snapshot Capture
// Computes and stores a point-in-time market snapshot in KV
// Called on every 15-min sync to keep today's snapshot up to date

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import { median } from "./analytics-computations";
import type { MLSListing } from "./types";

// --- Types (mirrored from downtown-shared/types/snapshots.ts) ---

export interface DailyMarketSnapshot {
  date: string;
  capturedAt: string;
  source: "live" | "reconstructed";
  totalActiveSales: number;
  totalActiveLeases: number;
  totalPendingSales: number;
  totalPendingLeases: number;
  medianActiveListPrice: number | null;
  medianActivePriceSf: number | null;
  buildings: BuildingSnapshot[];
  listings: ListingSnapshotEntry[];
}

export interface BuildingSnapshot {
  slug: string;
  activeSales: number;
  activeLeases: number;
  pendingSales: number;
  pendingLeases: number;
  medianListPrice: number | null;
  medianPriceSf: number | null;
  byBedroom: Record<
    number,
    {
      active: number;
      pending: number;
      medianPrice: number | null;
      medianPriceSf: number | null;
    }
  >;
}

export interface ListingSnapshotEntry {
  listingId: string;
  buildingSlug: string;
  unitNumber: string;
  status: string;
  listingType: "Sale" | "Lease";
  listPrice: number;
  originalListPrice: number;
  priceSf: number;
  bedroomsTotal: number;
  livingArea: number;
  listDate: string;
  daysOnMarket: number;
}

// --- KV Keys ---

const SNAPSHOT_PREFIX = "mls:snapshots:";
const SNAPSHOT_INDEX_KEY = "mls:snapshots:index";

function getSnapshotKey(date: string): string {
  return `${SNAPSHOT_PREFIX}${date}`;
}

// --- Public API ---

/**
 * Compute and store today's market snapshot.
 * Called on every sync run — overwrites the existing snapshot for today
 * so end-of-day reflects all changes (price reductions, status changes, etc.)
 *
 * @param listingsByBuilding - Map of buildingSlug → MLSListing[] (current active/pending)
 */
export async function captureAndStoreDailySnapshot(
  listingsByBuilding: Map<string, MLSListing[]>
): Promise<void> {
  const today = getTodayDateString();

  try {
    const snapshot = buildSnapshot(today, listingsByBuilding);
    await writeSnapshot(today, snapshot);
    await ensureDateInIndex(today);
    console.log(
      `[Snapshot] Captured ${today}: ${snapshot.totalActiveSales} active sales, ` +
        `${snapshot.totalPendingSales} pending sales, ${snapshot.listings.length} listings`
    );
  } catch (error) {
    // Snapshot failure should never break the sync
    console.error("[Snapshot] Error capturing daily snapshot (non-fatal):", error);
  }
}

/**
 * Read a snapshot for a specific date from KV.
 */
export async function readSnapshot(
  date: string
): Promise<DailyMarketSnapshot | null> {
  noStore();
  try {
    return await kv.get<DailyMarketSnapshot>(getSnapshotKey(date));
  } catch (error) {
    console.error(`[Snapshot] Error reading snapshot for ${date}:`, error);
    return null;
  }
}

/**
 * Read the list of all available snapshot dates.
 */
export async function readSnapshotIndex(): Promise<string[]> {
  noStore();
  try {
    return (await kv.get<string[]>(SNAPSHOT_INDEX_KEY)) || [];
  } catch (error) {
    console.error("[Snapshot] Error reading snapshot index:", error);
    return [];
  }
}

// --- Internal Helpers ---

function getTodayDateString(): string {
  // Use Central Time (Austin) for consistent daily boundaries
  const now = new Date();
  const ct = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  const year = ct.getFullYear();
  const month = String(ct.getMonth() + 1).padStart(2, "0");
  const day = String(ct.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeMedian(values: number[]): number | null {
  const valid = values.filter((v) => v > 0);
  return valid.length > 0 ? median(valid) : null;
}

function buildSnapshot(
  date: string,
  listingsByBuilding: Map<string, MLSListing[]>
): DailyMarketSnapshot {
  let totalActiveSales = 0;
  let totalActiveLeases = 0;
  let totalPendingSales = 0;
  let totalPendingLeases = 0;
  const allActiveSalePrices: number[] = [];
  const allActiveSalePsf: number[] = [];
  const buildingSnapshots: BuildingSnapshot[] = [];
  const listingEntries: ListingSnapshotEntry[] = [];

  for (const [slug, listings] of listingsByBuilding) {
    const activeSales = listings.filter(
      (l) => l.status === "Active" && l.listingType === "Sale"
    );
    const activeLeases = listings.filter(
      (l) => l.status === "Active" && l.listingType === "Lease"
    );
    const pendingSales = listings.filter(
      (l) => l.status === "Pending" && l.listingType === "Sale"
    );
    const pendingLeases = listings.filter(
      (l) => l.status === "Pending" && l.listingType === "Lease"
    );

    totalActiveSales += activeSales.length;
    totalActiveLeases += activeLeases.length;
    totalPendingSales += pendingSales.length;
    totalPendingLeases += pendingLeases.length;

    // Collect prices for market-wide median
    for (const l of activeSales) {
      allActiveSalePrices.push(l.listPrice);
      if (l.priceSf > 0) allActiveSalePsf.push(l.priceSf);
    }

    // Bedroom breakdown (sales only — active + pending)
    const byBedroom: BuildingSnapshot["byBedroom"] = {};
    for (const l of [...activeSales, ...pendingSales]) {
      const br = l.bedroomsTotal;
      if (!byBedroom[br]) {
        byBedroom[br] = {
          active: 0,
          pending: 0,
          medianPrice: null,
          medianPriceSf: null,
        };
      }
      if (l.status === "Active") {
        byBedroom[br].active++;
      } else {
        byBedroom[br].pending++;
      }
    }
    // Compute median prices per bedroom (active sales only)
    for (const br of Object.keys(byBedroom).map(Number)) {
      const brListings = activeSales.filter((l) => l.bedroomsTotal === br);
      byBedroom[br].medianPrice = safeMedian(brListings.map((l) => l.listPrice));
      byBedroom[br].medianPriceSf = safeMedian(brListings.map((l) => l.priceSf));
    }

    buildingSnapshots.push({
      slug,
      activeSales: activeSales.length,
      activeLeases: activeLeases.length,
      pendingSales: pendingSales.length,
      pendingLeases: pendingLeases.length,
      medianListPrice: safeMedian(activeSales.map((l) => l.listPrice)),
      medianPriceSf: safeMedian(activeSales.map((l) => l.priceSf)),
      byBedroom,
    });

    // Individual listing entries (all active + pending)
    for (const l of listings) {
      listingEntries.push({
        listingId: l.listingId,
        buildingSlug: slug,
        unitNumber: l.unitNumber,
        status: l.status,
        listingType: l.listingType,
        listPrice: l.listPrice,
        originalListPrice: l.originalListPrice ?? l.listPrice,
        priceSf: l.priceSf,
        bedroomsTotal: l.bedroomsTotal,
        livingArea: l.livingArea,
        listDate: l.listDate,
        daysOnMarket: l.daysOnMarket,
      });
    }
  }

  return {
    date,
    capturedAt: new Date().toISOString(),
    source: "live",
    totalActiveSales,
    totalActiveLeases,
    totalPendingSales,
    totalPendingLeases,
    medianActiveListPrice: safeMedian(allActiveSalePrices),
    medianActivePriceSf: safeMedian(allActiveSalePsf),
    buildings: buildingSnapshots,
    listings: listingEntries,
  };
}

async function writeSnapshot(
  date: string,
  snapshot: DailyMarketSnapshot
): Promise<void> {
  await kv.set(getSnapshotKey(date), snapshot);
}

async function ensureDateInIndex(date: string): Promise<void> {
  const index = (await kv.get<string[]>(SNAPSHOT_INDEX_KEY)) || [];
  if (!index.includes(date)) {
    index.push(date);
    index.sort();
    await kv.set(SNAPSHOT_INDEX_KEY, index);
  }
}
