import fs from "fs";
import path from "path";
import { BUILDING_NAME_TO_SLUG } from "./building-name-map";
import type { AgentFloorPlan } from "./types";

/**
 * Parse a single CSV line handling quoted values with commas inside
 */
function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

/**
 * Create a floor plan slug matching the format used on the public site.
 * Must match scripts/process-floorplan-data.mjs createFloorPlanSlug.
 */
function createFloorPlanSlug(
  floorPlanName: string,
  bedrooms: number,
  sqft: number
): string {
  const name = floorPlanName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${name}-${bedrooms}br-${sqft}sf-floorplan`;
}

/**
 * Parse the Dashboard CSV and return typed AgentFloorPlan array.
 * Reads the file synchronously — the CSV is ~430 lines so it's instant.
 */
export function parseFloorPlanCSV(): AgentFloorPlan[] {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "Downtown Floor Plans - All Floor Plans - Dashboard.csv"
  );
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  const plans: AgentFloorPlan[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line);
    const [
      building,
      bed,
      bath,
      study,
      floorPlan,
      _url,
      _viewer,
      sf,
      orientation,
      unitNumbers,
      quantity,
    ] = values;

    const buildingSlug = BUILDING_NAME_TO_SLUG[building];
    if (!buildingSlug) continue; // skip unmapped buildings
    if (!floorPlan) continue; // skip rows with no floor plan name

    const bedrooms = parseInt(bed) || 0;
    const sqft = parseInt(sf.replace(/,/g, "")) || 0;
    const floorPlanSlug = createFloorPlanSlug(floorPlan, bedrooms, sqft);

    plans.push({
      building,
      buildingSlug,
      floorPlan,
      floorPlanSlug,
      bedrooms,
      bathrooms: parseFloat(bath) || 0,
      hasStudy: study?.toUpperCase() === "TRUE",
      sqft,
      orientation: orientation || "",
      unitNumbers: unitNumbers || "",
      quantity: parseInt(quantity) || 0,
      websiteUrl: `/downtown-condos/${buildingSlug}/${floorPlanSlug}`,
    });
  }

  return plans;
}
