// Vercel KV cache utilities for analytics data
// Stores historical transactions (closed, pending, withdrawn, etc.) and lifecycle snapshots

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import { buildings } from "@/data/buildings";
import {
  AnalyticsListing,
  AnalyticsSyncState,
  AnalyticsImportState,
  ListingSnapshot,
} from "./analytics-types";

// KV key prefixes
const ANALYTICS_PREFIX = "mls:analytics:";
const ANALYTICS_SYNC_STATE_KEY = "mls:analytics:sync:state";
const ANALYTICS_IMPORT_STATE_KEY = "mls:analytics:import:state";
const SNAPSHOTS_PREFIX = "mls:analytics:snapshots:";
const UNMATCHED_SLUG = "_unmatched";

function getAnalyticsKey(slug: string): string {
  return `${ANALYTICS_PREFIX}${slug}`;
}

function getSnapshotKey(yearMonth: string): string {
  return `${SNAPSHOTS_PREFIX}${yearMonth}`;
}

// --- Analytics Listings ---

export async function readAnalyticsListings(
  slug: string
): Promise<AnalyticsListing[]> {
  noStore();
  try {
    const data = await kv.get<AnalyticsListing[]>(getAnalyticsKey(slug));
    return data || [];
  } catch (error) {
    console.error(
      `[Analytics Cache] Error reading analytics for ${slug}:`,
      error
    );
    return [];
  }
}

export async function writeAnalyticsListings(
  slug: string,
  listings: AnalyticsListing[]
): Promise<void> {
  try {
    await kv.set(getAnalyticsKey(slug), listings);
    console.log(
      `[Analytics Cache] Wrote ${listings.length} analytics listings for ${slug}`
    );
  } catch (error) {
    console.error(
      `[Analytics Cache] Error writing analytics for ${slug}:`,
      error
    );
    throw error;
  }
}

/**
 * Upsert analytics listings into a building's cache.
 * Merges new listings with existing ones, deduplicating by listingId.
 * New data takes precedence over existing data for the same listingId.
 */
export async function upsertAnalyticsListings(
  slug: string,
  newListings: AnalyticsListing[]
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readAnalyticsListings(slug);

  const map = new Map<string, AnalyticsListing>();
  for (const listing of existing) {
    map.set(listing.listingId, listing);
  }

  let added = 0;
  let updated = 0;

  for (const listing of newListings) {
    if (map.has(listing.listingId)) {
      updated++;
    } else {
      added++;
    }
    map.set(listing.listingId, listing);
  }

  const merged = Array.from(map.values());
  await writeAnalyticsListings(slug, merged);

  return { added, updated, total: merged.length };
}

/**
 * Read all analytics listings across all buildings.
 * Returns a flat array of all listings.
 */
export async function readAllAnalyticsListings(): Promise<AnalyticsListing[]> {
  noStore();
  const allListings: AnalyticsListing[] = [];

  for (const building of buildings) {
    const listings = await readAnalyticsListings(building.slug);
    allListings.push(...listings);
  }

  // Also include unmatched
  const unmatched = await readAnalyticsListings(UNMATCHED_SLUG);
  allListings.push(...unmatched);

  return allListings;
}

// --- Sync State ---

export async function readAnalyticsSyncState(): Promise<AnalyticsSyncState | null> {
  noStore();
  try {
    return await kv.get<AnalyticsSyncState>(ANALYTICS_SYNC_STATE_KEY);
  } catch (error) {
    console.error("[Analytics Cache] Error reading sync state:", error);
    return null;
  }
}

export async function writeAnalyticsSyncState(
  state: AnalyticsSyncState
): Promise<void> {
  try {
    await kv.set(ANALYTICS_SYNC_STATE_KEY, state);
    console.log(
      `[Analytics Cache] Updated sync state: ${state.totalCount} total, status=${state.status}`
    );
  } catch (error) {
    console.error("[Analytics Cache] Error writing sync state:", error);
    throw error;
  }
}

export async function getAnalyticsSyncTimestamp(): Promise<string | null> {
  const state = await readAnalyticsSyncState();
  return state?.lastSyncTimestamp || null;
}

// --- Import State ---

export async function readAnalyticsImportState(): Promise<AnalyticsImportState | null> {
  noStore();
  try {
    return await kv.get<AnalyticsImportState>(ANALYTICS_IMPORT_STATE_KEY);
  } catch (error) {
    console.error("[Analytics Cache] Error reading import state:", error);
    return null;
  }
}

export async function writeAnalyticsImportState(
  state: AnalyticsImportState
): Promise<void> {
  try {
    await kv.set(ANALYTICS_IMPORT_STATE_KEY, state);
    console.log(
      `[Analytics Cache] Updated import state: ${state.totalImported} imported`
    );
  } catch (error) {
    console.error("[Analytics Cache] Error writing import state:", error);
    throw error;
  }
}

// --- Lifecycle Snapshots ---

export async function readListingSnapshots(
  yearMonth: string
): Promise<ListingSnapshot[]> {
  noStore();
  try {
    const data = await kv.get<ListingSnapshot[]>(getSnapshotKey(yearMonth));
    return data || [];
  } catch (error) {
    console.error(
      `[Analytics Cache] Error reading snapshots for ${yearMonth}:`,
      error
    );
    return [];
  }
}

export async function writeListingSnapshots(
  yearMonth: string,
  snapshots: ListingSnapshot[]
): Promise<void> {
  try {
    await kv.set(getSnapshotKey(yearMonth), snapshots);
    console.log(
      `[Analytics Cache] Wrote ${snapshots.length} snapshots for ${yearMonth}`
    );
  } catch (error) {
    console.error(
      `[Analytics Cache] Error writing snapshots for ${yearMonth}:`,
      error
    );
    throw error;
  }
}

/**
 * Append snapshots to the current month's bucket.
 */
export async function appendListingSnapshots(
  snapshots: ListingSnapshot[]
): Promise<void> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const existing = await readListingSnapshots(yearMonth);
  const merged = [...existing, ...snapshots];

  // If the bucket gets too large (>800KB), only keep the most recent snapshots
  const serialized = JSON.stringify(merged);
  if (serialized.length > 800_000) {
    console.warn(
      `[Analytics Cache] Snapshot bucket ${yearMonth} exceeds 800KB, trimming oldest`
    );
    const trimmed = merged.slice(merged.length - Math.floor(merged.length * 0.7));
    await writeListingSnapshots(yearMonth, trimmed);
  } else {
    await writeListingSnapshots(yearMonth, merged);
  }
}

// --- Utility ---

/**
 * Count analytics listings across all buildings by status.
 */
export async function countAnalyticsListings(): Promise<{
  closed: number;
  pending: number;
  active: number;
  other: number;
  total: number;
}> {
  const all = await readAllAnalyticsListings();

  let closed = 0;
  let pending = 0;
  let active = 0;
  let other = 0;

  for (const listing of all) {
    const s = (listing.status || "").toLowerCase();
    if (s === "closed") closed++;
    else if (s === "pending") pending++;
    else if (s === "active" || s === "active under contract") active++;
    else other++;
  }

  return { closed, pending, active, other, total: all.length };
}
