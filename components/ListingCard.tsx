"use client";

import Image from "next/image";
import Link from "next/link";
import { calculateDaysOnMarket, formatDaysOnMarket } from "@/lib/format-dom";
import { useRetryImage } from "@/lib/use-retry-image";

export interface MLSListingDisplay {
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
  city?: string;
  postalCode?: string;
  yearBuilt?: number;
  floorPlan?: string;
  orientation?: string;
  floorPlanSlug?: string;
}

interface ListingCardProps {
  listing: MLSListingDisplay;
  showBuilding?: boolean;
  compact?: boolean;
}

export default function ListingCard({ listing, showBuilding = false, compact = false }: ListingCardProps) {
  const photoBaseSrc = `/downtown-condos/api/mls/photo/${listing.listingId}/0`;
  const { src: photoSrc, failed: imageError, onError: handleImageError } = useRetryImage(photoBaseSrc);

  const hasPhoto = listing.photos && listing.photos.length > 0 && !imageError;

  return (
    <Link
      href={`/listings/${listing.mlsNumber}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg"
    >
      {/* Photo */}
      {hasPhoto ? (
        <div className={`relative w-full overflow-hidden bg-gray-100 ${compact ? "h-36" : "h-48"}`}>
          <Image
            src={photoSrc}
            alt={`Unit ${listing.unitNumber}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={handleImageError}
          />
          {/* Building Badge - Top Left */}
          {showBuilding && listing.buildingName && (
            <div className="absolute left-2 top-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
              {listing.buildingName}
            </div>
          )}
          {/* Lease Badge - Top Right */}
          {listing.listingType === "Lease" && (
            <div className="absolute right-2 top-2 rounded-full bg-denim px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              For Lease
            </div>
          )}
        </div>
      ) : (
        <div className={`flex items-center justify-center bg-gray-100 ${compact ? "h-36" : "h-48"}`}>
          <p className="text-sm uppercase tracking-wider text-gray-400">No Photo Available</p>
        </div>
      )}

      {/* Content */}
      <div className={compact ? "p-2.5" : "p-3"}>
        {/* Status + DOM badges */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-zilker px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            {listing.status}
          </span>
          <span className="rounded-full bg-zilker px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            {formatDaysOnMarket(calculateDaysOnMarket(listing.listDate))}
          </span>
        </div>

        {/* Price */}
        <p className={`mb-1 font-bold text-primary ${compact ? "text-lg" : "text-xl"}`}>
          ${listing.listPrice.toLocaleString()}
          {listing.listingType === "Lease" && <span className="text-sm font-normal text-secondary">/mo</span>}
        </p>

        {/* Address line 1 */}
        <p className="text-sm text-gray-700">
          {listing.address}
          {listing.unitNumber && ` #${listing.unitNumber}`}
        </p>

        {/* Address line 2 - City, TX Zip */}
        {!compact && (listing.city || listing.postalCode) && (
          <p className="text-sm text-gray-500">
            {listing.city || "Austin"}, TX {listing.postalCode}
          </p>
        )}

        {/* Details line */}
        <p className={`mt-1.5 text-xs text-gray-600 ${compact ? "line-clamp-1" : ""}`}>
          {listing.bedroomsTotal > 0 ? `${listing.bedroomsTotal} bd` : "Studio"}
          {" · "}
          {listing.bathroomsTotalInteger} ba
          {" · "}
          {listing.livingArea.toLocaleString()} SqFt
          {listing.priceSf > 0 && (
            <>
              {" · "}
              ${Math.round(listing.priceSf)}/SqFt
            </>
          )}
          {!compact && listing.yearBuilt && (
            <>
              {" · "}
              Built {listing.yearBuilt}
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
