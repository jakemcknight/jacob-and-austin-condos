"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { Building } from "@/data/buildings";

interface LeafletModule {
  Icon: {
    new (options: Record<string, unknown>): unknown;
    Default: {
      prototype: Record<string, unknown>;
      mergeOptions: (options: Record<string, string>) => void;
    };
  };
}

interface MapViewProps {
  buildings: Building[];
}

export default function MapView({ buildings }: MapViewProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet")["MapContainer"];
    TileLayer: typeof import("react-leaflet")["TileLayer"];
    Marker: typeof import("react-leaflet")["Marker"];
    Popup: typeof import("react-leaflet")["Popup"];
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [icon, setIcon] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([L, RL]) => {
      const leaflet = L as unknown as LeafletModule;

      delete leaflet.Icon.Default.prototype._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      // Create custom Zilker green marker
      const svgIcon = `
        <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.437 12.5 28.5 12.5 28.5S25 20.937 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#324A32"/>
          <circle cx="12.5" cy="12.5" r="4" fill="#E1DDD1"/>
        </svg>
      `;
      const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgIcon);

      const customIcon = new L.Icon({
        iconUrl: iconUrl,
        iconSize: [25, 41] as [number, number],
        iconAnchor: [12, 41] as [number, number],
        popupAnchor: [1, -34] as [number, number],
      });

      setIcon(customIcon);
      setMapComponents({
        MapContainer: RL.MapContainer,
        TileLayer: RL.TileLayer,
        Marker: RL.Marker,
        Popup: RL.Popup,
      });
    });
  }, []);

  if (!MapComponents || !icon) {
    return (
      <div className="flex h-[500px] items-center justify-center bg-gray-100 md:h-[600px]">
        <p className="text-sm uppercase tracking-wider text-accent">
          Loading map...
        </p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  // Center on downtown Austin
  const center: [number, number] = [30.268, -97.745];

  return (
    <div className="relative z-0" style={{ height: "500px", width: "100%" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-popup-content-wrapper {
          background-color: #E1DDD1 !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background-color: #E1DDD1 !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #4A3427 !important;
          font-size: 20px !important;
          padding: 8px 8px 0 0 !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #191919 !important;
        }
      ` }} />
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {buildings.map((building) => (
        <Marker
          key={building.slug}
          position={[building.coordinates.lat, building.coordinates.lng]}
          icon={icon}
        >
          <Popup>
            <div className="w-64" style={{ backgroundColor: '#E1DDD1' }}>
              <div className="mb-3 flex h-32 items-center justify-center" style={{ backgroundColor: '#93B9BC' }}>
                <div className="text-center">
                  <div className="text-4xl">🏙️</div>
                </div>
              </div>
              <div className="px-3 pb-3">
                <h3 className="text-base font-bold uppercase tracking-wide" style={{ color: '#4A3427' }}>
                  {building.name}
                </h3>
                <p className="mt-1 text-xs" style={{ color: '#886752' }}>
                  {building.address}
                </p>
                <div className="mt-3 flex gap-3 text-xs" style={{ color: '#886752' }}>
                  <span>
                    <strong style={{ color: '#4A3427' }}>{building.floors}</strong> Floors
                  </span>
                  <span>·</span>
                  <span>
                    <strong style={{ color: '#4A3427' }}>{building.units}</strong> Units
                  </span>
                  <span>·</span>
                  <span>{building.yearBuilt}</span>
                </div>
                <Link
                  href={`/${building.slug}`}
                  className="mt-4 block py-2 text-center text-xs font-semibold uppercase tracking-widest transition-colors"
                  style={{
                    backgroundColor: '#324A32',
                    color: '#E1DDD1'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#4A3427';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#324A32';
                  }}
                >
                  View Building →
                </Link>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    </div>
  );
}
