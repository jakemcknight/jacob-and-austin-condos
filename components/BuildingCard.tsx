"use client";

import Link from "next/link";
import { useState } from "react";

interface BuildingCardProps {
  name: string;
  slug: string;
  address: string;
  floors: number;
  units: number;
  yearBuilt: number;
  heroImage: string;
}

export default function BuildingCard({
  name,
  slug,
  address,
  floors,
  units,
  yearBuilt,
  heroImage,
}: BuildingCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <Link
      href={`/${slug}`}
      className="group block overflow-hidden border border-gray-100 bg-white transition-all hover:border-gray-300 hover:shadow-lg"
    >
      {/* Building Photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {!imageError && heroImage ? (
          <img
            src={heroImage}
            alt={`${name} exterior`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-transform duration-500 group-hover:scale-105">
            <div className="text-center">
              <div className="text-4xl">🏙️</div>
              <p className="mt-2 text-xs uppercase tracking-wider text-accent">
                {name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-lg font-semibold uppercase tracking-wide text-primary">
          {name}
        </h3>
        <p className="mt-1 text-sm text-accent">{address}</p>
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="text-xs text-accent">
            <span className="font-medium text-secondary">{floors}</span> Floors
            {" · "}
            <span className="font-medium text-secondary">{units}</span> Units
            {" · "}
            <span className="font-medium text-secondary">{yearBuilt}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
