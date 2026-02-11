"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { buildings } from "@/data/buildings";
import BuildingCard from "@/components/BuildingCard";
import ContactForm from "@/components/ContactForm";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center bg-gray-100 md:h-[600px]">
      <p className="text-sm uppercase tracking-wider text-gray-400">
        Loading map...
      </p>
    </div>
  ),
});

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "floors" | "yearBuilt">("name");

  const filteredBuildings = useMemo(() => {
    let result = buildings
      .filter((b) => !b.name.startsWith("*"))
      .filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.address.toLowerCase().includes(search.toLowerCase())
      );

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "floors") return b.floors - a.floors;
      return b.yearBuilt - a.yearBuilt;
    });

    return result;
  }, [search, sortBy]);

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[60vh] items-center justify-center bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-black to-gray-900" />
        <div className="relative z-10 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Jacob In Austin
          </p>
          <h1 className="mt-4 text-4xl font-bold uppercase tracking-widest text-white md:text-5xl lg:text-6xl">
            Downtown Austin
            <br />
            Condos
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300">
            Your comprehensive guide to downtown Austin&apos;s premier high-rise
            living. Explore buildings, amenities, and find your next home.
          </p>
          <a
            href="#buildings"
            className="mt-8 inline-block border border-white px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary"
          >
            Explore Buildings
          </a>
        </div>
      </section>

      {/* About Section */}
      <section className="section-padding bg-white">
        <div className="container-narrow max-w-3xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Your Downtown High-Rise Expert
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-secondary">
            With deep expertise in Austin&apos;s downtown high-rise market,
            Jacob provides data-driven insight and exclusive resources to help
            you buy, sell, or lease in the city&apos;s most sought-after
            buildings. From luxury penthouses to modern urban flats, find
            your perfect downtown Austin condo.
          </p>
        </div>
      </section>

      {/* Map View */}
      <section className="border-y border-gray-200">
        <div className="container-narrow px-6 py-12 md:px-12 lg:px-20">
          <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Explore the Map
          </h2>
          <div className="overflow-hidden border border-gray-200">
            <MapView buildings={buildings} />
          </div>
          <p className="mt-4 text-center text-xs text-accent">
            Click a pin to preview a building
          </p>
        </div>
      </section>

      {/* Building Directory */}
      <section id="buildings" className="section-padding bg-light">
        <div className="container-narrow">
          <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            All Buildings
          </h2>

          {/* Search & Filter Bar */}
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              placeholder="Search by name or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 bg-white px-5 py-3 text-sm text-primary outline-none transition-colors focus:border-primary md:max-w-sm"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-accent">
                Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "name" | "floors" | "yearBuilt")
                }
                className="border border-gray-200 bg-white px-4 py-2 text-sm text-primary outline-none transition-colors focus:border-primary"
              >
                <option value="name">Name</option>
                <option value="floors">Most Floors</option>
                <option value="yearBuilt">Newest</option>
              </select>
            </div>
          </div>

          {/* Building Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBuildings.map((building) => (
              <BuildingCard
                key={building.slug}
                name={building.name}
                slug={building.slug}
                address={building.address}
                floors={building.floors}
                units={building.units}
                yearBuilt={building.yearBuilt}
                heroImage={building.heroImage}
              />
            ))}
          </div>

          {filteredBuildings.length === 0 && (
            <p className="py-12 text-center text-sm text-accent">
              No buildings match your search.
            </p>
          )}

          <p className="mt-8 text-center text-sm text-accent">
            Showing {filteredBuildings.length} of {buildings.length} buildings
          </p>
        </div>
      </section>

      {/* Newsletter */}
      <section className="section-padding bg-white">
        <div className="container-narrow max-w-xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Stay Informed
          </h2>
          <p className="mt-4 text-lg text-secondary">
            Get downtown Austin market insights, new listings, and exclusive
            opportunities delivered to your inbox.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 border border-gray-200 bg-white px-5 py-3 text-sm text-primary outline-none transition-colors focus:border-primary"
            />
            <button className="border border-primary bg-primary px-8 py-3 text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-primary">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactForm />
    </>
  );
}
