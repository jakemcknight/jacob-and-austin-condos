import type { Filters, AgentFloorPlan } from "@/lib/agent-floor-plans/types";

interface FloorPlanFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  allPlans: AgentFloorPlan[];
}

export default function FloorPlanFilters({
  filters,
  onChange,
  allPlans,
}: FloorPlanFiltersProps) {
  const buildings = Array.from(new Set(allPlans.map((p) => p.building))).sort();

  // Extract unique individual orientation codes from all plans
  const orientations = Array.from(
    new Set(
      allPlans.flatMap((p) =>
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

  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onChange({
      building: "",
      bedrooms: "",
      orientation: "",
      study: "",
      minSqft: "",
      maxSqft: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  const selectClass =
    "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const inputClass =
    "w-24 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={filters.building}
        onChange={(e) => update("building", e.target.value)}
        className={selectClass}
      >
        <option value="">All Buildings</option>
        {buildings.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

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
