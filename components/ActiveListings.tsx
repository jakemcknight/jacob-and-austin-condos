"use client";

import { useState, useEffect, useCallback } from "react";
import { buildings } from "@/data/buildings";
import { formatOrientation } from "@/lib/format-dom";
import FilterDropdown from "./filters/FilterDropdown";
import ListingCard from "./ListingCard";
import type { MLSListingDisplay as MLSListing } from "./ListingCard";
import { useBuildingFilterParams } from "@/lib/use-filter-params";
import type { StatusFilter } from "./filters/FilterBar";

interface ActiveListingsProps {
  buildingSlug: string;
}

type SortOption = "price" | "priceSf" | "dom" | "date";

const sortLabels: Record<SortOption, string> = {
  dom: "Days on Market",
  price: "Price (High to Low)",
  priceSf: "$/SF (High to Low)",
  date: "Newest First",
};

export default function ActiveListings({ buildingSlug }: ActiveListingsProps) {
  const [listings, setListings] = useState<MLSListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get building name for contact link
  const building = buildings.find(b => b.slug === buildingSlug);
  const buildingName = building?.name || "";

  // URL sync
  const { initialFilters, syncToUrl } = useBuildingFilterParams();

  // Filter state — initialized from URL params
  const [listingTypeFilter, setListingTypeFilter] = useState<"Sale" | "Lease">(initialFilters.listingTypeFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilters.statusFilter);
  const [bedroomFilters, setBedroomFilters] = useState<number[]>(initialFilters.bedroomFilters);
  const [priceMin, setPriceMin] = useState<string>(initialFilters.priceMin);
  const [priceMax, setPriceMax] = useState<string>(initialFilters.priceMax);
  const [sqftMin, setSqftMin] = useState<string>(initialFilters.sqftMin);
  const [sqftMax, setSqftMax] = useState<string>(initialFilters.sqftMax);
  const [sortBy, setSortBy] = useState<SortOption>(initialFilters.sortBy);
  const [floorPlanFilters, setFloorPlanFilters] = useState<string[]>(initialFilters.floorPlanFilters);
  const [orientationFilters, setOrientationFilters] = useState<string[]>(initialFilters.orientationFilters);
  const [maxDom, setMaxDom] = useState<number | null>(initialFilters.maxDom);
  const [listedAfter, setListedAfter] = useState<string | null>(initialFilters.listedAfter);
  const [listedBefore, setListedBefore] = useState<string | null>(initialFilters.listedBefore);

  // Sync all filter state to URL
  useEffect(() => {
    syncToUrl({
      listingTypeFilter,
      statusFilter,
      bedroomFilters,
      selectedBuildings: [],
      priceMin,
      priceMax,
      sqftMin,
      sqftMax,
      sortBy,
      floorPlanFilters,
      orientationFilters,
      maxDom,
      listedAfter,
      listedBefore,
    });
  }, [
    listingTypeFilter, statusFilter, bedroomFilters, priceMin, priceMax,
    sqftMin, sqftMax, sortBy, floorPlanFilters, orientationFilters,
    maxDom, listedAfter, listedBefore, syncToUrl,
  ]);

  const fetchListings = useCallback(async (status: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/mls/listings?building=${buildingSlug}&status=${status}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.statusText}`);
      }
      const data = await response.json();
      setListings(data);
    } catch (err) {
      console.error("[ActiveListings] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [buildingSlug]);

  // Fetch on mount and when statusFilter changes
  useEffect(() => {
    fetchListings(statusFilter);
  }, [statusFilter, fetchListings]);

  // Toggle helpers
  const toggleBedroomFilter = (bedrooms: number) => {
    setBedroomFilters(prev =>
      prev.includes(bedrooms) ? prev.filter(b => b !== bedrooms) : [...prev, bedrooms]
    );
  };

  const toggleFloorPlanFilter = (fp: string) => {
    setFloorPlanFilters(prev =>
      prev.includes(fp) ? prev.filter(f => f !== fp) : [...prev, fp]
    );
  };

  const toggleOrientationFilter = (o: string) => {
    setOrientationFilters(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
    );
  };

  const clearFilters = () => {
    setStatusFilter("active");
    setBedroomFilters([]);
    setPriceMin("");
    setPriceMax("");
    setSqftMin("");
    setSqftMax("");
    setFloorPlanFilters([]);
    setOrientationFilters([]);
    setMaxDom(null);
    setListedAfter(null);
    setListedBefore(null);
  };

  // Filter listings
  const filteredListings = listings.filter(listing => {
    if (listing.listingType !== listingTypeFilter) return false;

    if (bedroomFilters.length > 0) {
      const beds = listing.bedroomsTotal;
      const match = bedroomFilters.some(f => f === 3 ? beds >= 3 : beds === f);
      if (!match) return false;
    }

    if (priceMin && listing.listPrice < parseFloat(priceMin)) return false;
    if (priceMax && listing.listPrice > parseFloat(priceMax)) return false;
    if (sqftMin && listing.livingArea < parseFloat(sqftMin)) return false;
    if (sqftMax && listing.livingArea > parseFloat(sqftMax)) return false;

    if (floorPlanFilters.length > 0) {
      if (!listing.floorPlan || !floorPlanFilters.includes(listing.floorPlan)) return false;
    }
    if (orientationFilters.length > 0) {
      if (!listing.orientation || !orientationFilters.includes(listing.orientation)) return false;
    }

    // DOM filter
    if (maxDom !== null && listing.daysOnMarket > maxDom) return false;

    // Date range filters
    if (listedAfter && listing.listDate < listedAfter) return false;
    if (listedBefore && listing.listDate > listedBefore) return false;

    return true;
  });

  // Compute available options from listings of the current type
  const typeFilteredListings = listings.filter(l => l.listingType === listingTypeFilter);
  const availableFloorPlans = Array.from(
    new Set(typeFilteredListings.map(l => l.floorPlan).filter((fp): fp is string => !!fp))
  ).sort();
  const availableOrientations = Array.from(
    new Set(typeFilteredListings.map(l => l.orientation).filter((o): o is string => !!o))
  ).sort();

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return b.listPrice - a.listPrice;
      case "priceSf":
        return b.priceSf - a.priceSf;
      case "dom":
      case "date":
        return new Date(b.listDate).getTime() - new Date(a.listDate).getTime();
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <section className="section-padding bg-light">
        <div className="container-narrow">
          <p className="text-center text-sm uppercase tracking-wider text-secondary">
            Loading active listings...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return null;
  }

  // Active filter labels
  const statusLabels: Record<StatusFilter, string> = {
    active: "Active",
    pending: "Pending",
    sold: "Sold",
    offmarket: "Off-Market",
    all: "All",
  };
  const statusLabel = statusFilter !== "active" ? statusLabels[statusFilter] : undefined;

  const bedsLabel = bedroomFilters.length > 0
    ? bedroomFilters.map(b => b === 0 ? "Studio" : b === 3 ? "3+" : `${b}`).join(", ") + " BR"
    : undefined;
  const sqftLabel = sqftMin || sqftMax
    ? `${sqftMin || "0"}\u2013${sqftMax || "Any"} SF`
    : undefined;
  const priceLabel = priceMin || priceMax
    ? `$${formatCompact(priceMin)}\u2013${formatCompact(priceMax)}`
    : undefined;
  const detailsActive = bedroomFilters.length > 0 || !!sqftMin || !!sqftMax;
  const detailsLabel = detailsActive
    ? [bedsLabel, sqftLabel].filter(Boolean).join(", ")
    : undefined;

  // Listed filter label
  const listedActive = maxDom !== null || listedAfter !== null || listedBefore !== null;
  let listedLabel: string | undefined;
  if (maxDom !== null && !listedAfter && !listedBefore) {
    listedLabel = `\u2264${maxDom} DOM`;
  } else if (listedAfter && listedBefore) {
    const af = new Date(listedAfter + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const bf = new Date(listedBefore + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    listedLabel = `${af}\u2013${bf}`;
  } else if (listedAfter) {
    const af = new Date(listedAfter + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    listedLabel = `After ${af}`;
  } else if (listedBefore) {
    const bf = new Date(listedBefore + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    listedLabel = `Before ${bf}`;
  } else if (maxDom !== null) {
    listedLabel = `\u2264${maxDom} DOM`;
  }

  const activeFilterCount =
    (statusFilter !== "active" ? 1 : 0) +
    bedroomFilters.length +
    floorPlanFilters.length +
    orientationFilters.length +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (sqftMin ? 1 : 0) +
    (sqftMax ? 1 : 0) +
    (listedActive ? 1 : 0);

  return (
    <section id="active-listings" className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Active Listings
        </h2>

        {listings.length === 0 ? (
          <p className="py-12 text-center text-secondary">
            No active listings at this time. Check back soon for updates or{" "}
            <a
              href={`?message=${encodeURIComponent(`Looking for a condo off-market in ${buildingName}`)}#inquiry`}
              className="text-accent underline hover:text-primary"
            >
              reach out to find a home in {buildingName} off-market
            </a>
            .
          </p>
        ) : (
          <>
            {/* Sale/Lease Toggle */}
            <div className="mb-4 flex justify-center">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setListingTypeFilter("Sale")}
                  className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    listingTypeFilter === "Sale"
                      ? "rounded-md bg-accent text-white"
                      : "text-accent hover:text-primary"
                  }`}
                >
                  For Sale
                </button>
                <button
                  onClick={() => setListingTypeFilter("Lease")}
                  className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    listingTypeFilter === "Lease"
                      ? "rounded-md bg-accent text-white"
                      : "text-accent hover:text-primary"
                  }`}
                >
                  For Lease
                </button>
              </div>
            </div>

            {/* Dropdown Filter Bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Status */}
              <FilterDropdown
                label="Status"
                activeLabel={statusLabel}
                isActive={statusFilter !== "active"}
                width="w-64"
              >
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Listing Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { value: "active" as StatusFilter, label: "Active" },
                      { value: "pending" as StatusFilter, label: "Pending" },
                      { value: "sold" as StatusFilter, label: "Sold" },
                      { value: "offmarket" as StatusFilter, label: "Off-Market" },
                      { value: "all" as StatusFilter, label: "All" },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setStatusFilter(value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          statusFilter === value
                            ? "bg-accent text-white"
                            : "bg-gray-100 text-secondary hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </FilterDropdown>

              {/* Listed (DOM + Date Range) */}
              <FilterDropdown
                label="Listed"
                activeLabel={listedLabel}
                isActive={listedActive}
                width="w-72"
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Max Days on Market</p>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 14"
                      value={maxDom ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMaxDom(val ? parseInt(val, 10) || null : null);
                      }}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Date Range</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">After</label>
                        <input
                          type="date"
                          value={listedAfter ?? ""}
                          onChange={(e) => setListedAfter(e.target.value || null)}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-gray-500">Before</label>
                        <input
                          type="date"
                          value={listedBefore ?? ""}
                          onChange={(e) => setListedBefore(e.target.value || null)}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  {listedActive && (
                    <button
                      onClick={() => { setMaxDom(null); setListedAfter(null); setListedBefore(null); }}
                      className="text-xs font-medium text-accent hover:text-primary"
                    >
                      Clear listed
                    </button>
                  )}
                </div>
              </FilterDropdown>

              {/* Details (Beds + Sqft) */}
              <FilterDropdown
                label="Details"
                activeLabel={detailsLabel}
                isActive={detailsActive}
                width="w-64"
              >
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Bedrooms
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: 0, label: "Studio" },
                        { value: 1, label: "1 BR" },
                        { value: 2, label: "2 BR" },
                        { value: 3, label: "3+ BR" },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => toggleBedroomFilter(value)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            bedroomFilters.includes(value)
                              ? "bg-accent text-white"
                              : "bg-gray-100 text-secondary hover:bg-gray-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Square Feet
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={sqftMin}
                        onChange={(e) => setSqftMin(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={sqftMax}
                        onChange={(e) => setSqftMax(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </FilterDropdown>

              {/* Price */}
              <FilterDropdown
                label="Price"
                activeLabel={priceLabel}
                isActive={!!priceMin || !!priceMax}
                width="w-64"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Price Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </FilterDropdown>

              {/* Floor Plan */}
              {availableFloorPlans.length > 0 && (
                <FilterDropdown
                  label="Floor Plan"
                  activeLabel={floorPlanFilters.length > 0 ? `${floorPlanFilters.length} selected` : undefined}
                  isActive={floorPlanFilters.length > 0}
                  width="w-56"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {availableFloorPlans.map(fp => (
                      <button
                        key={fp}
                        onClick={() => toggleFloorPlanFilter(fp)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          floorPlanFilters.includes(fp)
                            ? "bg-accent text-white"
                            : "bg-gray-100 text-secondary hover:bg-gray-200"
                        }`}
                      >
                        {fp}
                      </button>
                    ))}
                  </div>
                </FilterDropdown>
              )}

              {/* Orientation */}
              {availableOrientations.length > 0 && (
                <FilterDropdown
                  label="Orientation"
                  activeLabel={orientationFilters.length > 0 ? `${orientationFilters.length} selected` : undefined}
                  isActive={orientationFilters.length > 0}
                  width="w-56"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {availableOrientations.map(o => (
                      <button
                        key={o}
                        onClick={() => toggleOrientationFilter(o)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          orientationFilters.includes(o)
                            ? "bg-accent text-white"
                            : "bg-gray-100 text-secondary hover:bg-gray-200"
                        }`}
                      >
                        {formatOrientation(o)}
                      </button>
                    ))}
                  </div>
                </FilterDropdown>
              )}

              {/* Clear All */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-accent hover:text-primary"
                >
                  Clear ({activeFilterCount})
                </button>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Sort — right-aligned */}
              <FilterDropdown
                label={sortBy !== "dom" ? sortLabels[sortBy] : "Sort"}
                activeLabel={sortBy === "dom" ? undefined : sortLabels[sortBy]}
                isActive={sortBy !== "dom"}
                width="w-52"
                align="right"
              >
                {(["dom", "price", "priceSf", "date"] as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`block w-full rounded px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      sortBy === opt
                        ? "bg-accent/10 text-accent"
                        : "text-secondary hover:bg-gray-100"
                    }`}
                  >
                    {sortLabels[opt]}
                  </button>
                ))}
              </FilterDropdown>
            </div>

            {/* Results count */}
            <p className="mb-4 text-sm text-secondary">
              {sortedListings.length} {sortedListings.length === 1 ? "listing" : "listings"}
            </p>

            {/* Listings grid */}
            {sortedListings.length === 0 ? (
              <p className="py-12 text-center text-secondary">
                No listings match your filters. Try adjusting your search criteria.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedListings.map(listing => (
                  <ListingCard key={listing.listingId} listing={listing} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function formatCompact(val: string): string {
  if (!val) return "Any";
  const n = parseFloat(val);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 0)}K`;
  return val;
}
