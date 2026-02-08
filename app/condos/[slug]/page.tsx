import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildings, getBuildingBySlug } from "@/data/buildings";
import { nearbyPlaces } from "@/data/nearbyPlaces";
import { floorPlansByBuilding } from "@/data/floorPlans";
import { transactionsByBuilding } from "@/data/transactions";
import HeroSection from "@/components/HeroSection";
import BuildingStats from "@/components/BuildingStats";
import AmenitiesList from "@/components/AmenitiesList";
import ImageGallery from "@/components/ImageGallery";
import FloorPlans from "@/components/FloorPlans";
import NearbyPlaces from "@/components/NearbyPlaces";
import NeighborhoodInfo from "@/components/NeighborhoodInfo";
import PriceHistory from "@/components/PriceHistory";
import ContactForm from "@/components/ContactForm";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return buildings.map((building) => ({
    slug: building.slug,
  }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const building = getBuildingBySlug(params.slug);
  if (!building) return { title: "Building Not Found" };

  return {
    title: `${building.name} | Downtown Austin Condos | Jacob In Austin`,
    description: `${building.name} at ${building.address}. ${building.floors} floors, ${building.units} residences. ${building.description}`,
  };
}

export default function BuildingPage({ params }: PageProps) {
  const building = getBuildingBySlug(params.slug);

  if (!building) {
    notFound();
  }

  return (
    <>
      <HeroSection
        title={building.name}
        subtitle={`${building.address}, ${building.city}, ${building.state} ${building.zip}`}
        backgroundImage={building.heroImage}
      />

      <BuildingStats
        address={`${building.address}, ${building.city}, ${building.state} ${building.zip}`}
        floors={building.floors}
        units={building.units}
        yearBuilt={building.yearBuilt}
        architect={building.architect}
        developer={building.developer}
        builder={building.builder}
        priceRange={building.priceRange}
      />

      {/* About */}
      <section className="section-padding">
        <div className="container-narrow max-w-3xl">
          <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            About {building.name}
          </h2>
          <p className="text-center text-lg leading-relaxed text-secondary">
            {building.description}
          </p>
        </div>
      </section>

      <AmenitiesList amenities={building.amenities} />

      <ImageGallery
        images={building.galleryImages}
        buildingName={building.name}
      />

      <FloorPlans
        buildingName={building.name}
        floorPlans={floorPlansByBuilding[building.slug]}
      />

      <PriceHistory
        buildingName={building.name}
        transactions={transactionsByBuilding[building.slug]}
        floorPlans={floorPlansByBuilding[building.slug]}
      />

      {nearbyPlaces[building.slug] && (
        <NearbyPlaces
          coffee={nearbyPlaces[building.slug].coffee}
          restaurant={nearbyPlaces[building.slug].restaurant}
          bar={nearbyPlaces[building.slug].bar}
        />
      )}

      <NeighborhoodInfo
        neighborhood={building.neighborhood}
        address={`${building.address}, ${building.city}, ${building.state} ${building.zip}`}
      />

      <ContactForm buildingName={building.name} />

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-white px-6 py-8 text-center">
        <a
          href="/"
          className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
        >
          ← Back to All Buildings
        </a>
      </section>
    </>
  );
}
