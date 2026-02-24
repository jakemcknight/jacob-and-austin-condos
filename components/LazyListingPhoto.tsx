"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface LazyListingPhotoProps {
  listingId: string;
  alt: string;
  compact?: boolean;
  children?: React.ReactNode;
}

/**
 * Lazy-loads a single photo for off-market/sold listings using IntersectionObserver.
 * Only fetches when the card scrolls into view, preventing thousands of simultaneous API calls.
 * Uses the existing /api/mls/listing-photos endpoint with Vercel CDN caching.
 */
export default function LazyListingPhoto({ listingId, alt, compact, children }: LazyListingPhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "empty">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setState("loading");
          fetch(`/api/mls/listing-photos/${listingId}?limit=1`)
            .then(r => r.json())
            .then(data => {
              const photos = data.photos || [];
              if (photos.length > 0) {
                setPhotoUrl(photos[0]);
                setState("loaded");
              } else {
                setState("empty");
              }
            })
            .catch(() => setState("empty"));
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [listingId]);

  const height = compact ? "h-36" : "h-48";

  if (state === "loaded" && photoUrl) {
    return (
      <div ref={ref} className={`relative w-full overflow-hidden bg-gray-100 ${height}`}>
        <Image
          src={photoUrl}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative flex items-center justify-center bg-gray-100 ${height}`}>
      {state === "loading" ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
      ) : (
        <p className="text-sm uppercase tracking-wider text-gray-400">No Photo Available</p>
      )}
      {children}
    </div>
  );
}
