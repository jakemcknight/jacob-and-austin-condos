"use client";

import { useState, useEffect } from "react";
import ListingGallery from "./ListingGallery";

interface ClosedListingGalleryProps {
  listingId: string;
  buildingName: string;
  unitNumber?: string;
  /** Limit the number of photos displayed (e.g. 1 for Closed per Unlock MLS rules) */
  maxPhotos?: number;
}

/**
 * Client component that fetches photos on-demand for closed/historical listings.
 * Shows a loading skeleton while fetching, then renders ListingGallery with results.
 * Gracefully shows "no photos" placeholder if none available.
 */
export default function ClosedListingGallery({
  listingId,
  buildingName,
  unitNumber,
  maxPhotos,
}: ClosedListingGalleryProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/downtown-condos/api/mls/listing-photos/${listingId}`)
      .then((r) => r.json())
      .then((data) => {
        let photos = data.photos || [];
        // Limit photos if maxPhotos is set (e.g. Closed listings per Unlock MLS rules)
        if (maxPhotos && photos.length > maxPhotos) {
          photos = photos.slice(0, maxPhotos);
        }
        setPhotoUrls(photos);
        setLoading(false);
      })
      .catch(() => {
        setPhotoUrls([]);
        setLoading(false);
      });
  }, [listingId, maxPhotos]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex h-[300px] items-center justify-center rounded-lg bg-gray-100 md:h-[450px]">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
            <p className="mt-3 text-sm text-gray-400">Loading photos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ListingGallery
      listingId={listingId}
      photos={photoUrls}
      buildingName={buildingName}
      unitNumber={unitNumber}
      photoUrls={photoUrls}
    />
  );
}
