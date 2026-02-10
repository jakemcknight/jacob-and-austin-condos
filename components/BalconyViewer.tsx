"use client";

import React from "react";

interface BalconyViewerProps {
  width?: string;
  height?: string;
  className?: string;
}

export default function BalconyViewer({
  width = "100%",
  height = "600px",
  className = "",
}: BalconyViewerProps) {
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <iframe
        src="/downtown-condos/balcony-viewer/index.html"
        title="Balcony Viewer"
        className="w-full h-full border-0 rounded-lg shadow-lg"
        allow="geolocation"
        loading="lazy"
      />
    </div>
  );
}
