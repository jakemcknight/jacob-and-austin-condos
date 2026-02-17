"use client";

import { useEffect, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import type { Building } from "@/data/buildings";
import type { MLSListingDisplay } from "@/components/ListingCard";

interface ListingsMapProps {
  listings: MLSListingDisplay[];
  buildings: Building[];
}

interface BuildingCluster {
  building: Building;
  listings: MLSListingDisplay[];
  minPrice: number;
  maxPrice: number;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`;
  return `$${price}`;
}

// Zilker green pin SVG (same as MapView.tsx)
const PIN_SVG = `<svg width="30" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 24 12 24s12-15.6 12-24c0-6.627-5.373-12-12-12zm0 16.5c-2.485 0-4.5-2.015-4.5-4.5S9.515 7.5 12 7.5s4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5z" fill="#324A32"/></svg>`;

export default function ListingsMap({ listings, buildings }: ListingsMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet")["MapContainer"];
    TileLayer: typeof import("react-leaflet")["TileLayer"];
    Marker: typeof import("react-leaflet")["Marker"];
    Popup: typeof import("react-leaflet")["Popup"];
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [L, setL] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([leafletModule, RL]) => {
      setL(leafletModule);
      setMapComponents({
        MapContainer: RL.MapContainer,
        TileLayer: RL.TileLayer,
        Marker: RL.Marker,
        Popup: RL.Popup,
      });
    });
  }, []);

  // Group listings by building
  const clusters = useMemo(() => {
    const map = new Map<string, MLSListingDisplay[]>();
    for (const listing of listings) {
      if (!listing.buildingSlug) continue;
      const existing = map.get(listing.buildingSlug) || [];
      existing.push(listing);
      map.set(listing.buildingSlug, existing);
    }

    const result: BuildingCluster[] = [];
    for (const [slug, listingGroup] of Array.from(map.entries())) {
      const building = buildings.find(b => b.slug === slug);
      if (!building) continue;
      const prices = listingGroup.map(l => l.listPrice);
      result.push({
        building,
        listings: listingGroup,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      });
    }
    return result;
  }, [listings, buildings]);

  // Create DivIcon with pin SVG + count badge
  const createIcon = useMemo(() => {
    if (!L) return null;
    return (cluster: BuildingCluster) => {
      const count = cluster.listings.length;
      const badgeWidth = count >= 10 ? 22 : 18;
      return new L.DivIcon({
        className: "listing-marker-icon",
        html: `<div style="position:relative;width:30px;height:42px;">
          ${PIN_SVG}
          <div style="
            position:absolute;top:3px;left:50%;transform:translateX(-50%);
            background:white;color:#324A32;font-weight:800;font-size:11px;
            width:${badgeWidth}px;height:18px;border-radius:9px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 2px rgba(0,0,0,0.2);line-height:1;
          ">${count}</div>
        </div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -42],
      });
    };
  }, [L]);

  if (!MapComponents || !L || !createIcon) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <p className="text-sm uppercase tracking-wider text-accent">Loading map...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;
  const center: [number, number] = [30.268, -97.745];

  return (
    <div className="relative h-full w-full" style={{ zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .listing-marker-icon {
          background: none !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          font-family: inherit !important;
          width: 100% !important;
        }
        .listing-popup-scroll {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          max-height: min(400px, 50vh);
          padding: 12px 14px 14px;
          -webkit-overflow-scrolling: touch;
        }
        .listing-popup-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .listing-popup-scroll::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 2px;
        }
        .listing-popup-scroll::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 2px;
        }
        .listing-popup-card {
          width: 100%;
          min-height: 80px;
          flex-shrink: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          background: white;
          transition: box-shadow 0.15s;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: row;
        }
        .listing-popup-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .listing-popup-card img {
          width: 100px;
          height: 80px;
          object-fit: cover;
          display: block;
          flex-shrink: 0;
        }
        .listing-popup-card .no-photo {
          width: 100px;
          height: 80px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #9ca3af;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .listing-popup-card .card-info {
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }
        .listing-popup-card .card-price {
          font-weight: 700;
          font-size: 15px;
          color: #191919;
        }
        .listing-popup-card .card-unit {
          font-size: 12px;
          color: #374151;
          margin-top: 1px;
          font-weight: 500;
        }
        .listing-popup-card .card-details {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      ` }} />
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {clusters.map(cluster => (
          <Marker
            key={cluster.building.slug}
            position={[cluster.building.coordinates.lat, cluster.building.coordinates.lng]}
            icon={createIcon(cluster)}
          >
            <Popup maxWidth={isMobile ? 360 : 420} minWidth={isMobile ? 300 : 300}>
              <div>
                {/* Building header */}
                <div style={{ padding: "14px 14px 0" }}>
                  <a
                    href={`/downtown-condos/${cluster.building.slug}`}
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#191919",
                      textDecoration: "none",
                      display: "block",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#886752")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#191919")}
                  >
                    {cluster.building.name} →
                  </a>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                    {cluster.building.address} · {cluster.listings.length} listing{cluster.listings.length !== 1 ? "s" : ""}
                    {cluster.listings.length === 1
                      ? ` · ${formatPrice(cluster.minPrice)}`
                      : ` · ${formatPrice(cluster.minPrice)}–${formatPrice(cluster.maxPrice)}`}
                  </div>
                </div>

                {/* Scrollable listing cards */}
                <div className="listing-popup-scroll">
                  {cluster.listings.map(listing => (
                    <a
                      key={listing.listingId}
                      href={`/downtown-condos/listings/${listing.mlsNumber}`}
                      className="listing-popup-card"
                    >
                      {listing.photos && listing.photos.length > 0 ? (
                        <img
                          src={`/downtown-condos/api/mls/photo/${listing.listingId}/0`}
                          alt={`Unit ${listing.unitNumber}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="no-photo">No Photo</div>
                      )}
                      <div className="card-info">
                        <div className="card-price">${listing.listPrice.toLocaleString()}</div>
                        {listing.unitNumber && <div className="card-unit">#{listing.unitNumber}</div>}
                        <div className="card-details">
                          {listing.bedroomsTotal > 0 ? `${listing.bedroomsTotal}bd` : "Studio"} · {listing.bathroomsTotalInteger}ba · {listing.livingArea.toLocaleString()}sf
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
