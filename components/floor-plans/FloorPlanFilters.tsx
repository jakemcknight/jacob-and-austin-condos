import { useState, useRef, useEffect } from "react";
import type { Filters, AgentFloorPlan } from "@/lib/agent-floor-plans/types";

interface FloorPlanFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  allPlans: AgentFloorPlan[];
  /** Plans filtered by everything except orientation — used for dynamic orientation options */
  plansForOrientations: AgentFloorPlan[];
}

export default function FloorPlanFilters({
  filters,
  onChange,
  allPlans,
  plansForOrientations,
}: FloorPlanFiltersProps) {
  const buildings = Array.from(new Set(allPlans.map((p) => p.building))).sort();

  // Orientations derived from plans already filtered by other criteria
  const orientations = Array.from(
    new Set(
      plansForOrientations.flatMap((p) =>
        p.orientation
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      )
    )
  ).sort();

  const bedroomOptions = Array.from(
    new Set(allPlans.map((p) => p.bedrooms))
  ).sort((a, b) => a - b);

  const update = (key: keyof Filters, value: string | string[]) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onChange({
      buildings: [],
      bedrooms: "",
      orientation: "",
      study: "",
      minSqft: "",
      maxSqft: "",
    });
  };

  const hasActiveFilters =
    filters.buildings.length > 0 ||
    filters.bedrooms !== "" ||
    filters.orientation !== "" ||
    filters.study !== "" ||
    filters.minSqft !== "" ||
    filters.maxSqft !== "";

  // Clear orientation if it's no longer available after other filters changed
  useEffect(() => {
    if (filters.orientation && !orientations.includes(filters.orientation)) {
      onChange({ ...filters, orientation: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientations.join(",")]);

  const selectClass =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const inputClass =
    "w-24 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <BuildingMultiSelect
        buildings={buildings}
        selected={filters.buildings}
        onChange={(vals) => update("buildings", vals)}
      />

      <select
        value={filters.bedrooms}
        onChange={(e) => update("bedrooms", e.target.value)}
        className={selectClass}
      >
        <option value="">All Beds</option>
        {bedroomOptions.map((b) => (
          <option key={b} value={String(b)}>
            {b === 0 ? "Studio" : `${b} Bed`}
          </option>
        ))}
      </select>

      <select
        value={filters.orientation}
        onChange={(e) => update("orientation", e.target.value)}
        className={selectClass}
      >
        <option value="">All Orientations</option>
        {orientations.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

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

/** Multi-select dropdown for buildings */
function BuildingMultiSelect({
  buildings,
  selected,
  onChange,
}: {
  buildings: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (building: string) => {
    if (selected.includes(building)) {
      onChange(selected.filter((b) => b !== building));
    } else {
      onChange([...selected, building]);
    }
  };

  const label =
    selected.length === 0
      ? "All Buildings"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} Buildings`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
          selected.length > 0 ? "border-accent" : "border-gray-300"
        }`}
      >
        {label}
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full border-b border-gray-100 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear selection
            </button>
          )}
          {buildings.map((b) => (
            <label
              key={b}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(b)}
                onChange={() => toggle(b)}
                className="rounded border-gray-300 text-accent focus:ring-accent"
              />
              {b}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
