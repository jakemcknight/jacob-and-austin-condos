"use client";

import { useState, useMemo, useEffect } from "react";
import type {
  AgentFloorPlan,
  Filters,
  ColumnKey,
} from "@/lib/agent-floor-plans/types";
import FloorPlanFilters from "./FloorPlanFilters";
import FloorPlanTable from "./FloorPlanTable";
import CopyControls from "./CopyControls";

interface AgentPortalProps {
  allPlans: AgentFloorPlan[];
}

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  floorPlan: true,
  bedrooms: true,
  bathrooms: true,
  hasStudy: true,
  sqft: true,
  orientation: true,
  unitNumbers: true,
  quantity: true,
};

/** Stable unique key for a floor plan */
export function planKey(plan: AgentFloorPlan): string {
  return `${plan.buildingSlug}::${plan.floorPlanSlug}`;
}

/** Apply all filters, optionally skipping one filter key (for dynamic option derivation) */
function applyFilters(
  plan: AgentFloorPlan,
  filters: Filters,
  skip?: keyof Filters
): boolean {
  if (
    skip !== "buildings" &&
    filters.buildings.length > 0 &&
    !filters.buildings.includes(plan.building)
  )
    return false;
  if (
    skip !== "bedrooms" &&
    filters.bedrooms.length > 0 &&
    !filters.bedrooms.includes(String(plan.bedrooms))
  )
    return false;
  if (
    skip !== "bathrooms" &&
    filters.bathrooms.length > 0 &&
    !filters.bathrooms.includes(String(plan.bathrooms))
  )
    return false;
  if (skip !== "orientation" && filters.orientation.length > 0) {
    const planOrientations = plan.orientation
      .split(",")
      .map((o) => o.trim());
    if (!filters.orientation.some((sel) => planOrientations.includes(sel)))
      return false;
  }
  if (skip !== "study") {
    if (filters.study === "yes" && !plan.hasStudy) return false;
    if (filters.study === "no" && plan.hasStudy) return false;
  }
  if (
    skip !== "minSqft" &&
    filters.minSqft &&
    plan.sqft < parseInt(filters.minSqft)
  )
    return false;
  if (
    skip !== "maxSqft" &&
    filters.maxSqft &&
    plan.sqft > parseInt(filters.maxSqft)
  )
    return false;
  return true;
}

export default function AgentPortal({ allPlans }: AgentPortalProps) {
  const [filters, setFilters] = useState<Filters>({
    buildings: [],
    bedrooms: [],
    bathrooms: [],
    orientation: [],
    study: "",
    minSqft: "",
    maxSqft: "",
  });

  const [columns, setColumns] =
    useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);

  // Hand-selected plan keys for copy
  const [selectedPlanKeys, setSelectedPlanKeys] = useState<Set<string>>(
    new Set()
  );

  // Clear hand-selection when filters change
  useEffect(() => {
    setSelectedPlanKeys(new Set());
  }, [filters]);

  // Plans filtered by all filters except bedrooms/bathrooms/orientation (for dynamic options)
  const plansExcludingBedrooms = useMemo(
    () => allPlans.filter((p) => applyFilters(p, filters, "bedrooms")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPlans, filters.buildings, filters.bathrooms, filters.orientation, filters.study, filters.minSqft, filters.maxSqft]
  );

  const plansExcludingBathrooms = useMemo(
    () => allPlans.filter((p) => applyFilters(p, filters, "bathrooms")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPlans, filters.buildings, filters.bedrooms, filters.orientation, filters.study, filters.minSqft, filters.maxSqft]
  );

  const plansExcludingOrientation = useMemo(
    () => allPlans.filter((p) => applyFilters(p, filters, "orientation")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPlans, filters.buildings, filters.bedrooms, filters.bathrooms, filters.study, filters.minSqft, filters.maxSqft]
  );

  // Fully filtered plans
  const filteredPlans = useMemo(
    () => allPlans.filter((p) => applyFilters(p, filters)),
    [allPlans, filters]
  );

  // Plans to actually copy: selected subset if any, else all filtered
  const plansToCopy = useMemo(() => {
    if (selectedPlanKeys.size === 0) return filteredPlans;
    return filteredPlans.filter((p) => selectedPlanKeys.has(planKey(p)));
  }, [filteredPlans, selectedPlanKeys]);

  const buildingCount = new Set(filteredPlans.map((p) => p.building)).size;
  const studyCount = filteredPlans.filter((p) => p.hasStudy).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Floor Plan Portal</h1>
        <p className="mt-1 text-sm text-gray-500">
          {filteredPlans.length} floor plan
          {filteredPlans.length !== 1 ? "s" : ""} across {buildingCount}{" "}
          building{buildingCount !== 1 ? "s" : ""}
          {studyCount > 0 && (
            <span>
              {" "}
              &middot; {studyCount} with stud
              {studyCount !== 1 ? "ies" : "y"}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <FloorPlanFilters
          filters={filters}
          onChange={setFilters}
          allPlans={allPlans}
          plansExcluding={{
            bedrooms: plansExcludingBedrooms,
            bathrooms: plansExcludingBathrooms,
            orientation: plansExcludingOrientation,
          }}
        />
      </div>

      {/* Copy controls */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <CopyControls
          columns={columns}
          onColumnsChange={setColumns}
          filteredPlans={filteredPlans}
          plansToCopy={plansToCopy}
          selectedCount={selectedPlanKeys.size}
        />
      </div>

      {/* Table */}
      <FloorPlanTable
        plans={filteredPlans}
        columns={columns}
        selectedPlanKeys={selectedPlanKeys}
        onSelectionChange={setSelectedPlanKeys}
        planKeyFn={planKey}
      />
    </div>
  );
}
