"use client";

import { useState, useEffect } from "react";
import { buildings } from "@/data/buildings";
import { formatOrientation } from "@/lib/format-dom";
import ListingCard from "./ListingCard";
import type { MLSListingDisplay as MLSListing } from "./ListingCard";

interface ActiveListingsProps {
  buildingSlug: string;
}

type SortOption = "price" | "priceSf" | "dom" | "date";

export default function ActiveListings({ buildingSlug }: ActiveListingsProps) {
  const [listings, setListings] = useState<MLSListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("dom");

  // Get building name for contact link
  const building = buildings.find(b => b.slug === buildingSlug);
  const buildingName = building?.name || "";

  // Filter state
  const [listingTypeFilter, setListingTypeFilter] = useState<"Sale" | "Lease">("Sale");
  const [bedroomFilters, setBedroomFilters] = useState<number[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sqftMin, setSqftMin] = useState<string>("");
  const [sqftMax, setSqftMax] = useState<string>("");
  const [floorPlanFilters, setFloorPlanFilters] = useState<string[]>([]);
  const [orientationFilters, setOrientationFilters] = useState<string[]>([]);

  useEffect(() => {
    fetchListings();
  }, [buildingSlug]);

  async function fetchListings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/downtown-condos/api/mls/listings?building=${buildingSlug}`);

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
  }

  // Toggle bedroom filter
  const toggleBedroomFilter = (bedrooms: number) => {
    if (bedroomFilters.includes(bedrooms)) {
      setBedroomFilters(bedroomFilters.filter(b => b !== bedrooms));
    } else {
      setBedroomFilters([...bedroomFilters, bedrooms]);
    }
  };

  const toggleFloorPlanFilter = (fp: string) => {
    if (floorPlanFilters.includes(fp)) {
      setFloorPlanFilters(floorPlanFilters.filter(f => f !== fp));
    } else {
      setFloorPlanFilters([...floorPlanFilters, fp]);
    }
  };

  const toggleOrientationFilter = (o: string) => {
    if (orientationFilters.includes(o)) {
      setOrientationFilters(orientationFilters.filter(x => x !== o));
    } else {
      setOrientationFilters([...orientationFilters, o]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setBedroomFilters([]);
    setPriceMin("");
    setPriceMax("");
    setSqftMin("");
    setSqftMax("");
    setFloorPlanFilters([]);
    setOrientationFilters([]);
  };

  // Filter listings
  const filteredListings = listings.filter(listing => {
    // Filter by listing type (Sale/Lease)
    if (listing.listingType !== listingTypeFilter) return false;

    // Filter by bedroom count
    if (bedroomFilters.length > 0) {
      const listingBedrooms = listing.bedroomsTotal;
      let bedroomMatch = false;

      for (const filterBedrooms of bedroomFilters) {
        if (filterBedrooms === 3) {
          // "3+ BR" includes 3 or more bedrooms
          if (listingBedrooms >= 3) {
            bedroomMatch = true;
            break;
          }
        } else {
          // Exact match for Studio, 1BR, 2BR
          if (listingBedrooms === filterBedrooms) {
            bedroomMatch = true;
            break;
          }
        }
      }

      if (!bedroomMatch) return false;
    }

    // Filter by price
    if (priceMin && listing.listPrice < parseFloat(priceMin)) return false;
    if (priceMax && listing.listPrice > parseFloat(priceMax)) return false;

    // Filter by square footage
    if (sqftMin && listing.livingArea < parseFloat(sqftMin)) return false;
    if (sqftMax && listing.livingArea > parseFloat(sqftMax)) return false;

    // Filter by floor plan
    if (floorPlanFilters.length > 0) {
      if (!listing.floorPlan || !floorPlanFilters.includes(listing.floorPlan)) return false;
    }

    // Filter by orientation
    if (orientationFilters.length > 0) {
      if (!listing.orientation || !orientationFilters.includes(listing.orientation)) return false;
    }

    return true;
  });

  // Compute available floor plans and orientations from listings of the current type
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
        return b.listPrice - a.listPrice; // High to low
      case "priceSf":
        return b.priceSf - a.priceSf; // High to low
      case "dom":
        // Sort by listDate descending (newest = lowest DOM)
        return new Date(b.listDate).getTime() - new Date(a.listDate).getTime();
      case "date":
        return new Date(b.listDate).getTime() - new Date(a.listDate).getTime(); // Newest first
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
    return null; // Hide section on error
  }

  // Count active filters
  const activeFilterCount =
    bedroomFilters.length +
    floorPlanFilters.length +
    orientationFilters.length +
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (sqftMin ? 1 : 0) +
    (sqftMax ? 1 : 0);

  return (
    <section id="active-listings" className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Active Listings
        </h2>

        {/* Show message if no listings at all */}
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
            <div className="mb-6 flex justify-center">
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

        {/* Filters - Compact */}
        <div className="mb-4 rounded border border-gray-200 bg-white p-4">
          {/* Bedroom Filters */}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Bedrooms
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => toggleBedroomFilter(0)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  bedroomFilters.includes(0)
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                Studio
              </button>
              <button
                onClick={() => toggleBedroomFilter(1)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  bedroomFilters.includes(1)
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                1 BR
              </button>
              <button
                onClick={() => toggleBedroomFilter(2)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  bedroomFilters.includes(2)
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                2 BR
              </button>
              <button
                onClick={() => toggleBedroomFilter(3)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  bedroomFilters.includes(3)
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                3+ BR
              </button>
            </div>
          </div>

          {/* Floor Plan Filters */}
          {availableFloorPlans.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Floor Plan
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableFloorPlans.map(fp => (
                  <button
                    key={fp}
                    onClick={() => toggleFloorPlanFilter(fp)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      floorPlanFilters.includes(fp)
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-secondary hover:bg-gray-200"
                    }`}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orientation Filters */}
          {availableOrientations.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Orientation
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableOrientations.map(o => (
                  <button
                    key={o}
                    onClick={() => toggleOrientationFilter(o)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      orientationFilters.includes(o)
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-secondary hover:bg-gray-200"
                    }`}
                  >
                    {formatOrientation(o)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price and Sqft Ranges - Single Row */}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Min Price</label>
              <input
                type="number"
                placeholder="$0"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Max Price</label>
              <input
                type="number"
                placeholder="Any"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Min Sq Ft</label>
              <input
                type="number"
                placeholder="0"
                value={sqftMin}
                onChange={(e) => setSqftMin(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Max Sq Ft</label>
              <input
                type="number"
                placeholder="Any"
                value={sqftMax}
                onChange={(e) => setSqftMax(e.target.value)}
                className="w-full border border-gray-300 px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-2 text-xs font-medium uppercase tracking-wide text-accent hover:text-primary"
            >
              Clear All ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Results count and Sort dropdown */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-secondary">
            {sortedListings.length} {sortedListings.length === 1 ? "listing" : "listings"}
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="border border-gray-300 px-3 py-1 text-sm focus:border-accent focus:outline-none"
            >
              <option value="price">Price (High to Low)</option>
              <option value="priceSf">$/SF (High to Low)</option>
              <option value="dom">Days on Market</option>
              <option value="date">Newest First</option>
            </select>
          </div>
        </div>

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

// ListingCard is now imported from ./ListingCard
