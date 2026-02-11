"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
}

interface ActiveListingsProps {
  buildingSlug: string;
}

type SortOption = "price" | "priceSf" | "dom" | "date";

export default function ActiveListings({ buildingSlug }: ActiveListingsProps) {
  const [listings, setListings] = useState<MLSListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("price");

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

  // Sort listings
  const sortedListings = [...listings].sort((a, b) => {
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

  if (listings.length === 0) {
    return null; // Hide section if no listings
  }

  return (
    <section className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Active Listings
        </h2>

        {/* Sort controls */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setSortBy("price")}
            className={`px-4 py-2 text-sm font-medium tracking-wider transition-colors ${
              sortBy === "price"
                ? "bg-accent text-white"
                : "bg-white text-accent hover:bg-accent hover:text-white"
            }`}
          >
            PRICE
          </button>
          <button
            onClick={() => setSortBy("priceSf")}
            className={`px-4 py-2 text-sm font-medium tracking-wider transition-colors ${
              sortBy === "priceSf"
                ? "bg-accent text-white"
                : "bg-white text-accent hover:bg-accent hover:text-white"
            }`}
          >
            $/SF
          </button>
          <button
            onClick={() => setSortBy("dom")}
            className={`px-4 py-2 text-sm font-medium tracking-wider transition-colors ${
              sortBy === "dom"
                ? "bg-accent text-white"
                : "bg-white text-accent hover:bg-accent hover:text-white"
            }`}
          >
            DAYS ON MARKET
          </button>
          <button
            onClick={() => setSortBy("date")}
            className={`px-4 py-2 text-sm font-medium tracking-wider transition-colors ${
              sortBy === "date"
                ? "bg-accent text-white"
                : "bg-white text-accent hover:bg-accent hover:text-white"
            }`}
          >
            NEWEST
          </button>
        </div>

        {/* Listings grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedListings.map(listing => (
            <ListingCard key={listing.listingId} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ListingCard({ listing }: { listing: MLSListing }) {
  return (
    <div className="overflow-hidden border border-gray-200 bg-white transition-shadow hover:shadow-lg">
      {/* Photo */}
      {listing.photos && listing.photos[0] ? (
        <div className="relative h-48 w-full bg-gray-100">
          <Image
            src={listing.photos[0]}
            alt={`Unit ${listing.unitNumber}`}
            fill
            className="object-cover"
          />
          {listing.listingType === "Lease" && (
            <div className="absolute left-2 top-2 bg-denim px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
              For Lease
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center bg-gray-100">
          <p className="text-sm uppercase tracking-wider text-gray-400">No Photo Available</p>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Price */}
        <p className="mb-2 text-2xl font-bold text-primary">
          ${listing.listPrice.toLocaleString()}
          {listing.listingType === "Lease" && <span className="text-sm font-normal">/mo</span>}
        </p>

        {/* Beds/Baths/Sqft */}
        <p className="mb-2 text-sm text-secondary">
          {listing.bedroomsTotal > 0 ? `${listing.bedroomsTotal} bed` : "Studio"} ·{" "}
          {listing.bathroomsTotalInteger} bath · {listing.livingArea.toLocaleString()} SF
        </p>

        {/* $/SF */}
        <p className="mb-3 text-sm font-medium text-accent">
          ${Math.round(listing.priceSf)}/SF
        </p>

        {/* Details */}
        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs text-secondary">
          {listing.unitNumber && (
            <p>
              <span className="font-medium">Unit:</span> {listing.unitNumber}
            </p>
          )}
          <p>
            <span className="font-medium">Status:</span> {listing.status}
          </p>
          <p>
            <span className="font-medium">Days on Market:</span> {listing.daysOnMarket}
          </p>
          {listing.hoaFee && listing.hoaFee > 0 && (
            <p>
              <span className="font-medium">HOA:</span> ${listing.hoaFee.toLocaleString()}/mo
            </p>
          )}
          <p>
            <span className="font-medium">MLS#:</span> {listing.mlsNumber}
          </p>
        </div>

        {/* Virtual Tour Link */}
        {listing.virtualTourUrl && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <a
              href={listing.virtualTourUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium uppercase tracking-wider text-accent hover:text-primary"
            >
              Virtual Tour →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
