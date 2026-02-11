/**
 * Floor Plan Lookup Utilities
 *
 * Centralized functions for retrieving floor plan data
 */

import { floorPlans, FloorPlan } from "@/data/floorPlans";

/**
 * Get all floor plans for a specific building
 *
 * @param buildingSlug - The building slug (e.g., "the-independent")
 * @returns Array of floor plans for the building, or empty array if not found
 */
export function getBuildingFloorPlans(buildingSlug: string): FloorPlan[] {
  return floorPlans[buildingSlug] || [];
}

/**
 * Get a specific floor plan by building and floor plan slug
 *
 * @param buildingSlug - The building slug
 * @param floorPlanSlug - The floor plan slug (e.g., "a1-1br-697sf-floorplan")
 * @returns The floor plan object, or undefined if not found
 */
export function getFloorPlanBySlug(
  buildingSlug: string,
  floorPlanSlug: string
): FloorPlan | undefined {
  const buildingFloorPlans = getBuildingFloorPlans(buildingSlug);
  return buildingFloorPlans.find((fp) => fp.slug === floorPlanSlug);
}

/**
 * Get all floor plan params for static generation
 * Used by Next.js generateStaticParams() for pre-rendering floor plan pages
 *
 * @returns Array of { slug, floorplan } param objects
 */
export function getAllFloorPlanParams(): Array<{
  slug: string;
  floorplan: string;
}> {
  const params: { slug: string; floorplan: string }[] = [];

  for (const [buildingSlug, buildingFloorPlans] of Object.entries(
    floorPlans
  )) {
    for (const fp of buildingFloorPlans) {
      params.push({
        slug: buildingSlug,
        floorplan: fp.slug,
      });
    }
  }

  return params;
}

/**
 * Get floor plans grouped by bedroom count
 * Useful for displaying floor plans in categorized sections
 *
 * @param buildingSlug - The building slug
 * @returns Map of bedroom count to floor plans
 */
export function getFloorPlansByBedrooms(buildingSlug: string): Map<
  number,
  FloorPlan[]
> {
  const buildingFloorPlans = getBuildingFloorPlans(buildingSlug);
  const grouped = new Map<number, FloorPlan[]>();

  for (const fp of buildingFloorPlans) {
    if (!grouped.has(fp.bedrooms)) {
      grouped.set(fp.bedrooms, []);
    }
    grouped.get(fp.bedrooms)!.push(fp);
  }

  return grouped;
}

/**
 * Get floor plan statistics for a building
 *
 * @param buildingSlug - The building slug
 * @returns Statistics about floor plans
 */
export function getFloorPlanStats(buildingSlug: string): {
  total: number;
  minSqft: number;
  maxSqft: number;
  avgSqft: number;
  bedroomCounts: number[];
} {
  const buildingFloorPlans = getBuildingFloorPlans(buildingSlug);

  if (buildingFloorPlans.length === 0) {
    return {
      total: 0,
      minSqft: 0,
      maxSqft: 0,
      avgSqft: 0,
      bedroomCounts: [],
    };
  }

  const sqfts = buildingFloorPlans.map((fp) => fp.sqft);
  const bedroomCounts = Array.from(
    new Set(buildingFloorPlans.map((fp) => fp.bedrooms))
  ).sort();

  return {
    total: buildingFloorPlans.length,
    minSqft: Math.min(...sqfts),
    maxSqft: Math.max(...sqfts),
    avgSqft: Math.round(sqfts.reduce((a, b) => a + b, 0) / sqfts.length),
    bedroomCounts,
  };
}
