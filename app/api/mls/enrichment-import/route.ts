// Enrichment CSV Import Endpoint
// Accepts a CSV mapping {building, unit} → {floorPlan, orientation}

import { NextRequest, NextResponse } from "next/server";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import { buildings } from "@/data/buildings";
import {
  mergeEnrichmentMap,
  getEnrichmentStats,
} from "@/lib/mls/enrichment";
import { BuildingEnrichmentMap } from "@/lib/mls/analytics-types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const csvText: string = body.csvText;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { error: "Missing csvText in request body" },
        { status: 400 }
      );
    }

    // Parse CSV
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Detect columns
    const headers = Object.keys(rows[0]);
    const buildingCol = findColumn(headers, [
      "Building",
      "Building Name",
      "BuildingName",
      "Subdivision",
    ]);
    const unitCol = findColumn(headers, [
      "Unit",
      "Unit Number",
      "UnitNumber",
      "Unit #",
    ]);
    const floorPlanCol = findColumn(headers, [
      "Floor Plan",
      "FloorPlan",
      "Plan",
      "Floor Plan Name",
    ]);
    const orientationCol = findColumn(headers, [
      "Orientation",
      "Direction",
      "View",
      "Facing",
    ]);

    if (!buildingCol || !unitCol) {
      return NextResponse.json(
        {
          error: "Could not detect required columns. Need: Building and Unit columns.",
          detectedHeaders: headers,
        },
        { status: 400 }
      );
    }

    // Group entries by building
    const byBuilding = new Map<string, BuildingEnrichmentMap>();
    let unmatchedBuildings = 0;
    let totalEntries = 0;
    const unmatchedNames: string[] = [];

    for (const row of rows) {
      const rawBuildingName = row[buildingCol]?.trim();
      const unit = row[unitCol]?.trim();
      const floorPlan = floorPlanCol ? row[floorPlanCol]?.trim() || "" : "";
      const orientation = orientationCol
        ? row[orientationCol]?.trim() || ""
        : "";

      if (!rawBuildingName || !unit) continue;
      if (!floorPlan && !orientation) continue; // Skip if no enrichment data

      // Match building name to slug
      let buildingSlug: string | null = null;

      // Try exact match first
      const exactMatch = buildings.find(
        (b) =>
          b.name.toLowerCase() === rawBuildingName.toLowerCase() ||
          b.slug === rawBuildingName.toLowerCase().replace(/\s+/g, "-")
      );

      if (exactMatch) {
        buildingSlug = exactMatch.slug;
      } else {
        // Fallback to address matcher
        buildingSlug = matchListingToBuilding(rawBuildingName, rawBuildingName);
      }

      if (!buildingSlug) {
        unmatchedBuildings++;
        if (!unmatchedNames.includes(rawBuildingName)) {
          unmatchedNames.push(rawBuildingName);
        }
        continue;
      }

      if (!byBuilding.has(buildingSlug)) {
        byBuilding.set(buildingSlug, {});
      }
      byBuilding.get(buildingSlug)![unit] = { floorPlan, orientation };
      totalEntries++;
    }

    // Merge into KV
    let totalAdded = 0;
    let totalUpdated = 0;

    for (const [slug, entries] of Array.from(byBuilding)) {
      const result = await mergeEnrichmentMap(slug, entries);
      totalAdded += result.added;
      totalUpdated += result.updated;
    }

    // Get updated stats
    const stats = await getEnrichmentStats();

    return NextResponse.json({
      success: true,
      totalEntries,
      buildingsMatched: byBuilding.size,
      unmatchedBuildingNames: unmatchedNames,
      added: totalAdded,
      updated: totalUpdated,
      enrichmentStats: stats,
    });
  } catch (error) {
    console.error("[Enrichment Import] Error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Also support GET to retrieve current enrichment stats
export async function GET() {
  try {
    const stats = await getEnrichmentStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read enrichment stats" },
      { status: 500 }
    );
  }
}

// --- CSV Parsing ---

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    results.push(row);
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function findColumn(
  headers: string[],
  aliases: string[]
): string | null {
  for (const alias of aliases) {
    const match = headers.find(
      (h) => h.trim().toLowerCase() === alias.toLowerCase()
    );
    if (match) return match;
  }
  return null;
}
