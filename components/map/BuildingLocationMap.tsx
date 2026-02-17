"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface BuildingLocationMapProps {
  lat: number;
  lng: number;
  buildingName: string;
}

// Zilker green pin SVG
const PIN_SVG = `<svg width="30" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 8.4 12 24 12 24s12-15.6 12-24c0-6.627-5.373-12-12-12zm0 16.5c-2.485 0-4.5-2.015-4.5-4.5S9.515 7.5 12 7.5s4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5z" fill="#324A32"/></svg>`;

export default function BuildingLocationMap({ lat, lng, buildingName }: BuildingLocationMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet")["MapContainer"];
    TileLayer: typeof import("react-leaflet")["TileLayer"];
    Marker: typeof import("react-leaflet")["Marker"];
    Tooltip: typeof import("react-leaflet")["Tooltip"];
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [L, setL] = useState<any>(null);

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
        Tooltip: RL.Tooltip,
      });
    });
  }, []);

  if (!MapComponents || !L) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <p className="text-sm uppercase tracking-wider text-accent">Loading map...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Tooltip } = MapComponents;

  const icon = new L.DivIcon({
    className: "building-location-icon",
    html: `<div style="position:relative;width:30px;height:42px;">${PIN_SVG}</div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42],
  });

  return (
    <div className="relative h-full w-full" style={{ zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .building-location-icon {
          background: none !important;
          border: none !important;
        }
      ` }} />
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} icon={icon}>
          <Tooltip direction="top" offset={[0, -42]} permanent>
            {buildingName}
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}
