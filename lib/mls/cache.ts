// JSON file cache utilities for MLS data

import fs from "fs";
import path from "path";
import { MLSListing, CachedMlsData } from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "mls-cache");

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Read MLS cache for a specific building
 */
export async function readMlsCache(slug: string): Promise<CachedMlsData | null> {
  try {
    ensureCacheDir();
    const cachePath = path.join(CACHE_DIR, `${slug}.json`);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const content = fs.readFileSync(cachePath, "utf-8");
    const cached: CachedMlsData = JSON.parse(content);

    return cached;
  } catch (error) {
    console.error(`[MLS Cache] Error reading cache for ${slug}:`, error);
    return null;
  }
}

/**
 * Write MLS cache for a specific building (replaces existing cache)
 */
export async function writeMlsCache(slug: string, data: MLSListing[]): Promise<void> {
  try {
    ensureCacheDir();
    const cachePath = path.join(CACHE_DIR, `${slug}.json`);

    const cached: CachedMlsData = {
      timestamp: Date.now(),
      data,
    };

    fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2));
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
    ensureCacheDir();

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
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);

    for (const file of files) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }

    console.log(`[MLS Cache] Cleared ${files.length} cache files`);
  } catch (error) {
    console.error("[MLS Cache] Error clearing cache:", error);
    throw error;
  }
}
