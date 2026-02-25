"use client";

import { useState, useMemo } from "react";
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

export default function AgentPortal({ allPlans }: AgentPortalProps) {
  const [filters, setFilters] = useState<Filters>({
    buildings: [],
    bedrooms: "",
    orientation: "",
    study: "",
    minSqft: "",
    maxSqft: "",
  });

  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);

  /** Apply all filters except orientation — used to derive dynamic orientation options */
  const plansForOrientations = useMemo(() => {
    return allPlans.filter((p) => {
      if (filters.buildings.length > 0 && !filters.buildings.includes(p.building))
        return false;
      if (filters.bedrooms && p.bedrooms !== parseInt(filters.bedrooms))
        return false;
      if (filters.study === "yes" && !p.hasStudy) return false;
      if (filters.study === "no" && p.hasStudy) return false;
      if (filters.minSqft && p.sqft < parseInt(filters.minSqft)) return false;
      if (filters.maxSqft && p.sqft > parseInt(filters.maxSqft)) return false;
      return true;
    });
  }, [allPlans, filters.buildings, filters.bedrooms, filters.study, filters.minSqft, filters.maxSqft]);

  /** Fully filtered plans */
  const filteredPlans = useMemo(() => {
    return plansForOrientations.filter((p) => {
      if (
        filters.orientation &&
        !p.orientation
          .split(",")
          .map((o) => o.trim())
          .includes(filters.orientation)
      )
        return false;
      return true;
    });
  }, [plansForOrientations, filters.orientation]);

  const buildingCount = new Set(filteredPlans.map((p) => p.building)).size;
  const studyCount = filteredPlans.filter((p) => p.hasStudy).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Floor Plan Portal
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {filteredPlans.length} floor plan{filteredPlans.length !== 1 ? "s" : ""}{" "}
          across {buildingCount} building{buildingCount !== 1 ? "s" : ""}
          {studyCount > 0 && (
            <span>
              {" "}
              &middot; {studyCount} with stud{studyCount !== 1 ? "ies" : "y"}
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
          plansForOrientations={plansForOrientations}
        />
      </div>

      {/* Copy controls */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <CopyControls
          columns={columns}
          onColumnsChange={setColumns}
          filteredPlans={filteredPlans}
        />
      </div>

      {/* Table */}
      <FloorPlanTable plans={filteredPlans} columns={columns} />
    </div>
  );
}
