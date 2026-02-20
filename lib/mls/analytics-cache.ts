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

/**
 * Normalize a listing ID by stripping alphabetic prefixes (e.g., "ACT4939483" → "4939483").
 * MLSGrid returns IDs with originating system prefixes, but CSV imports store plain numbers.
 * Normalizing ensures upsert deduplication works across both sources.
 */
export function normalizeListingId(id: string): string {
  return id.replace(/^[A-Z]+/, "");
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

/**
 * Strip large text fields from analytics listings to stay under the 1MB Upstash KV limit.
 * publicRemarks/privateRemarks can be 500-2000 chars each and aren't needed for analytics.
 */
function trimAnalyticsForCache(listings: AnalyticsListing[]): AnalyticsListing[] {
  return listings.map(listing => {
    const { publicRemarks, privateRemarks, ...rest } = listing as any;
    return rest;
  });
}

export async function writeAnalyticsListings(
  slug: string,
  listings: AnalyticsListing[]
): Promise<void> {
  try {
    const trimmed = trimAnalyticsForCache(listings);
    await kv.set(getAnalyticsKey(slug), trimmed);
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
 * Merges new listings with existing ones, deduplicating by normalized listingId
 * (strips alphabetic prefixes so "ACT4939483" matches "4939483").
 * New data takes precedence over existing data for the same listing.
 */
export async function upsertAnalyticsListings(
  slug: string,
  newListings: AnalyticsListing[]
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readAnalyticsListings(slug);

  // Use normalized IDs for dedup so CSV imports ("4939483") match API data ("ACT4939483")
  const map = new Map<string, AnalyticsListing>();
  for (const listing of existing) {
    map.set(normalizeListingId(listing.listingId), listing);
  }

  let added = 0;
  let updated = 0;

  for (const listing of newListings) {
    const normId = normalizeListingId(listing.listingId);
    // Normalize the stored ID so all entries use the same format going forward
    listing.listingId = normId;
    if (map.has(normId)) {
      updated++;
    } else {
      added++;
    }
    map.set(normId, listing);
  }

  const merged = Array.from(map.values());
  await writeAnalyticsListings(slug, merged);

  return { added, updated, total: merged.length };
}

/**
 * Read all analytics listings across all buildings.
 * Returns a flat array of all listings, deduplicated by normalized listingId.
 * When duplicates exist across building caches, prefers api-sync over csv-import,
 * and most recent importedAt within the same source type.
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

  // Deduplicate across building caches by normalized listingId.
  // A listing can exist in multiple caches (e.g., CSV-imported into 44-east as Pending,
  // then API-synced as Closed). Keep the most authoritative entry.
  const dedupMap = new Map<string, AnalyticsListing>();
  for (const listing of allListings) {
    const normId = normalizeListingId(listing.listingId);
    const existing = dedupMap.get(normId);
    if (!existing) {
      dedupMap.set(normId, listing);
    } else {
      // Prefer api-sync source over csv-import
      const existingIsApiSync = existing.source === "api-sync";
      const newIsApiSync = listing.source === "api-sync";
      if (newIsApiSync && !existingIsApiSync) {
        dedupMap.set(normId, listing);
      } else if (newIsApiSync === existingIsApiSync) {
        // Same source type: prefer the one with more recent importedAt
        if ((listing.importedAt || "") > (existing.importedAt || "")) {
          dedupMap.set(normId, listing);
        }
      }
    }
  }

  return Array.from(dedupMap.values());
}

/**
 * Remove listings from all building caches EXCEPT the target slug.
 * Ensures each listingId only exists in one building cache (single source of truth).
 * Called after sync upserts to clean up cross-building duplicates.
 */
export async function removeListingFromOtherSlugs(
  targetSlug: string,
  listingIds: Set<string>
): Promise<number> {
  let totalRemoved = 0;
  const allSlugs = [...buildings.map(b => b.slug), UNMATCHED_SLUG];

  for (const slug of allSlugs) {
    if (slug === targetSlug) continue;
    const existing = await readAnalyticsListings(slug);
    const cleaned = existing.filter(
      l => !listingIds.has(normalizeListingId(l.listingId))
    );
    if (cleaned.length < existing.length) {
      const removed = existing.length - cleaned.length;
      totalRemoved += removed;
      await writeAnalyticsListings(slug, cleaned);
      console.log(`[Analytics Cache] Removed ${removed} duplicate listings from ${slug} (moved to ${targetSlug})`);
    }
  }
  return totalRemoved;
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
