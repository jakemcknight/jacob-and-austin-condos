"use client";

import { useState, useRef, useEffect } from "react";
import FilterDropdown from "./FilterDropdown";
import { buildings } from "@/data/buildings";

type SortOption = "price" | "priceSf" | "dom" | "date";

export interface FilterState {
  listingTypeFilter: "Sale" | "Lease";
  bedroomFilters: number[];
  selectedBuildings: string[];
  priceMin: string;
  priceMax: string;
  sqftMin: string;
  sqftMax: string;
  sortBy: SortOption;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  viewMode: "list" | "map";
  onViewModeChange: (mode: "list" | "map") => void;
  resultCount: number;
  totalCount: number;
}

// Format price for display in active label
function formatPriceShort(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

const sortedBuildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name));

export default function FilterBar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const [buildingSearch, setBuildingSearch] = useState("");

  const update = (partial: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const toggleBedroom = (bed: number) => {
    const next = filters.bedroomFilters.includes(bed)
      ? filters.bedroomFilters.filter(b => b !== bed)
      : [...filters.bedroomFilters, bed];
    update({ bedroomFilters: next });
  };

  const toggleBuilding = (slug: string) => {
    const next = filters.selectedBuildings.includes(slug)
      ? filters.selectedBuildings.filter(s => s !== slug)
      : [...filters.selectedBuildings, slug];
    update({ selectedBuildings: next });
  };

  // Active filter counts
  const activeFilterCount =
    filters.bedroomFilters.length +
    filters.selectedBuildings.length +
    (filters.priceMin ? 1 : 0) +
    (filters.priceMax ? 1 : 0) +
    (filters.sqftMin ? 1 : 0) +
    (filters.sqftMax ? 1 : 0);

  const moreCount =
    (filters.sqftMin ? 1 : 0) +
    (filters.sqftMax ? 1 : 0);

  // Active labels
  const saleLabel = filters.listingTypeFilter === "Lease" ? "For Lease" : "For Sale";

  let priceLabel: string | undefined;
  if (filters.priceMin && filters.priceMax) {
    priceLabel = `${formatPriceShort(filters.priceMin)}–${formatPriceShort(filters.priceMax)}`;
  } else if (filters.priceMin) {
    priceLabel = `${formatPriceShort(filters.priceMin)}+`;
  } else if (filters.priceMax) {
    priceLabel = `Up to ${formatPriceShort(filters.priceMax)}`;
  }

  let bedsLabel: string | undefined;
  if (filters.bedroomFilters.length > 0) {
    const labels = filters.bedroomFilters
      .sort((a, b) => a - b)
      .map(b => (b === 0 ? "Studio" : b === 3 ? "3+" : `${b}`));
    bedsLabel = labels.join(", ") + " BR";
  }

  let buildingLabel: string | undefined;
  if (filters.selectedBuildings.length > 0) {
    buildingLabel = `${filters.selectedBuildings.length} building${filters.selectedBuildings.length > 1 ? "s" : ""}`;
  }

  const filteredBuildings = sortedBuildings.filter(b =>
    b.name.toLowerCase().includes(buildingSearch.toLowerCase())
  );

  return (
    <div className="sticky top-[76px] z-20 border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* For Sale / For Lease */}
          <FilterDropdown
            label="For Sale"
            activeLabel={saleLabel}
            isActive={filters.listingTypeFilter === "Lease"}
            width="w-48"
          >
            <div className="flex gap-2">
              <button
                onClick={() => update({ listingTypeFilter: "Sale" })}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  filters.listingTypeFilter === "Sale"
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                For Sale
              </button>
              <button
                onClick={() => update({ listingTypeFilter: "Lease" })}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  filters.listingTypeFilter === "Lease"
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                For Lease
              </button>
            </div>
          </FilterDropdown>

          {/* Price */}
          <FilterDropdown
            label="Price"
            activeLabel={priceLabel}
            isActive={!!(filters.priceMin || filters.priceMax)}
            width="w-64"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Price Range</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => update({ priceMin: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <span className="text-gray-400">–</span>
                <div className="flex-1">
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => update({ priceMax: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              {(filters.priceMin || filters.priceMax) && (
                <button
                  onClick={() => update({ priceMin: "", priceMax: "" })}
                  className="text-xs font-medium text-accent hover:text-primary"
                >
                  Clear price
                </button>
              )}
            </div>
          </FilterDropdown>

          {/* Beds */}
          <FilterDropdown
            label="Beds"
            activeLabel={bedsLabel}
            isActive={filters.bedroomFilters.length > 0}
            width="w-56"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Bedrooms</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: "Studio" },
                  { value: 1, label: "1 BR" },
                  { value: 2, label: "2 BR" },
                  { value: 3, label: "3+ BR" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleBedroom(value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      filters.bedroomFilters.includes(value)
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-secondary hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filters.bedroomFilters.length > 0 && (
                <button
                  onClick={() => update({ bedroomFilters: [] })}
                  className="text-xs font-medium text-accent hover:text-primary"
                >
                  Clear beds
                </button>
              )}
            </div>
          </FilterDropdown>

          {/* Building */}
          <FilterDropdown
            label="Building"
            activeLabel={buildingLabel}
            isActive={filters.selectedBuildings.length > 0}
            width="w-72"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Building</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => update({ selectedBuildings: sortedBuildings.map(b => b.slug) })}
                    className="text-[10px] font-medium uppercase tracking-wide text-accent hover:text-primary"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => update({ selectedBuildings: [] })}
                    className="text-[10px] font-medium uppercase tracking-wide text-accent hover:text-primary"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Search buildings..."
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <div className="max-h-48 overflow-y-auto">
                {filteredBuildings.map(building => (
                  <label
                    key={building.slug}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={filters.selectedBuildings.includes(building.slug)}
                      onChange={() => toggleBuilding(building.slug)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    {building.name}
                  </label>
                ))}
              </div>
            </div>
          </FilterDropdown>

          {/* More (Sqft + Sort) */}
          <FilterDropdown
            label={moreCount > 0 ? `More +${moreCount}` : "More"}
            isActive={moreCount > 0}
            width="w-72"
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Square Footage</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.sqftMin}
                    onChange={(e) => update({ sqftMin: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.sqftMax}
                    onChange={(e) => update({ sqftMax: e.target.value })}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Sort By</p>
                <select
                  value={filters.sortBy}
                  onChange={(e) => update({ sortBy: e.target.value as SortOption })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="dom">Days on Market</option>
                  <option value="date">List Date</option>
                  <option value="price">Price (High to Low)</option>
                  <option value="priceSf">$/SF (High to Low)</option>
                </select>
              </div>
              {moreCount > 0 && (
                <button
                  onClick={() => update({ sqftMin: "", sqftMax: "" })}
                  className="text-xs font-medium text-accent hover:text-primary"
                >
                  Clear sqft
                </button>
              )}
            </div>
          </FilterDropdown>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => onFiltersChange({
                ...filters,
                bedroomFilters: [],
                selectedBuildings: [],
                priceMin: "",
                priceMax: "",
                sqftMin: "",
                sqftMax: "",
              })}
              className="whitespace-nowrap text-sm font-medium text-accent hover:text-primary"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Results count */}
        <span className="whitespace-nowrap text-xs text-secondary sm:text-sm">
          {resultCount} of {totalCount}
          <span className="hidden sm:inline"> listings</span>
        </span>

        {/* List / Map toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => onViewModeChange("list")}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors sm:px-5 sm:py-2 sm:text-sm ${
              viewMode === "list"
                ? "rounded-md bg-accent text-white"
                : "text-accent hover:text-primary"
            }`}
          >
            List
          </button>
          <button
            onClick={() => onViewModeChange("map")}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors sm:px-5 sm:py-2 sm:text-sm ${
              viewMode === "map"
                ? "rounded-md bg-accent text-white"
                : "text-accent hover:text-primary"
            }`}
          >
            Map
          </button>
        </div>
      </div>

      {/* Selected building chips */}
      {filters.selectedBuildings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {filters.selectedBuildings.map(slug => {
            const building = buildings.find(b => b.slug === slug);
            return (
              <button
                key={slug}
                onClick={() => toggleBuilding(slug)}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20"
              >
                {building?.name || slug}
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
