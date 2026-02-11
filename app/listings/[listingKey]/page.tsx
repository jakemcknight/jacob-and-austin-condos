import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readMlsCache } from "@/lib/mls/cache";
import { buildings } from "@/data/buildings";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import ContactForm from "@/components/ContactForm";
import Link from "next/link";

interface ListingPageProps {
  params: { listingKey: string };
}

// Helper function to fetch all photos for a listing
async function fetchAllPhotos(listingKey: string): Promise<string[]> {
  const accessToken = process.env.MLSGRID_ACCESS_TOKEN;
  const baseUrl = process.env.MLSGRID_API_URL || "https://api.mlsgrid.com/v2";

  if (!accessToken) {
    return [];
  }

  try {
    const url = `${baseUrl}/Media?$filter=ResourceRecordKey eq '${listingKey}'&$orderby=Order asc&$select=MediaURL`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 900 }, // Cache for 15 minutes
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.value && Array.isArray(data.value)) {
      return data.value
        .filter((item: any) => item.MediaURL)
        .map((item: any) => item.MediaURL);
    }

    return [];
  } catch (error) {
    console.error(`Error fetching photos for ${listingKey}:`, error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  // Find the listing across all building caches
  let listing = null;
  let buildingSlug = null;

  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached) {
      const found = cached.data.find(l => l.mlsNumber === params.listingKey);
      if (found) {
        listing = found;
        buildingSlug = building.slug;
        break;
      }
    }
  }

  if (!listing) {
    return { title: "Listing Not Found" };
  }

  const building = buildings.find(b => b.slug === buildingSlug);
  const title = `${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""} - $${listing.listPrice.toLocaleString()}`;
  const description = `${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo for ${listing.listingType === "Sale" ? "sale" : "lease"} in downtown Austin. ${listing.livingArea.toLocaleString()} sqft at $${listing.priceSf.toFixed(0)}/sqft. MLS# ${listing.mlsNumber}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: listing.photos,
    },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  // Find the listing across all building caches
  let listing = null;
  let buildingSlug = null;

  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached) {
      const found = cached.data.find(l => l.mlsNumber === params.listingKey);
      if (found) {
        listing = found;
        buildingSlug = building.slug;
        break;
      }
    }
  }

  if (!listing) {
    notFound();
  }

  const building = buildings.find(b => b.slug === buildingSlug);

  // Fetch all photos for the listing
  const allPhotos = await fetchAllPhotos(params.listingKey);

  return (
    <>
      {/* Hero Image */}
      <section className="relative h-[60vh] bg-gray-900">
        {allPhotos.length > 0 ? (
          <img
            src={allPhotos[0]}
            alt={`${listing.buildingName || building?.name} ${listing.unitNumber}`}
            className="h-full w-full object-cover opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-6xl">🏙️</div>
              <p className="mt-4 text-lg uppercase tracking-wider text-gray-400">
                {listing.buildingName || building?.name}
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Listing Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <div className="container mx-auto max-w-6xl">
            <h1 className="text-4xl font-bold md:text-5xl">
              {listing.buildingName || building?.name}
              {listing.unitNumber && <span className="ml-2">#{listing.unitNumber}</span>}
            </h1>
            <p className="mt-2 text-xl text-gray-200">{listing.address}</p>
            <div className="mt-4 text-3xl font-bold">
              ${listing.listPrice.toLocaleString()}
              {listing.listingType === "Lease" && <span className="text-xl font-normal">/month</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Listing Details */}
      <section className="section-padding bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Info */}
            <div className="lg:col-span-2">
              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{listing.bedroomsTotal}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Bedrooms</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{listing.bathroomsTotalInteger}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Bathrooms</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{listing.livingArea.toLocaleString()}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Sq Ft</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">${listing.priceSf.toFixed(0)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Price/SF</p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-8 space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">MLS Number</h3>
                  <p className="mt-1 text-lg text-primary">{listing.mlsNumber}</p>
                </div>

                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Status</h3>
                  <p className="mt-1 text-lg text-primary">{listing.status}</p>
                </div>

                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Days on Market</h3>
                  <p className="mt-1 text-lg text-primary">{listing.daysOnMarket}</p>
                </div>

                {listing.hoaFee && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">HOA Fee</h3>
                    <p className="mt-1 text-lg text-primary">${listing.hoaFee.toLocaleString()}/month</p>
                  </div>
                )}

                {listing.parkingFeatures && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Parking</h3>
                    <p className="mt-1 text-lg text-primary">{listing.parkingFeatures}</p>
                  </div>
                )}
              </div>

              {/* Photo Gallery */}
              {allPhotos.length > 1 && (
                <div className="mt-8">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">Photos</h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {allPhotos.slice(1).map((photo, index) => (
                      <div key={index} className="aspect-[4/3] overflow-hidden rounded border border-gray-200">
                        <img
                          src={photo}
                          alt={`Photo ${index + 2}`}
                          className="h-full w-full object-cover transition hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Building Link */}
                {building && (
                  <div className="rounded border border-gray-200 bg-white p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Building</h3>
                    <Link
                      href={`/${buildingSlug}`}
                      className="mt-2 block text-lg font-semibold text-primary hover:text-accent"
                    >
                      {building.name} →
                    </Link>
                    <p className="mt-2 text-sm text-secondary">{building.address}</p>
                  </div>
                )}

                {/* Contact CTA */}
                <div className="rounded border border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Interested?</h3>
                  <p className="mt-2 text-sm text-secondary">
                    Contact Jacob for more information about this listing.
                  </p>
                  <a
                    href="#contact"
                    className="mt-4 block rounded bg-primary py-3 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-accent"
                  >
                    Contact Agent
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <div id="contact">
        <ContactForm buildingName={listing.buildingName || building?.name} />
      </div>

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-white px-6 py-8 text-center">
        {building && (
          <Link
            href={`/${buildingSlug}`}
            className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary"
          >
            ← Back to {building.name}
          </Link>
        )}
      </section>
    </>
  );
}
