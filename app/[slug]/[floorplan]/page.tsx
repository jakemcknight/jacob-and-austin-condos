/**
 * Individual Floor Plan Pages
 *
 * Dynamic route: /downtown-condos/[building-slug]/[floorplan-slug]
 * Example: /downtown-condos/the-independent/a1-1br-697sf-floorplan
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { buildings } from "@/data/buildings";
import {
  getBuildingFloorPlans,
  getFloorPlanBySlug,
  getAllFloorPlanParams,
} from "@/lib/floor-plans";
import { Metadata } from "next";

interface FloorPlanPageProps {
  params: {
    slug: string;
    floorplan: string;
  };
}

// Generate static params for all building × floor plan combinations
export async function generateStaticParams() {
  return getAllFloorPlanParams();
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: FloorPlanPageProps): Promise<Metadata> {
  const building = buildings.find((b) => b.slug === params.slug);
  const floorPlan = building
    ? getFloorPlanBySlug(building.slug, params.floorplan)
    : undefined;

  if (!building || !floorPlan) {
    return {
      title: "Floor Plan Not Found",
      description: "The requested floor plan could not be found.",
    };
  }

  const title = `${building.name} - ${floorPlan.name} Floor Plan (${floorPlan.bedrooms} Bed, ${floorPlan.sqft} SF)`;
  const description = `View the ${floorPlan.name} floor plan at ${building.name}. ${floorPlan.bedrooms} bedroom, ${floorPlan.bathrooms} bathroom, ${floorPlan.sqft} square feet. ${floorPlan.quantity} units available with ${floorPlan.orientation} orientation. Located at ${building.address}, ${building.city}, ${building.state}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [floorPlan.imageUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [floorPlan.imageUrl],
    },
  };
}

export default function FloorPlanPage({ params }: FloorPlanPageProps) {
  const building = buildings.find((b) => b.slug === params.slug);
  const floorPlan = building
    ? getFloorPlanBySlug(building.slug, params.floorplan)
    : undefined;

  if (!building || !floorPlan) {
    notFound();
  }

  // Generate structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: `${building.name} - ${floorPlan.name}`,
    description: `${floorPlan.bedrooms} bedroom, ${floorPlan.bathrooms} bathroom floor plan with ${floorPlan.sqft} square feet`,
    floorSize: {
      "@type": "QuantitativeValue",
      value: floorPlan.sqft,
      unitCode: "SQF",
    },
    numberOfRooms: floorPlan.bedrooms,
    numberOfBathroomsTotal: floorPlan.bathrooms,
    image: floorPlan.imageUrl,
    containedInPlace: {
      "@type": "Residence",
      name: building.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: building.address,
        addressLocality: building.city,
        addressRegion: building.state,
        postalCode: building.zip,
        addressCountry: "US",
      },
    },
  };

  return (
    <>
      <main className="min-h-screen bg-gray-50">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 py-4">
          <nav className="text-sm" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/downtown-condos"
                  className="text-blue-600 hover:underline"
                >
                  Buildings
                </Link>
              </li>
              <li>
                <span className="text-gray-400">&gt;</span>
              </li>
              <li>
                <Link
                  href={`/downtown-condos/${building.slug}`}
                  className="text-blue-600 hover:underline"
                >
                  {building.name}
                </Link>
              </li>
              <li>
                <span className="text-gray-400">&gt;</span>
              </li>
              <li>
                <span className="text-gray-600">
                  {floorPlan.name} Floor Plan
                </span>
              </li>
            </ol>
          </nav>
        </div>

        {/* Floor Plan Details */}
        <section className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Floor Plan Image */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={floorPlan.imageUrl}
                  alt={`${building.name} ${floorPlan.name} floor plan - ${floorPlan.bedrooms} bed, ${floorPlan.sqft} SF`}
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>

            {/* Details Panel */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h1 className="mb-4 text-3xl font-bold text-gray-900">
                {building.name}
              </h1>
              <h2 className="mb-6 text-xl text-gray-700">
                {floorPlan.name} Floor Plan
              </h2>

              <div className="space-y-6">
                {/* Primary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-600">
                      Bedrooms
                    </p>
                    <p className="text-3xl font-semibold text-gray-900">
                      {floorPlan.bedrooms}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-600">
                      Bathrooms
                    </p>
                    <p className="text-3xl font-semibold text-gray-900">
                      {floorPlan.bathrooms}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-600">
                      Square Feet
                    </p>
                    <p className="text-3xl font-semibold text-gray-900">
                      {floorPlan.sqft.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Study Badge */}
                {floorPlan.hasStudy && (
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="font-medium text-blue-900">
                      ✓ Includes Study
                    </p>
                  </div>
                )}

                {/* Building Info */}
                <div className="border-t pt-6">
                  <h3 className="mb-2 text-sm font-medium text-gray-600">
                    Building Details
                  </h3>
                  <p className="text-sm text-gray-900">{building.address}</p>
                  <p className="text-sm text-gray-900">
                    {building.city}, {building.state} {building.zip}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    Built in {building.yearBuilt} • {building.floors} floors •{" "}
                    {building.units} units
                  </p>
                </div>

                {/* Back to Building Button */}
                <div className="border-t pt-6">
                  <Link
                    href={`/downtown-condos/${building.slug}`}
                    className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
                  >
                    ← View All Floor Plans at {building.name}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

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
