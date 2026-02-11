// Fuzzy address matching to match MLS listings to buildings

import { buildings } from "@/data/buildings";
import { levenshteinDistance } from "./string-utils";
import fs from "fs";
import path from "path";

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

  for (const building of buildings) {
    const buildingAddr = normalizeAddress(building.address);
    const distance = levenshteinDistance(normalized, buildingAddr);
    const maxLen = Math.max(normalized.length, buildingAddr.length);
    const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

    if (similarity > 0.85 && (!bestMatch || similarity > bestMatch.score)) {
      bestMatch = {
        slug: building.slug,
        score: similarity,
        buildingAddress: building.address,
        mlsAddress,
      };
    }
  }

  // Log unmatched addresses for manual review
  if (!bestMatch) {
    logUnmatchedAddress(mlsAddress);
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
 * Log unmatched addresses to a file for manual review
 */
function logUnmatchedAddress(mlsAddress: string): void {
  try {
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "unmatched-mls-listings.json");

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Read existing log or create new
    let log: { timestamp: string; address: string }[] = [];
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf-8");
      log = JSON.parse(content);
    }

    // Check if address already logged
    const alreadyLogged = log.some(entry => entry.address === mlsAddress);
    if (!alreadyLogged) {
      log.push({
        timestamp: new Date().toISOString(),
        address: mlsAddress,
      });

      // Write back to file
      fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
      console.log(`[Address Matcher] Logged unmatched address: ${mlsAddress}`);
    }
  } catch (error) {
    console.error("[Address Matcher] Error logging unmatched address:", error);
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
    const matchedSlug = matchListingToBuilding(listing.address);
    return matchedSlug === buildingSlug;
  });
}
