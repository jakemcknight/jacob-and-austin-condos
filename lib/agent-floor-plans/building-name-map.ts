/**
 * Maps CSV building names to website slugs.
 * Extracted from scripts/process-floorplan-data.mjs MANUAL_BUILDING_MAP
 * plus fuzzy-matched entries that resolve at >=80% similarity.
 */
export const BUILDING_NAME_TO_SLUG: Record<string, string> = {
  "360 Condos": "360-condominiums",
  "44 East": "44-east",
  "5th & West": "5th-and-west",
  "70 Rainey": "70-rainey",
  "Austin City Lofts": "austin-city-lofts",
  "Austin Proper": "austin-proper-residences",
  "Four Seasons": "four-seasons-residences",
  "Milago": "milago",
  "Natiivo": "natiivo",
  "Sabine on 5th": "sabine-on-5th",
  "Seaholm Residences": "seaholm-residences",
  "Spring Condos": "spring-condominiums",
  "The Austonian": "the-austonian",
  "The Independent": "the-independent",
  "The Linden": "the-linden",
  "The Modern": "the-modern-austin",
  "The Shore": "the-shore-condominiums",
  "Vesper": "vesper",
  "W Residences": "the-w-residences",
};
