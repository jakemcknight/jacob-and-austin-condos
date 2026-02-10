"use client";

import { useState } from "react";
import BalconyViewer from "@/components/BalconyViewer";

export default function BalconyViewerModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="border border-primary bg-primary px-6 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
      >
        🏙️ Explore 3D Views
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative h-full w-full max-w-7xl">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-12 right-0 text-3xl text-white hover:text-gray-300"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Viewer */}
            <div className="h-full overflow-hidden rounded-lg bg-white shadow-2xl">
              <BalconyViewer height="100%" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
