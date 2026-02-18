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

  // If fuzzy matching failed, try exact street number matching as fallback
  // This catches cases like "40 Interstate 35" → "40 N IH 35" where normalization
  // differs but the street number is unique enough to identify the building
  if (!bestMatch) {
    const mlsStreetNum = extractStreetNumber(mlsAddress);
    if (mlsStreetNum) {
      for (const building of buildings) {
        const buildingStreetNum = extractStreetNumber(building.address);
        if (buildingStreetNum && mlsStreetNum === buildingStreetNum) {
          // Verify the street names share at least some similarity
          const mlsStreet = normalizeAddress(mlsAddress).replace(/^\d+\s*/, '');
          const buildingStreet = normalizeAddress(building.address).replace(/^\d+\s*/, '');
          // Accept only if streets share a common word (e.g., "ih"/"35" for Interstate 35)
          if (streetsShareWord(mlsStreet, buildingStreet)) {
            bestMatch = {
              slug: building.slug,
              score: 0.76,
              buildingAddress: building.address,
              mlsAddress,
              matchType: 'address',
            };
            break;
          }
        }
      }
    }
  }

  // Log unmatched addresses for manual review
  if (!bestMatch) {
    logUnmatchedAddress(mlsAddress, normalizedAddr, buildingName);
  }

  return bestMatch?.slug || null;
}

function extractStreetNumber(addr: string): string | null {
  const match = addr.match(/^(\d+)/);
  return match ? match[1] : null;
}

function streetsShareWord(a: string, b: string): boolean {
  const wordsA = a.split(/\s+/).filter(w => w.length > 1);
  const wordsB = b.split(/\s+/).filter(w => w.length > 1);
  return wordsA.some(w => wordsB.includes(w));
}

/**
 * Normalize an address for comparison
 * Removes common suffixes, special characters, and standardizes formatting
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    // Normalize interstate highway variations to "ih"
    .replace(/\b(interstate\s+highway|interstate\s+hwy|interstate)\b/gi, "ih")
    // Remove common street suffixes
    .replace(/\b(avenue|ave|street|st|road|rd|drive|dr|boulevard|blvd|lane|ln|court|ct|place|pl|way)\b/gi, "")
    // Remove directional PREFIX after street number (e.g., "48 E East" → "48 East", "100 N Lamar" → "100 Lamar")
    // Only strip 1-2 letter abbreviations (n/s/e/w/ne/nw/se/sw) right after a number
    .replace(/^(\d+)\s+\b(ne|nw|se|sw|n|s|e|w)\b/gi, "$1")
    // Remove unit indicators and everything after them (unit numbers leak into addresses)
    .replace(/\b(unit|apt|apartment|#|number|no|ste|suite)\b.*/gi, "")
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
