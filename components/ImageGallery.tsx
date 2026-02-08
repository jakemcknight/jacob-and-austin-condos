"use client";

import { useState } from "react";

interface ImageGalleryProps {
  images: string[];
  buildingName: string;
}

export default function ImageGallery({
  images,
  buildingName,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Show placeholder if no real images
  const hasImages = images.length > 0;

  return (
    <section className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Gallery
        </h2>

        {hasImages ? (
          <div>
            {/* Main Image */}
            <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden bg-gray-200">
              <div className="flex h-full items-center justify-center text-accent">
                <div className="text-center">
                  <div className="text-6xl">🏙️</div>
                  <p className="mt-4 text-sm uppercase tracking-wider">
                    {buildingName} — Photo {selectedIndex + 1}
                  </p>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  className={`flex h-20 w-28 flex-shrink-0 items-center justify-center bg-gray-200 text-xs text-accent transition-all ${
                    index === selectedIndex
                      ? "ring-2 ring-primary"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  Photo {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center bg-gray-200">
            <p className="text-sm text-accent">Gallery coming soon</p>
          </div>
        )}
      </div>
    </section>
  );
}
