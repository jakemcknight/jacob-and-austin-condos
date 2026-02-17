import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readMlsCache } from "@/lib/mls/cache";
import { buildings } from "@/data/buildings";
import { calculateDaysOnMarket, formatOrientation } from "@/lib/format-dom";
import ContactForm from "@/components/ContactForm";
import ListingGallery from "@/components/ListingGallery";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamic import for SSR safety (Leaflet requires window)
const BuildingLocationMap = dynamic(
  () => import("@/components/map/BuildingLocationMap"),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100">
      <p className="text-sm uppercase tracking-wider text-accent">Loading map...</p>
    </div>
  )}
);

interface ListingPageProps {
  params: { listingKey: string };
}

// Strip originating system prefix (e.g. "ACT") from mlsNumber
function stripMlsPrefix(mlsNumber: string): string {
  return mlsNumber.replace(/^[A-Z]+/, "");
}

// Format date string (YYYY-MM-DD) to readable format (Jan 15, 2025)
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Search all building caches + _unmatched for a listing by MLS number.
 * Matches both prefixed (ACT4582237) and clean (4582237) formats.
 * Returns { listing, buildingSlug } or { listing: null, buildingSlug: null }.
 */
async function findListingByMlsNumber(mlsNumber: string) {
  const cleanNumber = stripMlsPrefix(mlsNumber);

  // Search all building caches
  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached) {
      const found = cached.data.find(l => stripMlsPrefix(l.mlsNumber) === cleanNumber);
      if (found) {
        return { listing: found, buildingSlug: building.slug };
      }
    }
  }

  // Also search unmatched listings
  const unmatched = await readMlsCache("_unmatched");
  if (unmatched) {
    const found = unmatched.data.find(l => stripMlsPrefix(l.mlsNumber) === cleanNumber);
    if (found) {
      return { listing: found, buildingSlug: null as string | null };
    }
  }

  return { listing: null, buildingSlug: null as string | null };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { listing, buildingSlug } = await findListingByMlsNumber(params.listingKey);

  if (!listing) {
    return { title: "Listing Not Found" };
  }

  const building = buildings.find(b => b.slug === buildingSlug);
  const title = `${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""} - $${listing.listPrice.toLocaleString()}`;
  const description = `${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo for ${listing.listingType === "Sale" ? "sale" : "lease"} in downtown Austin. ${listing.livingArea.toLocaleString()} sqft at $${listing.priceSf.toFixed(0)}/sqft. MLS# ${stripMlsPrefix(listing.mlsNumber)}`;

  // OG image: use our photo proxy which has Vercel CDN caching.
  // Once cached at the edge, it serves reliably regardless of MLSGrid CDN availability.
  const ogImage = listing.photos && listing.photos.length > 0
    ? `https://jacobinaustin.com/downtown-condos/api/mls/photo/${listing.listingId}/0`
    : `https://jacobinaustin.com/downtown-condos/images/og-default.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImage],
    },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { listing, buildingSlug } = await findListingByMlsNumber(params.listingKey);

  if (!listing) {
    notFound();
  }

  const building = buildings.find(b => b.slug === buildingSlug);

  // Use photos from KV cache (populated by sync cron) — no MLSGrid API call needed
  const allPhotos = listing.photos || [];

  // Build property details rows (only show if value exists)
  const propertyDetails: { label: string; value: string }[] = [];
  propertyDetails.push({ label: "Status", value: listing.status });
  const dom = calculateDaysOnMarket(listing.listDate);
  propertyDetails.push({ label: "Days on Market", value: String(dom) });
  if (listing.listDate) {
    propertyDetails.push({ label: "List Date", value: formatDate(listing.listDate) });
  }
  if (listing.yearBuilt) {
    propertyDetails.push({ label: "Year Built", value: String(listing.yearBuilt) });
  }
  if (listing.propertySubType) {
    propertyDetails.push({ label: "Property Type", value: listing.propertySubType });
  }
  if (listing.hoaFee) {
    const freq = listing.associationFeeFrequency ? `/${listing.associationFeeFrequency.toLowerCase()}` : "/month";
    propertyDetails.push({ label: "HOA Fee", value: `$${listing.hoaFee.toLocaleString()}${freq}` });
  }
  if (listing.taxAnnualAmount) {
    const yearStr = listing.taxYear ? ` (${listing.taxYear})` : "";
    propertyDetails.push({ label: "Tax (Annual)", value: `$${listing.taxAnnualAmount.toLocaleString()}${yearStr}` });
  }
  if (listing.parkingFeatures) {
    propertyDetails.push({ label: "Parking", value: listing.parkingFeatures });
  }

  // Build listing history timeline
  const historyEvents: { date: string; label: string; detail: string }[] = [];
  if (listing.listDate) {
    const originalPrice = listing.originalListPrice && listing.originalListPrice > 0
      ? listing.originalListPrice
      : listing.listPrice;
    historyEvents.push({
      date: formatDate(listing.listDate),
      label: "Listed",
      detail: `Listed for $${originalPrice.toLocaleString()}`,
    });
  }
  if (listing.originalListPrice && listing.originalListPrice > 0 && listing.originalListPrice !== listing.listPrice) {
    const diff = listing.listPrice - listing.originalListPrice;
    const direction = diff > 0 ? "increased" : "reduced";
    historyEvents.push({
      date: "",
      label: `Price ${direction}`,
      detail: `Price ${direction} to $${listing.listPrice.toLocaleString()}`,
    });
  }
  historyEvents.push({
    date: "Now",
    label: listing.status,
    detail: `${listing.status} · ${dom} days on market`,
  });

  // Reverse so newest (current status) is at top, list date at bottom
  historyEvents.reverse();

  return (
    <>
      {/* Photo Gallery — tan background with padding below */}
      <div className="bg-light pb-6 md:pb-8">
        <ListingGallery
          listingId={listing.listingId}
          photos={allPhotos}
          buildingName={listing.buildingName || building?.name || ""}
          unitNumber={listing.unitNumber}
        />
      </div>

      {/* Listing Details */}
      <section className="bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Info */}
            <div className="lg:col-span-2">
              {/* Listing Title + Price */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-primary md:text-4xl">
                  {listing.buildingName || building?.name}
                  {listing.unitNumber && <span className="ml-2">#{listing.unitNumber}</span>}
                </h1>
                <p className="mt-1 text-secondary">
                  {listing.address}
                  {listing.unitNumber && ` #${listing.unitNumber}`}
                  {(listing.city || building?.city) && `, ${listing.city || building?.city}`}
                  {(building?.state) && `, ${building.state}`}
                  {(listing.postalCode || building?.zip) && ` ${listing.postalCode || building?.zip}`}
                </p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  ${listing.listPrice.toLocaleString()}
                  {listing.listingType === "Lease" && <span className="text-lg font-normal">/month</span>}
                </p>
              </div>

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

              {/* Insight by Jacob — Floor Plan & Orientation */}
              {listing.floorPlan && (
                <div className="mt-8 rounded border-l-4 border-accent bg-accent/5 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Insight by Jacob</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-sm text-secondary">
                      <span className="font-medium text-primary">Floor Plan:</span> {listing.floorPlan}
                    </span>
                    {listing.orientation && (
                      <span className="text-sm text-secondary">
                        <span className="font-medium text-primary">Orientation:</span> {formatOrientation(listing.orientation!)}
                      </span>
                    )}
                  </div>
                  {listing.floorPlanSlug && buildingSlug && (
                    <Link
                      href={`/${buildingSlug}/${listing.floorPlanSlug}`}
                      className="mt-3 inline-block text-sm font-semibold text-accent hover:text-primary"
                    >
                      View {listing.floorPlan} Floor Plan →
                    </Link>
                  )}
                </div>
              )}

              {/* Description / Remarks */}
              {listing.publicRemarks && (
                <div className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">About This Property</h2>
                  <p className="mt-3 whitespace-pre-line text-secondary leading-relaxed">
                    {listing.publicRemarks}
                  </p>
                </div>
              )}

              {/* Property Details */}
              <div className="mt-8">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">Property Details</h2>
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                  {propertyDetails.map((row) => (
                    <div key={row.label} className="flex justify-between border-b border-gray-100 pb-3">
                      <span className="text-sm text-secondary">{row.label}</span>
                      <span className="text-sm font-medium text-primary">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Listing History */}
              {historyEvents.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">Listing History</h2>
                  <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {historyEvents.map((event, i) => (
                        <div key={i} className="relative">
                          {/* Timeline dot */}
                          <div className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 ${
                            i === 0
                              ? "border-zilker bg-zilker"
                              : "border-gray-300 bg-white"
                          }`} />
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-primary">{event.label}</span>
                              {event.date && (
                                <span className="text-xs text-secondary">{event.date}</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-secondary">{event.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Listing Attribution */}
              <div className="mt-8 border-t border-gray-200 pt-6 text-sm text-secondary">
                {(listing.listAgentFullName || listing.listOfficeName) && (
                  <p>
                    Listed by:{" "}
                    {listing.listAgentFullName}
                    {listing.listAgentDirectPhone && ` (${listing.listAgentDirectPhone})`}
                    {listing.listOfficeName && (
                      <>
                        , {listing.listOfficeName}
                        {listing.listOfficePhone && ` (${listing.listOfficePhone})`}
                      </>
                    )}
                  </p>
                )}
                <p className={listing.listAgentFullName || listing.listOfficeName ? "mt-1" : ""}>
                  Source: Unlock MLS, MLS#: {stripMlsPrefix(listing.mlsNumber)}
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {/* Building Location Map */}
                {building && building.coordinates && (
                  <div className="overflow-hidden rounded border border-gray-200">
                    <div className="h-[200px] md:h-[250px]">
                      <BuildingLocationMap
                        lat={building.coordinates.lat}
                        lng={building.coordinates.lng}
                        buildingName={building.name}
                      />
                    </div>
                  </div>
                )}

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

                {/* Share Button */}
                <ShareButton
                  title={`${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""} - $${listing.listPrice.toLocaleString()}`}
                  text={`Check out this ${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo in downtown Austin`}
                  pageType="listing"
                  listingId={listing.listingId}
                  buildingSlug={buildingSlug || undefined}
                />

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
