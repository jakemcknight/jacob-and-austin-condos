import { useEffect } from "react";
import type { Filters, AgentFloorPlan } from "@/lib/agent-floor-plans/types";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface FloorPlanFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  allPlans: AgentFloorPlan[];
  /** Plans filtered by all filters EXCEPT the named key — for dynamic options */
  plansExcluding: {
    bedrooms: AgentFloorPlan[];
    bathrooms: AgentFloorPlan[];
    orientation: AgentFloorPlan[];
  };
}

export default function FloorPlanFilters({
  filters,
  onChange,
  allPlans,
  plansExcluding,
}: FloorPlanFiltersProps) {
  // Buildings always derive from full data set (not dynamically filtered)
  const buildings = Array.from(new Set(allPlans.map((p) => p.building))).sort();

  // Dynamic options derived from plans filtered by everything except this filter
  const bedroomOptions = Array.from(
    new Set(plansExcluding.bedrooms.map((p) => String(p.bedrooms)))
  ).sort((a, b) => Number(a) - Number(b));

  const bathroomOptions = Array.from(
    new Set(plansExcluding.bathrooms.map((p) => String(p.bathrooms)))
  ).sort((a, b) => Number(a) - Number(b));

  const orientationOptions = Array.from(
    new Set(
      plansExcluding.orientation.flatMap((p) =>
        p.orientation
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      )
    )
  ).sort();

  const update = (key: keyof Filters, value: string | string[]) => {
    onChange({ ...filters, [key]: value });
  };

  // Auto-clear selected values that disappeared from available options
  useEffect(() => {
    const validBeds = filters.bedrooms.filter((b) => bedroomOptions.includes(b));
    if (validBeds.length !== filters.bedrooms.length) {
      onChange({ ...filters, bedrooms: validBeds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedroomOptions.join(",")]);

  useEffect(() => {
    const validBaths = filters.bathrooms.filter((b) => bathroomOptions.includes(b));
    if (validBaths.length !== filters.bathrooms.length) {
      onChange({ ...filters, bathrooms: validBaths });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bathroomOptions.join(",")]);

  useEffect(() => {
    const validOrientations = filters.orientation.filter((o) =>
      orientationOptions.includes(o)
    );
    if (validOrientations.length !== filters.orientation.length) {
      onChange({ ...filters, orientation: validOrientations });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientationOptions.join(",")]);

  const clearAll = () => {
    onChange({
      buildings: [],
      bedrooms: [],
      bathrooms: [],
      orientation: [],
      study: "",
      minSqft: "",
      maxSqft: "",
    });
  };

  const hasActiveFilters =
    filters.buildings.length > 0 ||
    filters.bedrooms.length > 0 ||
    filters.bathrooms.length > 0 ||
    filters.orientation.length > 0 ||
    filters.study !== "" ||
    filters.minSqft !== "" ||
    filters.maxSqft !== "";

  const selectClass =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const inputClass =
    "w-24 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MultiSelectDropdown
        options={buildings}
        selected={filters.buildings}
        onChange={(vals) => update("buildings", vals)}
        allLabel="All Buildings"
        countLabel="Buildings"
        widthClass="w-64"
      />

      <MultiSelectDropdown
        options={bedroomOptions}
        selected={filters.bedrooms}
        onChange={(vals) => update("bedrooms", vals)}
        allLabel="All Beds"
        countLabel="Beds"
        formatOption={(v) => (v === "0" ? "Studio" : `${v} Bed`)}
      />

      <MultiSelectDropdown
        options={bathroomOptions}
        selected={filters.bathrooms}
        onChange={(vals) => update("bathrooms", vals)}
        allLabel="All Baths"
        countLabel="Baths"
        formatOption={(v) => `${v} Bath`}
      />

      <MultiSelectDropdown
        options={orientationOptions}
        selected={filters.orientation}
        onChange={(vals) => update("orientation", vals)}
        allLabel="All Orientations"
        countLabel="Orientations"
      />

      <select
        value={filters.study}
        onChange={(e) => update("study", e.target.value)}
        className={selectClass}
      >
        <option value="">Study: Any</option>
        <option value="yes">Has Study</option>
        <option value="no">No Study</option>
      </select>

      <input
        type="number"
        placeholder="Min SF"
        value={filters.minSqft}
        onChange={(e) => update("minSqft", e.target.value)}
        className={inputClass}
      />
      <input
        type="number"
        placeholder="Max SF"
        value={filters.maxSqft}
        onChange={(e) => update("maxSqft", e.target.value)}
        className={inputClass}
      />

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="rounded px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
