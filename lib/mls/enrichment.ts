// Enrichment layer for floor plan and orientation data
// Maps {building, unit} → {floorPlan, orientation}
// Data comes from a Google Sheet CSV maintained by the user

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import {
  AnalyticsListing,
  BuildingEnrichmentMap,
  AllEnrichmentMaps,
  EnrichmentEntry,
} from "./analytics-types";

const ENRICHMENT_PREFIX = "mls:enrichment:";

function getEnrichmentKey(buildingSlug: string): string {
  return `${ENRICHMENT_PREFIX}${buildingSlug}`;
}

/**
 * Read enrichment map for a single building.
 * Returns Record<unitNumber, { floorPlan, orientation }> or empty object.
 */
export async function readEnrichmentMap(
  buildingSlug: string
): Promise<BuildingEnrichmentMap> {
  noStore();
  try {
    const data = await kv.get<BuildingEnrichmentMap>(
      getEnrichmentKey(buildingSlug)
    );
    return data || {};
  } catch (error) {
    console.error(
      `[Enrichment] Error reading map for ${buildingSlug}:`,
      error
    );
    return {};
  }
}

/**
 * Write enrichment map for a single building.
 * Merges with existing data (doesn't overwrite units already mapped).
 */
export async function writeEnrichmentMap(
  buildingSlug: string,
  map: BuildingEnrichmentMap
): Promise<void> {
  try {
    await kv.set(getEnrichmentKey(buildingSlug), map);
    console.log(
      `[Enrichment] Wrote ${Object.keys(map).length} unit mappings for ${buildingSlug}`
    );
  } catch (error) {
    console.error(
      `[Enrichment] Error writing map for ${buildingSlug}:`,
      error
    );
    throw error;
  }
}

/**
 * Merge new enrichment data into existing map for a building.
 * New data overwrites existing entries for the same unit.
 */
export async function mergeEnrichmentMap(
  buildingSlug: string,
  newEntries: BuildingEnrichmentMap
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await readEnrichmentMap(buildingSlug);

  let added = 0;
  let updated = 0;

  for (const [unit, entry] of Object.entries(newEntries)) {
    if (existing[unit]) {
      updated++;
    } else {
      added++;
    }
    existing[unit] = entry;
  }

  await writeEnrichmentMap(buildingSlug, existing);

  return { added, updated, total: Object.keys(existing).length };
}

/**
 * Read enrichment maps for all buildings that have data.
 * Returns Record<buildingSlug, Record<unitNumber, { floorPlan, orientation }>>
 */
export async function readAllEnrichmentMaps(): Promise<AllEnrichmentMaps> {
  noStore();
  try {
    const keys = await kv.keys(`${ENRICHMENT_PREFIX}*`);
    const maps: AllEnrichmentMaps = {};

    for (const key of keys) {
      const slug = key.replace(ENRICHMENT_PREFIX, "");
      const data = await kv.get<BuildingEnrichmentMap>(key);
      if (data && Object.keys(data).length > 0) {
        maps[slug] = data;
      }
    }

    return maps;
  } catch (error) {
    console.error("[Enrichment] Error reading all maps:", error);
    return {};
  }
}

/**
 * Get enrichment coverage stats across all buildings.
 */
export async function getEnrichmentStats(): Promise<{
  buildingsMapped: number;
  totalUnits: number;
  buildingDetails: Array<{ slug: string; unitCount: number }>;
}> {
  const maps = await readAllEnrichmentMaps();
  const buildingDetails: Array<{ slug: string; unitCount: number }> = [];
  let totalUnits = 0;

  for (const [slug, map] of Object.entries(maps)) {
    const unitCount = Object.keys(map).length;
    buildingDetails.push({ slug, unitCount });
    totalUnits += unitCount;
  }

  return {
    buildingsMapped: buildingDetails.length,
    totalUnits,
    buildingDetails,
  };
}

/**
 * Enrich a single analytics listing with floor plan and orientation data.
 * Returns the listing with floorPlan and orientation populated if a match is found.
 */
export function enrichListing(
  listing: AnalyticsListing,
  enrichmentMaps: AllEnrichmentMaps
): AnalyticsListing {
  if (!listing.buildingSlug || !listing.unitNumber) {
    return listing;
  }

  const buildingMap = enrichmentMaps[listing.buildingSlug];
  if (!buildingMap) {
    return listing;
  }

  // Try exact match first
  let entry = buildingMap[listing.unitNumber];

  // Try normalized unit number (strip leading zeros, common variations)
  if (!entry) {
    const normalized = normalizeUnit(listing.unitNumber);
    entry = buildingMap[normalized];

    // Also try matching against normalized versions of the map keys
    if (!entry) {
      for (const [mapUnit, mapEntry] of Object.entries(buildingMap)) {
        if (normalizeUnit(mapUnit) === normalized) {
          entry = mapEntry;
          break;
        }
      }
    }
  }

  if (entry) {
    return {
      ...listing,
      floorPlan: entry.floorPlan || listing.floorPlan,
      orientation: entry.orientation || listing.orientation,
    };
  }

  return listing;
}

/**
 * Enrich multiple analytics listings.
 */
export function enrichListings(
  listings: AnalyticsListing[],
  enrichmentMaps: AllEnrichmentMaps
): AnalyticsListing[] {
  return listings.map((listing) => enrichListing(listing, enrichmentMaps));
}

/**
 * Normalize unit number for fuzzy matching.
 * Strips leading zeros, removes common prefixes like '#', trims whitespace.
 */
function normalizeUnit(unit: string): string {
  return unit
    .trim()
    .replace(/^#/, "")
    .replace(/^0+/, "")
    .toUpperCase();
}
