// Fuzzy address matching to match MLS listings to buildings

import { buildings } from "@/data/buildings";
import { levenshteinDistance } from "./string-utils";

interface MatchResult {
  slug: string;
  score: number;
  buildingAddress: string;
  mlsAddress: string;
  matchType: 'name' | 'address';
}

/**
 * Match an MLS listing to a building slug using both building name and address
 * Returns the building slug if match confidence > 75%, otherwise null
 *
 * @param mlsAddress - Street address from MLS (e.g., "70 Rainey St")
 * @param buildingName - Building name from MLS (e.g., "70 Rainey")
 */
export function matchListingToBuilding(mlsAddress: string, buildingName?: string): string | null {
  const normalizedAddr = normalizeAddress(mlsAddress);
  const normalizedName = buildingName ? normalizeAddress(buildingName) : "";

  let bestMatch: MatchResult | null = null;
  let allMatches: { building: string; score: number; matchType: string }[] = [];

  for (const building of buildings) {
    let bestScore = 0;
    let matchType: 'name' | 'address' = 'address';

    // Try matching by building name first (if provided)
    if (buildingName && normalizedName) {
      const buildingNameNorm = normalizeAddress(building.name);
      const nameDistance = levenshteinDistance(normalizedName, buildingNameNorm);
      const nameMaxLen = Math.max(normalizedName.length, buildingNameNorm.length);
      const nameSimilarity = nameMaxLen > 0 ? 1 - nameDistance / nameMaxLen : 0;

      if (nameSimilarity > bestScore) {
        bestScore = nameSimilarity;
        matchType = 'name';
      }
    }

    // Try matching by address
    const buildingAddr = normalizeAddress(building.address);
    const addrDistance = levenshteinDistance(normalizedAddr, buildingAddr);
    const addrMaxLen = Math.max(normalizedAddr.length, buildingAddr.length);
    const addrSimilarity = addrMaxLen > 0 ? 1 - addrDistance / addrMaxLen : 0;

    if (addrSimilarity > bestScore) {
      bestScore = addrSimilarity;
      matchType = 'address';
    }

    // Log matching attempts for Rainey Street addresses
    if (mlsAddress.toLowerCase().includes('rainey') || (buildingName && buildingName.toLowerCase().includes('rainey'))) {
      allMatches.push({
        building: building.name,
        score: bestScore,
        matchType
      });
    }

    // Lowered threshold from 85% to 75% to catch more matches
    if (bestScore > 0.75 && (!bestMatch || bestScore > bestMatch.score)) {
      bestMatch = {
        slug: building.slug,
        score: bestScore,
        buildingAddress: building.address,
        mlsAddress,
        matchType
      };
    }
  }

  // Detailed logging for Rainey Street addresses
  if (mlsAddress.toLowerCase().includes('rainey') || (buildingName && buildingName.toLowerCase().includes('rainey'))) {
    console.log(`[Address Matcher] Rainey Street listing:`);
    console.log(`[Address Matcher]   MLS Address: "${mlsAddress}" → normalized: "${normalizedAddr}"`);
    if (buildingName) {
      console.log(`[Address Matcher]   Building Name: "${buildingName}" → normalized: "${normalizedName}"`);
    }
    console.log(`[Address Matcher]   Best match: ${bestMatch ? `${bestMatch.buildingAddress} (${(bestMatch.score * 100).toFixed(1)}% via ${bestMatch.matchType})` : 'NONE'}`);

    // Show top 3 matches for debugging
    const top3 = allMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => `${m.building} via ${m.matchType} (${(m.score * 100).toFixed(1)}%)`)
      .join(', ');
    console.log(`[Address Matcher]   Top 3: ${top3}`);
  }

  // Log unmatched addresses for manual review
  if (!bestMatch) {
    logUnmatchedAddress(mlsAddress, normalizedAddr, buildingName);
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
function logUnmatchedAddress(mlsAddress: string, normalized: string, buildingName?: string): void {
  // In serverless environment, just log to console (no file system access)
  if (buildingName) {
    console.warn(`[Address Matcher] UNMATCHED: address="${mlsAddress}", building="${buildingName}"`);
  } else {
    console.warn(`[Address Matcher] UNMATCHED: address="${mlsAddress}" (no building name)`);
  }
}

/**
 * Get all matched listings for a specific building
 */
export function getListingsForBuilding(
  allListings: any[],
  buildingSlug: string
): any[] {
  return allListings.filter(listing => {
    const matchedSlug = matchListingToBuilding(listing.address, listing.buildingName);
    return matchedSlug === buildingSlug;
  });
}
