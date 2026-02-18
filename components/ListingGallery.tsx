"use client";

import { useState, useEffect, useCallback } from "react";
import { useRetryImages } from "@/lib/use-retry-image";

interface ListingGalleryProps {
  listingId: string;
  photos: string[];
  buildingName: string;
  unitNumber?: string;
}

export default function ListingGallery({
  listingId,
  photos,
  buildingName,
  unitNumber,
}: ListingGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const basePhotoUrl = useCallback(
    (index: number) => `/downtown-condos/api/mls/photo/${listingId}/${index}`,
    [listingId]
  );
  const { getSrc: photoUrl, failed: imageError, onError: handleImageError } = useRetryImages(basePhotoUrl);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(prev + 1, photos.length - 1));
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "Escape" && lightboxOpen) {
        setLightboxOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, goNext, goPrev]);

  // Body scroll lock when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  function openLightbox(index: number) {
    setSelectedIndex(index);
    setLightboxOpen(true);
  }

  // No photos placeholder
  if (photos.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex h-[300px] items-center justify-center rounded-lg bg-gray-100 md:h-[400px]">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <p className="mt-3 text-sm text-gray-400">
              {buildingName}
              {unitNumber && ` #${unitNumber}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Single photo layout
  if (photos.length === 1) {
    return (
      <>
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div className="relative h-[300px] overflow-hidden rounded-lg bg-gray-900 md:h-[450px]">
            {imageError[0] ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-400">Photo unavailable</p>
              </div>
            ) : (
              <img
                src={photoUrl(0)}
                alt={`${buildingName}${unitNumber ? ` #${unitNumber}` : ""}`}
                className="h-full w-full cursor-pointer object-cover"
                onClick={() => openLightbox(0)}
                onError={() => handleImageError(0)}
              />
            )}
          </div>
        </div>
        {renderLightbox()}
      </>
    );
  }

  // Determine how many side photos to show (max 3)
  const sideCount = Math.min(photos.length - 1, 3);

  function renderPhoto(index: number, className: string) {
    if (imageError[index]) {
      return (
        <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
          <span className="text-xs text-gray-400">N/A</span>
        </div>
      );
    }
    return (
      <img
        src={photoUrl(index)}
        alt={`${buildingName}${unitNumber ? ` #${unitNumber}` : ""} - Photo ${index + 1}`}
        className={`cursor-pointer object-cover ${className}`}
        onClick={() => openLightbox(index)}
        onError={() => handleImageError(index)}
      />
    );
  }

  function renderLightbox() {
    if (!lightboxOpen) return null;
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
        onClick={() => setLightboxOpen(false)}
      >
        {/* Close button */}
        <button
          className="absolute right-4 top-4 z-10 text-4xl leading-none text-white hover:text-gray-300"
          onClick={() => setLightboxOpen(false)}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Main image */}
        <div
          className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {imageError[selectedIndex] ? (
            <div className="flex h-64 w-96 items-center justify-center rounded bg-gray-800">
              <p className="text-sm text-gray-400">Photo unavailable</p>
            </div>
          ) : (
            <img
              src={photoUrl(selectedIndex)}
              alt={`${buildingName}${unitNumber ? ` #${unitNumber}` : ""} - Photo ${selectedIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onError={() => handleImageError(selectedIndex)}
            />
          )}
        </div>

        {/* Prev arrow */}
        {selectedIndex > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Previous photo"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {selectedIndex < photos.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Next photo"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm font-medium text-white">
            {selectedIndex + 1} / {photos.length}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Single photo with counter */}
      <div className="mx-auto max-w-6xl px-4 pt-6 md:hidden">
        <div className="relative h-[280px] overflow-hidden rounded-lg bg-gray-900">
          {renderPhoto(selectedIndex, "h-full w-full")}

          {/* Prev arrow */}
          {selectedIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
              aria-label="Previous photo"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Next arrow */}
          {selectedIndex < photos.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
              aria-label="Next photo"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Photo counter + view all */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              onClick={() => openLightbox(0)}
              className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white transition hover:bg-black/70"
            >
              {selectedIndex + 1} / {photos.length} — View all
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Zillow-style grid */}
      <div className="mx-auto hidden max-w-6xl px-4 pt-6 md:block">
        <div className="relative overflow-hidden rounded-lg">
          {/* Grid: large photo left + side photos right */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: "3fr 1fr",
              gridTemplateRows: sideCount === 1
                ? "450px"
                : sideCount === 2
                  ? "225px 225px"
                  : "150px 150px 150px",
              height: "450px",
            }}
          >
            {/* Main photo - spans all rows */}
            <div
              className="overflow-hidden"
              style={{ gridRow: `1 / ${sideCount + 1}` }}
            >
              {renderPhoto(0, "h-full w-full")}
            </div>

            {/* Side photos */}
            {Array.from({ length: sideCount }, (_, i) => (
              <div key={i + 1} className="overflow-hidden">
                {renderPhoto(i + 1, "h-full w-full")}
              </div>
            ))}
          </div>

          {/* "View all photos" button */}
          {photos.length > 4 && (
            <button
              onClick={() => openLightbox(0)}
              className="absolute bottom-3 right-3 rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary shadow-md transition hover:bg-gray-50"
            >
              View all {photos.length} photos
            </button>
          )}

          {/* Expand button for few photos */}
          {photos.length <= 4 && photos.length > 1 && (
            <button
              onClick={() => openLightbox(0)}
              className="absolute bottom-3 right-3 rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary shadow-md transition hover:bg-gray-50"
            >
              View photos
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {renderLightbox()}
    </>
  );
}
