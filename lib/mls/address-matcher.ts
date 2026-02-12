// Fuzzy address matching to match MLS listings to buildings

import { buildings } from "@/data/buildings";
import { levenshteinDistance } from "./string-utils";

interface MatchResult {
  slug: string;
  score: number;
  buildingAddress: string;
  mlsAddress: string;
}

/**
 * Match an MLS listing address to a building slug
 * Returns the building slug if match confidence > 85%, otherwise null
 */
export function matchListingToBuilding(mlsAddress: string): string | null {
  const normalized = normalizeAddress(mlsAddress);

  let bestMatch: MatchResult | null = null;
  let allMatches: { building: string; score: number; normalized: string }[] = [];

  for (const building of buildings) {
    const buildingAddr = normalizeAddress(building.address);
    const distance = levenshteinDistance(normalized, buildingAddr);
    const maxLen = Math.max(normalized.length, buildingAddr.length);
    const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

    // Log matching attempts for Rainey Street addresses
    if (mlsAddress.toLowerCase().includes('rainey')) {
      allMatches.push({
        building: building.address,
        score: similarity,
        normalized: buildingAddr
      });
    }

    if (similarity > 0.85 && (!bestMatch || similarity > bestMatch.score)) {
      bestMatch = {
        slug: building.slug,
        score: similarity,
        buildingAddress: building.address,
        mlsAddress,
      };
    }
  }

  // Detailed logging for Rainey Street addresses
  if (mlsAddress.toLowerCase().includes('rainey')) {
    console.log(`[Address Matcher] Rainey Street listing: "${mlsAddress}"`);
    console.log(`[Address Matcher] Normalized: "${normalized}"`);
    console.log(`[Address Matcher] Best match: ${bestMatch ? `${bestMatch.buildingAddress} (${(bestMatch.score * 100).toFixed(1)}%)` : 'NONE'}`);

    // Show top 3 matches for debugging
    const top3 = allMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => `${m.building} → "${m.normalized}" (${(m.score * 100).toFixed(1)}%)`)
      .join(', ');
    console.log(`[Address Matcher] Top matches: ${top3}`);
  }

  // Log unmatched addresses for manual review
  if (!bestMatch) {
    logUnmatchedAddress(mlsAddress, normalized);
  }

  return bestMatch?.slug || null;
}

/**
 * Normalize an address for comparison
 * Removes common suffixes, special characters, and standardizes formatting
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    // Remove common street suffixes
    .replace(/\b(avenue|ave|street|st|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|place|pl|way)\b/gi, "")
    // Remove directional indicators
    .replace(/\b(north|south|east|west|n|s|e|w|ne|nw|se|sw)\b/gi, "")
    // Remove unit indicators
    .replace(/\b(unit|apt|apartment|#|number|no|ste|suite)\b/gi, "")
    // Remove special characters
    .replace(/[^\w\s]/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Log unmatched addresses for manual review (console only in serverless environment)
 */
function logUnmatchedAddress(mlsAddress: string, normalized: string): void {
  // In serverless environment, just log to console (no file system access)
  console.warn(`[Address Matcher] UNMATCHED ADDRESS: "${mlsAddress}" → normalized: "${normalized}"`);
}

/**
 * Get all matched listings for a specific building
 */
export function getListingsForBuilding(
  allListings: any[],
  buildingSlug: string
): any[] {
  return allListings.filter(listing => {
    const matchedSlug = matchListingToBuilding(listing.address);
    return matchedSlug === buildingSlug;
  });
}
