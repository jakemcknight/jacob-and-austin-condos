"use client";

import { useState, useEffect, useCallback } from "react";
import { buildings } from "@/data/buildings";
import FilterBar from "./filters/FilterBar";
import type { FilterState } from "./filters/FilterBar";
import ListingGrid from "./ListingGrid";
import ListingCard from "./ListingCard";
import type { MLSListingDisplay } from "./ListingCard";
import dynamic from "next/dynamic";

// Dynamic import for map component (uses Leaflet which needs window)
const ListingsMap = dynamic(() => import("./map/ListingsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100">
      <p className="text-sm uppercase tracking-wider text-accent">Loading map...</p>
    </div>
  ),
});

// Page titles per status filter
const PAGE_TITLES: Record<string, Record<string, string>> = {
  Sale: {
    active: "Downtown Austin Condos For Sale",
    sold: "Recently Sold Downtown Austin Condos",
    offmarket: "Off-Market Downtown Austin Condos",
    all: "All Downtown Austin Condos",
  },
  Lease: {
    active: "Downtown Austin Condos For Lease",
    sold: "Recently Leased Downtown Austin Condos",
    offmarket: "Off-Market Downtown Austin Condos",
    all: "All Downtown Austin Condos",
  },
};

export default function AllListings() {
  const [listings, setListings] = useState<MLSListingDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "list";
    return "map";
  });

  const [filters, setFilters] = useState<FilterState>({
    listingTypeFilter: "Sale",
    statusFilter: "active",
    bedroomFilters: [],
    selectedBuildings: [],
    priceMin: "",
    priceMax: "",
    sqftMin: "",
    sqftMax: "",
    sortBy: "dom",
    floorPlanFilters: [],
    orientationFilters: [],
  });

  const fetchListings = useCallback(async (statusFilter: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/downtown-condos/api/mls/listings?status=${statusFilter}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch listings: ${response.statusText}`);
      }
      const data = await response.json();
      setListings(data);
    } catch (err) {
      console.error("[AllListings] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when statusFilter changes
  useEffect(() => {
    fetchListings(filters.statusFilter);
  }, [filters.statusFilter, fetchListings]);

  // Filter listings (client-side filters applied on top of server-side status filter)
  const filteredListings = listings.filter(listing => {
    if (listing.listingType !== filters.listingTypeFilter) return false;

    if (filters.selectedBuildings.length > 0) {
      if (!listing.buildingSlug || !filters.selectedBuildings.includes(listing.buildingSlug)) {
        return false;
      }
    }

    if (filters.bedroomFilters.length > 0) {
      let bedroomMatch = false;
      for (const filterBedrooms of filters.bedroomFilters) {
        if (filterBedrooms === 3) {
          if (listing.bedroomsTotal >= 3) { bedroomMatch = true; break; }
        } else {
          if (listing.bedroomsTotal === filterBedrooms) { bedroomMatch = true; break; }
        }
      }
      if (!bedroomMatch) return false;
    }

    if (filters.priceMin && listing.listPrice < parseFloat(filters.priceMin)) return false;
    if (filters.priceMax && listing.listPrice > parseFloat(filters.priceMax)) return false;
    if (filters.sqftMin && listing.livingArea < parseFloat(filters.sqftMin)) return false;
    if (filters.sqftMax && listing.livingArea > parseFloat(filters.sqftMax)) return false;

    if (filters.floorPlanFilters.length > 0) {
      if (!listing.floorPlan || !filters.floorPlanFilters.includes(listing.floorPlan)) return false;
    }

    if (filters.orientationFilters.length > 0) {
      if (!listing.orientation || !filters.orientationFilters.includes(listing.orientation)) return false;
    }

    return true;
  });

  // Compute available floor plans and orientations from the current type-filtered listing set
  const typeFilteredListings = listings.filter(l => l.listingType === filters.listingTypeFilter);
  const availableFloorPlans = Array.from(
    new Set(typeFilteredListings.map(l => l.floorPlan).filter((fp): fp is string => !!fp))
  ).sort();
  const availableOrientations = Array.from(
    new Set(typeFilteredListings.map(l => l.orientation).filter((o): o is string => !!o))
  ).sort();

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (filters.sortBy) {
      case "price": return b.listPrice - a.listPrice;
      case "priceSf": return b.priceSf - a.priceSf;
      case "dom": return new Date(b.listDate).getTime() - new Date(a.listDate).getTime();
      case "date": return new Date(b.listDate).getTime() - new Date(a.listDate).getTime();
      default: return 0;
    }
  });

  const totalCount = listings.filter(l => l.listingType === filters.listingTypeFilter).length;
  const pageTitle = PAGE_TITLES[filters.listingTypeFilter]?.[filters.statusFilter] || "Downtown Austin Condos";

  if (loading) {
    return (
      <section className="section-padding bg-light">
        <div className="container-narrow">
          <p className="text-center text-sm uppercase tracking-wider text-secondary">
            Loading listings...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return null;
  }

  if (listings.length === 0) {
    return (
      <section className="section-padding bg-light">
        <div className="container-narrow">
          {/* Filter Bar — always show so user can change status filter */}
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={0}
            totalCount={0}
            availableFloorPlans={[]}
            availableOrientations={[]}
          />
          <p className="py-12 text-center text-secondary">
            {filters.statusFilter === "active" ? (
              <>
                No active listings at this time. Check back soon for updates or{" "}
                <a
                  href="?message=Looking%20for%20a%20downtown%20Austin%20condo#inquiry"
                  className="text-accent underline hover:text-primary"
                >
                  reach out to find a home off-market
                </a>
                .
              </>
            ) : (
              <>No {filters.statusFilter === "sold" ? "sold" : "off-market"} listings found.</>
            )}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="all-listings" className={viewMode === "list" ? "bg-light" : "bg-light"}>
      {/* Title - List mode only */}
      {viewMode === "list" && (
        <div className="container-narrow pb-2 pt-8">
          <h2 className="mb-4 text-center text-2xl font-bold tracking-tight text-primary md:text-3xl">
            {pageTitle}
          </h2>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={sortedListings.length}
        totalCount={totalCount}
        availableFloorPlans={availableFloorPlans}
        availableOrientations={availableOrientations}
      />

      {/* Content */}
      {viewMode === "list" ? (
        <div className="container-narrow py-6">
          <ListingGrid listings={sortedListings} />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row" style={{ height: "calc(100vh - 140px)" }}>
          {/* Map Panel — full height on mobile, 50% width on desktop */}
          <div className="h-full w-full md:h-full md:w-1/2">
            <ListingsMap listings={sortedListings} buildings={buildings} />
          </div>

          {/* Listings Sidebar — hidden on mobile, users browse via map popups */}
          <div className="hidden flex-1 overflow-y-auto border-l border-gray-200 bg-light md:block">
            <div className="p-4">
              <p className="mb-3 text-sm text-secondary">
                {sortedListings.length} result{sortedListings.length !== 1 ? "s" : ""}
              </p>
              {sortedListings.length === 0 ? (
                <p className="py-8 text-center text-secondary">
                  No listings match your filters.
                </p>
              ) : (
                <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                  {sortedListings.map(listing => (
                    <ListingCard
                      key={listing.listingId}
                      listing={listing}
                      showBuilding
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
