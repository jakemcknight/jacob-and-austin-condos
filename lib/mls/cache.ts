// Vercel KV cache utilities for MLS data
// Uses Upstash Redis for persistent storage in serverless environment

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import { MLSListing, CachedMlsData } from "./types";

// KV key prefix for MLS cache entries
const CACHE_PREFIX = "mls:cache:";

// KV key for the listing-to-building reverse index
const LISTING_INDEX_KEY = "mls:index:listings";

/**
 * Generate KV key for a building's MLS cache
 */
function getCacheKey(slug: string): string {
  return `${CACHE_PREFIX}${slug}`;
}

/**
 * Read MLS cache for a specific building from Vercel KV
 */
export async function readMlsCache(slug: string): Promise<CachedMlsData | null> {
  noStore();
  try {
    const key = getCacheKey(slug);
    const cached = await kv.get<CachedMlsData>(key);

    if (!cached) {
      return null;
    }

    return cached;
  } catch (error) {
    console.error(`[MLS Cache] Error reading cache for ${slug}:`, error);
    return null;
  }
}

/**
 * Strip heavy fields before caching to stay under Upstash 1MB value limit.
 * Removes rawData but keeps all photos — URLs are ~200 bytes each, so even
 * 40 photos per listing is only ~8KB, well within the 1MB KV limit per building.
 * Photo bytes are never stored in KV; only fetched on-demand by the photo proxy.
 */
function trimForCache(listings: MLSListing[]): MLSListing[] {
  return listings.map(listing => {
    const { rawData, ...rest } = listing as any;
    return {
      ...rest,
      photos: rest.photos || [],
    };
  });
}

/**
 * Write MLS cache for a specific building to Vercel KV (replaces existing cache)
 */
export async function writeMlsCache(slug: string, data: MLSListing[]): Promise<void> {
  try {
    const key = getCacheKey(slug);
    const trimmed = trimForCache(data);

    const cached: CachedMlsData = {
      timestamp: Date.now(),
      data: trimmed,
    };

    await kv.set(key, cached);
    console.log(`[MLS Cache] Wrote cache for ${slug} (${data.length} listings)`);
  } catch (error) {
    console.error(`[MLS Cache] Error writing cache for ${slug}:`, error);
    throw error;
  }
}

/**
 * Update MLS cache with incremental changes
 * - Adds new listings
 * - Updates existing listings
 * - Removes listings with mlgCanView = false
 */
export async function updateMlsCache(slug: string, updates: MLSListing[]): Promise<void> {
  try {
    // Read existing cache
    const existing = await readMlsCache(slug);
    const existingData = existing?.data || [];

    // Create a map of existing listings by ID for fast lookup
    const existingMap = new Map<string, MLSListing>();
    for (const listing of existingData) {
      existingMap.set(listing.listingId, listing);
    }

    // Process updates
    let added = 0;
    let updated = 0;
    let removed = 0;

    for (const update of updates) {
      if (update.mlgCanView === false) {
        // Remove listing if it exists
        if (existingMap.has(update.listingId)) {
          existingMap.delete(update.listingId);
          removed++;
        }
      } else {
        // Add or update listing
        if (existingMap.has(update.listingId)) {
          updated++;
        } else {
          added++;
        }
        existingMap.set(update.listingId, update);
      }
    }

    // Convert map back to array
    const updatedData = Array.from(existingMap.values());

    // Write updated cache
    await writeMlsCache(slug, updatedData);

    console.log(
      `[MLS Cache] Updated ${slug}: ${added} added, ${updated} updated, ${removed} removed (total: ${updatedData.length})`
    );
  } catch (error) {
    console.error(`[MLS Cache] Error updating cache for ${slug}:`, error);
    throw error;
  }
}

/**
 * Check if cache is expired based on TTL (in seconds)
 */
export function isCacheExpired(timestamp: number, ttl: number): boolean {
  const now = Date.now();
  const age = (now - timestamp) / 1000; // Convert to seconds
  return age > ttl;
}

/**
 * Write the listing-to-building reverse index to KV.
 * Maps listingId → buildingSlug so the photo proxy can find any listing's
 * photos in 2 KV reads instead of scanning all building caches.
 */
export async function writeListingIndex(index: Record<string, string>): Promise<void> {
  try {
    await kv.set(LISTING_INDEX_KEY, index);
    console.log(`[MLS Cache] Wrote listing index (${Object.keys(index).length} entries)`);
  } catch (error) {
    console.error("[MLS Cache] Error writing listing index:", error);
    throw error;
  }
}

/**
 * Read the listing-to-building reverse index from KV.
 * Returns a map of listingId → buildingSlug, or null if not found.
 */
export async function readListingIndex(): Promise<Record<string, string> | null> {
  noStore();
  try {
    const index = await kv.get<Record<string, string>>(LISTING_INDEX_KEY);
    return index || null;
  } catch (error) {
    console.error("[MLS Cache] Error reading listing index:", error);
    return null;
  }
}

/**
 * Clear all cached data from Vercel KV
 */
export async function clearAllCache(): Promise<void> {
  try {
    // Get all cache keys
    const pattern = `${CACHE_PREFIX}*`;
    const keys = await kv.keys(pattern);

    if (keys.length === 0) {
      console.log("[MLS Cache] No cache entries to clear");
      return;
    }

    // Delete all cache keys
    for (const key of keys) {
      await kv.del(key);
    }

    console.log(`[MLS Cache] Cleared ${keys.length} cache entries`);
  } catch (error) {
    console.error("[MLS Cache] Error clearing cache:", error);
    throw error;
  }
}
