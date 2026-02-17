"use client";

import ListingCard from "./ListingCard";
import type { MLSListingDisplay } from "./ListingCard";

interface ListingGridProps {
  listings: MLSListingDisplay[];
}

export default function ListingGrid({ listings }: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <p className="py-12 text-center text-secondary">
        No listings match your filters. Try adjusting your search criteria.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {listings.map(listing => (
        <ListingCard key={listing.listingId} listing={listing} showBuilding />
      ))}
    </div>
  );
}
