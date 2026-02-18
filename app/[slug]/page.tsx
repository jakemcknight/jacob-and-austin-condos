import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildings, getBuildingBySlug } from "@/data/buildings";
// import { nearbyPlaces } from "@/data/nearbyPlaces";
import { floorPlans } from "@/data/floorPlans";
import { readMlsCache } from "@/lib/mls/cache";
import HeroSection from "@/components/HeroSection";
import BuildingStats from "@/components/BuildingStats";
import QuickNav from "@/components/QuickNav";
import AmenitiesList from "@/components/AmenitiesList";
import ImageGallery from "@/components/ImageGallery";
import FloorPlans from "@/components/FloorPlans";
import ActiveListings from "@/components/ActiveListings";
// import NearbyPlaces from "@/components/NearbyPlaces";
import NeighborhoodInfo from "@/components/NeighborhoodInfo";
import ContactForm from "@/components/ContactForm";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return buildings.map((building) => ({
    slug: building.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const building = getBuildingBySlug(params.slug);
  if (!building) return { title: "Building Not Found" };

  const description = `${building.name} at ${building.address}. ${building.floors} floors, ${building.units} residences. ${building.description}`;

  // Try to find a listing with photos for the OG image
  const cached = await readMlsCache(building.slug);
  const listingWithPhotos = cached?.data?.find(l => l.photos && l.photos.length > 0);

  return {
    title: `${building.name} | Downtown Austin Condos | Jacob In Austin`,
    description,
    alternates: {
      canonical: `/${building.slug}`,
    },
    openGraph: {
      title: `${building.name} | Downtown Austin Condos`,
      description,
      images: listingWithPhotos
        ? [`https://jacobinaustin.com/downtown-condos/api/mls/photo/${listingWithPhotos.listingId}/0`]
        : ["/images/og-default.jpg"],
    },
  };
}

export default function BuildingPage({ params }: PageProps) {
  const building = getBuildingBySlug(params.slug);

  if (!building) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: building.name,
    description: building.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: building.address,
      addressLocality: building.city,
      addressRegion: building.state,
      postalCode: building.zip,
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: building.coordinates.lat,
      longitude: building.coordinates.lng,
    },
    numberOfAvailableAccommodation: building.units,
    amenityFeature: building.amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
    })),
    url: `https://jacobinaustin.com/downtown-condos/${building.slug}`,
  };

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
      />

      <QuickNav />

      {/* About */}
      <section id="about" className="section-padding">
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
        buildingSlug={building.slug}
        floorPlans={floorPlans[building.slug]}
      />

      <ActiveListings buildingSlug={building.slug} />

      {/* {nearbyPlaces[building.slug] && (
        <NearbyPlaces
          coffee={nearbyPlaces[building.slug].coffee}
          restaurant={nearbyPlaces[building.slug].restaurant}
          bar={nearbyPlaces[building.slug].bar}
        />
      )} */}

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

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    </>
  );
}
