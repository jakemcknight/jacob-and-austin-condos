"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface MLSListing {
  listingId: string;
  mlsNumber: string;
  address: string;
  unitNumber: string;
  listPrice: number;
  bedroomsTotal: number;
  bathroomsTotalInteger: number;
  livingArea: number;
  priceSf: number;
  status: string;
  listDate: string;
  daysOnMarket: number;
  listingType: "Sale" | "Lease";
  photos?: string[];
  virtualTourUrl?: string;
  hoaFee?: number;
  buildingSlug?: string;
  buildingName?: string;
}

interface AllListingsProps {
  listingType?: "Sale" | "Lease";
}

type SortOption = "price" | "priceSf" | "dom" | "date";

export default function AllListings({ listingType = "Sale" }: AllListingsProps) {
  const [listings, setListings] = useState<MLSListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("price");

  // Filter state
  const [bedroomFilters, setBedroomFilters] = useState<number[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sqftMin, setSqftMin] = useState<string>("");
  const [sqftMax, setSqftMax] = useState<string>("");

  useEffect(() => {
    fetchAllListings();
  }, []);

  async function fetchAllListings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/downtown-condos/api/mls/listings`);

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
  }

  // Toggle bedroom filter
  const toggleBedroomFilter = (bedrooms: number) => {
    if (bedroomFilters.includes(bedrooms)) {
      setBedroomFilters(bedroomFilters.filter(b => b !== bedrooms));
    } else {
      setBedroomFilters([...bedroomFilters, bedrooms]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setBedroomFilters([]);
    setPriceMin("");
    setPriceMax("");
    setSqftMin("");
    setSqftMax("");
  };

  // Filter listings
  const filteredListings = listings.filter(listing => {
    // Filter by listing type (Sale/Lease)
    if (listing.listingType !== listingType) return false;

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

    return true;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return b.listPrice - a.listPrice; // High to low
      case "priceSf":
        return b.priceSf - a.priceSf; // High to low
      case "dom":
        return a.daysOnMarket - b.daysOnMarket; // Low to high
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
    (priceMin ? 1 : 0) +
    (priceMax ? 1 : 0) +
    (sqftMin ? 1 : 0) +
    (sqftMax ? 1 : 0);

  return (
    <section id="all-listings" className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-primary md:text-3xl">
          {listingType === "Sale" ? "Downtown Austin Condos For Sale" : "Downtown Austin Condos For Lease"}
        </h2>

        {/* Show message if no listings at all */}
        {listings.length === 0 ? (
          <p className="py-12 text-center text-secondary">
            No active listings at this time. Check back soon for updates or{" "}
            <a
              href="?message=Looking%20for%20a%20downtown%20Austin%20condo#inquiry"
              className="text-accent underline hover:text-primary"
            >
              reach out to find a home off-market
            </a>
            .
          </p>
        ) : (
          <>
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
                {sortedListings.length} of {listings.filter(l => l.listingType === listingType).length} listings
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
                  <ListingCard key={listing.listingId} listing={listing} showBuilding={true} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ListingCard({ listing, showBuilding = false }: {
  listing: MLSListing;
  showBuilding?: boolean;
}) {
  return (
    <Link
      href={`/listings/${listing.mlsNumber}`}
      className="group block overflow-hidden border border-gray-200 bg-white transition-shadow hover:shadow-lg"
    >
      {/* Photo */}
      {listing.photos && listing.photos[0] ? (
        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
          <Image
            src={listing.photos[0]}
            alt={`Unit ${listing.unitNumber}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Building Badge - Top Left with Green Background */}
          {showBuilding && listing.buildingName && (
            <div className="absolute left-2 top-2 bg-accent px-2 py-1 text-xs font-semibold text-white">
              {listing.buildingName}
            </div>
          )}
          {/* Lease Badge - Top Right */}
          {listing.listingType === "Lease" && (
            <div className="absolute right-2 top-2 bg-denim px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
              For Lease
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center bg-gray-100">
          <p className="text-sm uppercase tracking-wider text-gray-400">No Photo Available</p>
        </div>
      )}

      {/* Content - Zillow Style */}
      <div className="p-3">
        {/* Price */}
        <p className="mb-1 text-xl font-bold text-primary">
          ${listing.listPrice.toLocaleString()}
          {listing.listingType === "Lease" && <span className="text-sm font-normal">/mo</span>}
        </p>

        {/* Beds/Baths/Sqft/$/SF - Zillow format with pipes */}
        <p className="mb-1 text-xs text-gray-600">
          {listing.bedroomsTotal > 0 ? `${listing.bedroomsTotal} bds` : "Studio"} |{" "}
          {listing.bathroomsTotalInteger} ba |{" "}
          {listing.livingArea.toLocaleString()} sqft |{" "}
          ${Math.round(listing.priceSf)}/sf
        </p>

        {/* Address */}
        <p className="text-xs text-gray-700">
          {listing.address}
          {listing.unitNumber && `, Unit ${listing.unitNumber}`}
        </p>
      </div>
    </Link>
  );
}
