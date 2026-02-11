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

      const customIcon = new L.Icon({
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        iconSize: [25, 41] as [number, number],
        iconAnchor: [12, 41] as [number, number],
        popupAnchor: [1, -34] as [number, number],
        shadowSize: [41, 41] as [number, number],
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
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
              <div className="mb-2 flex h-28 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center">
                  <div className="text-3xl">🏙️</div>
                </div>
              </div>
              <h3 className="text-sm font-bold text-black">{building.name}</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {building.address}
              </p>
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span>
                  <strong className="text-gray-700">{building.floors}</strong>{" "}
                  floors
                </span>
                <span>
                  <strong className="text-gray-700">{building.units}</strong>{" "}
                  units
                </span>
                <span>{building.yearBuilt}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-black">
                {building.priceRange}
              </p>
              <Link
                href={`/${building.slug}`}
                className="mt-3 block bg-black py-1.5 text-center text-xs uppercase tracking-wider text-white hover:bg-gray-800"
              >
                View Building →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    </div>
  );
}
