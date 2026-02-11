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

      // Create simple Zilker green marker
      const svgIcon = `
        <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 24 12 24s12-15.6 12-24c0-6.627-5.373-12-12-12zm0 16.5c-2.485 0-4.5-2.015-4.5-4.5S9.515 7.5 12 7.5s4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5z" fill="#324A32"/>
        </svg>
      `;
      const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgIcon);

      const customIcon = new L.Icon({
        iconUrl: iconUrl,
        iconSize: [24, 36] as [number, number],
        iconAnchor: [12, 36] as [number, number],
        popupAnchor: [0, -36] as [number, number],
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
          border-radius: 4px !important;
          padding: 1px !important;
        }
        .leaflet-popup-content {
          margin: 14px !important;
          font-family: inherit !important;
        }
      ` }} />
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {buildings.map((building) => (
        <Marker
          key={building.slug}
          position={[building.coordinates.lat, building.coordinates.lng]}
          icon={icon}
        >
          <Popup>
            <div className="w-56">
              <h3 className="text-sm font-semibold text-gray-900">
                {building.name}
              </h3>
              <p className="mt-1 text-xs text-gray-600">{building.address}</p>
              <div className="mt-2 flex gap-2 text-xs text-gray-500">
                <span>{building.floors} floors</span>
                <span>·</span>
                <span>{building.units} units</span>
                <span>·</span>
                <span>{building.yearBuilt}</span>
              </div>
              <Link
                href={`/${building.slug}`}
                className="mt-3 block rounded bg-gray-900 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-700 hover:text-white"
              >
                View Building
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    </div>
  );
}
