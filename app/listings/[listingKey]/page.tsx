import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readMlsCache } from "@/lib/mls/cache";
import { readAnalyticsListings } from "@/lib/mls/analytics-cache";
import { buildings } from "@/data/buildings";
import { calculateDaysOnMarket, formatOrientation } from "@/lib/format-dom";
import ContactForm from "@/components/ContactForm";
import ListingGallery from "@/components/ListingGallery";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MLSListing } from "@/lib/mls/types";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";

// Dynamic imports for client components
const BuildingLocationMap = dynamic(
  () => import("@/components/map/BuildingLocationMap"),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-100">
      <p className="text-sm uppercase tracking-wider text-accent">Loading map...</p>
    </div>
  )}
);

const ClosedListingGallery = dynamic(
  () => import("@/components/ClosedListingGallery"),
  { ssr: false, loading: () => (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <div className="flex h-[300px] items-center justify-center rounded-lg bg-gray-100 md:h-[450px]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-accent" />
          <p className="mt-3 text-sm text-gray-400">Loading photos...</p>
        </div>
      </div>
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

// Format date string (YYYY-MM-DD or ISO timestamp) to readable format
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    // Handle both YYYY-MM-DD and full ISO timestamps
    const cleanDate = dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
    const date = new Date(cleanDate + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface FindResult {
  listing: MLSListing | null;
  analyticsListing: AnalyticsListing | null;
  buildingSlug: string | null;
}

/**
 * Search all caches for a listing by MLS number / listing ID.
 * First searches active listing caches, then falls back to analytics caches.
 */
async function findListingByMlsNumber(mlsNumber: string): Promise<FindResult> {
  const cleanNumber = stripMlsPrefix(mlsNumber);

  // 1. Search active listing caches (MLSListing with photos)
  for (const building of buildings) {
    const cached = await readMlsCache(building.slug);
    if (cached) {
      const found = cached.data.find(l => stripMlsPrefix(l.mlsNumber) === cleanNumber);
      if (found) {
        return { listing: found, analyticsListing: null, buildingSlug: building.slug };
      }
    }
  }

  // Also search unmatched active listings
  const unmatched = await readMlsCache("_unmatched");
  if (unmatched) {
    const found = unmatched.data.find(l => stripMlsPrefix(l.mlsNumber) === cleanNumber);
    if (found) {
      return { listing: found, analyticsListing: null, buildingSlug: null };
    }
  }

  // 2. Fallback: search analytics caches (AnalyticsListing — closed/historical)
  for (const building of buildings) {
    const analyticsListings = await readAnalyticsListings(building.slug);
    const found = analyticsListings.find(l => l.listingId === cleanNumber);
    if (found) {
      return { listing: null, analyticsListing: found, buildingSlug: building.slug };
    }
  }

  // Also search unmatched analytics
  const unmatchedAnalytics = await readAnalyticsListings("_unmatched");
  const foundUnmatched = unmatchedAnalytics.find(l => l.listingId === cleanNumber);
  if (foundUnmatched) {
    return { listing: null, analyticsListing: foundUnmatched, buildingSlug: null };
  }

  return { listing: null, analyticsListing: null, buildingSlug: null };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { listing, analyticsListing, buildingSlug } = await findListingByMlsNumber(params.listingKey);

  if (!listing && !analyticsListing) {
    return { title: "Listing Not Found" };
  }

  const building = buildings.find(b => b.slug === buildingSlug);

  if (listing) {
    const title = `${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""} - $${listing.listPrice.toLocaleString()}`;
    const description = `${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo for ${listing.listingType === "Sale" ? "sale" : "lease"} in downtown Austin. ${listing.livingArea.toLocaleString()} sqft at $${listing.priceSf.toFixed(0)}/sqft. MLS# ${stripMlsPrefix(listing.mlsNumber)}`;
    const ogImage = listing.photos && listing.photos.length > 0
      ? `https://jacobinaustin.com/downtown-condos/api/mls/photo/${listing.listingId}/0`
      : `https://jacobinaustin.com/downtown-condos/images/og-default.jpg`;

    return {
      title,
      description,
      alternates: { canonical: `/listings/${stripMlsPrefix(listing.mlsNumber)}` },
      openGraph: { title, description, images: [ogImage] },
      twitter: { card: "summary_large_image", images: [ogImage] },
    };
  }

  // Analytics listing metadata — no close price per Unlock MLS rules
  const al = analyticsListing!;
  const isClosed = al.status === "Closed";
  const statusLabel = isClosed ? "Sold" : al.status;
  const title = `${al.buildingName || building?.name || ""} ${al.unitNumber ? `#${al.unitNumber}` : ""} — ${statusLabel}`;
  const description = `${al.bedroomsTotal} bed, ${al.bathroomsTotalInteger} bath condo ${isClosed ? `sold` : al.status.toLowerCase()} in downtown Austin. ${al.livingArea.toLocaleString()} sqft. ${al.daysOnMarket} days on market. MLS# ${al.listingId}`;

  return {
    title,
    description,
    alternates: { canonical: `/listings/${al.listingId}` },
    openGraph: { title, description },
    twitter: { card: "summary" },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { listing, analyticsListing, buildingSlug } = await findListingByMlsNumber(params.listingKey);

  if (!listing && !analyticsListing) {
    notFound();
  }

  const building = buildings.find(b => b.slug === buildingSlug);

  // ==================== ACTIVE LISTING PATH ====================
  if (listing) {
    return renderActiveListing(listing, building, buildingSlug);
  }

  // ==================== ANALYTICS LISTING PATH ====================
  const al = analyticsListing!;
  return renderAnalyticsListing(al, building, buildingSlug);
}

// ================================================================
// Active Listing Renderer (existing behavior, unchanged)
// ================================================================
function renderActiveListing(
  listing: MLSListing,
  building: typeof buildings[number] | undefined,
  buildingSlug: string | null
) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""}`.trim(),
    description: listing.publicRemarks || `${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo ${listing.listingType === "Sale" ? "for sale" : "for lease"} in downtown Austin`,
    url: `https://jacobinaustin.com/downtown-condos/listings/${stripMlsPrefix(listing.mlsNumber)}`,
    datePosted: listing.listDate,
    about: {
      "@type": "Apartment",
      name: `${listing.buildingName || building?.name || ""} Unit ${listing.unitNumber || ""}`.trim(),
      numberOfRooms: listing.bedroomsTotal,
      numberOfBathroomsTotal: listing.bathroomsTotalInteger,
      floorSize: { "@type": "QuantitativeValue", value: listing.livingArea, unitCode: "SQF" },
      address: {
        "@type": "PostalAddress",
        streetAddress: listing.address + (listing.unitNumber ? ` #${listing.unitNumber}` : ""),
        addressLocality: listing.city || building?.city || "Austin",
        addressRegion: building?.state || "TX",
        postalCode: listing.postalCode || building?.zip || "",
        addressCountry: "US",
      },
      ...(building?.coordinates ? { geo: { "@type": "GeoCoordinates", latitude: building.coordinates.lat, longitude: building.coordinates.lng } } : {}),
      ...(listing.photos && listing.photos.length > 0 ? { image: `https://jacobinaustin.com/downtown-condos/api/mls/photo/${listing.listingId}/0` } : {}),
    },
    offers: {
      "@type": "Offer",
      price: listing.listPrice,
      priceCurrency: "USD",
      availability: listing.status === "Active" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
    },
  };

  const allPhotos = listing.photos || [];

  const propertyDetails: { label: string; value: string }[] = [];
  propertyDetails.push({ label: "Status", value: listing.status });
  const dom = calculateDaysOnMarket(listing.listDate);
  propertyDetails.push({ label: "Days on Market", value: String(dom) });
  if (listing.listDate) propertyDetails.push({ label: "List Date", value: formatDate(listing.listDate) });
  if (listing.yearBuilt) propertyDetails.push({ label: "Year Built", value: String(listing.yearBuilt) });
  if (listing.propertySubType) propertyDetails.push({ label: "Property Type", value: listing.propertySubType });
  if (listing.hoaFee) {
    const freq = listing.associationFeeFrequency ? `/${listing.associationFeeFrequency.toLowerCase()}` : "/month";
    propertyDetails.push({ label: "HOA Fee", value: `$${listing.hoaFee.toLocaleString()}${freq}` });
  }
  if (listing.taxAnnualAmount) {
    const yearStr = listing.taxYear ? ` (${listing.taxYear})` : "";
    propertyDetails.push({ label: "Tax (Annual)", value: `$${listing.taxAnnualAmount.toLocaleString()}${yearStr}` });
  }
  if (listing.parkingFeatures) propertyDetails.push({ label: "Parking", value: listing.parkingFeatures });

  const historyEvents: { date: string; label: string; detail: string }[] = [];
  if (listing.listDate) {
    const originalPrice = listing.originalListPrice && listing.originalListPrice > 0 ? listing.originalListPrice : listing.listPrice;
    historyEvents.push({ date: formatDate(listing.listDate), label: "Listed", detail: `Listed for $${originalPrice.toLocaleString()}` });
  }
  if (listing.originalListPrice && listing.originalListPrice > 0 && listing.originalListPrice !== listing.listPrice) {
    const direction = listing.listPrice - listing.originalListPrice > 0 ? "increased" : "reduced";
    historyEvents.push({ date: "", label: `Price ${direction}`, detail: `Price ${direction} to $${listing.listPrice.toLocaleString()}` });
  }
  historyEvents.push({ date: "Now", label: listing.status, detail: `${listing.status} · ${dom} days on market` });
  historyEvents.reverse();

  return (
    <>
      <div className="bg-light pb-6 md:pb-8">
        <ListingGallery listingId={listing.listingId} photos={allPhotos} buildingName={listing.buildingName || building?.name || ""} unitNumber={listing.unitNumber} />
      </div>
      <section className="bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-primary md:text-4xl">
                  {listing.buildingName || building?.name}
                  {listing.unitNumber && <span className="ml-2">#{listing.unitNumber}</span>}
                </h1>
                <p className="mt-1 text-secondary">
                  {listing.address}{listing.unitNumber && ` #${listing.unitNumber}`}
                  {(listing.city || building?.city) && `, ${listing.city || building?.city}`}
                  {building?.state && `, ${building.state}`}
                  {(listing.postalCode || building?.zip) && ` ${listing.postalCode || building?.zip}`}
                </p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  ${listing.listPrice.toLocaleString()}
                  {listing.listingType === "Lease" && <span className="text-lg font-normal">/month</span>}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center"><p className="text-2xl font-bold text-primary">{listing.bedroomsTotal}</p><p className="mt-1 text-xs uppercase tracking-wider text-accent">Bedrooms</p></div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center"><p className="text-2xl font-bold text-primary">{listing.bathroomsTotalInteger}</p><p className="mt-1 text-xs uppercase tracking-wider text-accent">Bathrooms</p></div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center"><p className="text-2xl font-bold text-primary">{listing.livingArea.toLocaleString()}</p><p className="mt-1 text-xs uppercase tracking-wider text-accent">Sq Ft</p></div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center"><p className="text-2xl font-bold text-primary">${listing.priceSf.toFixed(0)}</p><p className="mt-1 text-xs uppercase tracking-wider text-accent">Price/SF</p></div>
              </div>
              {listing.floorPlan && (
                <div className="mt-8 rounded border-l-4 border-accent bg-accent/5 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Insight by Jacob</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-sm text-secondary"><span className="font-medium text-primary">Floor Plan:</span> {listing.floorPlan}</span>
                    {listing.orientation && <span className="text-sm text-secondary"><span className="font-medium text-primary">Orientation:</span> {formatOrientation(listing.orientation!)}</span>}
                  </div>
                  {listing.floorPlanSlug && buildingSlug && (
                    <Link href={`/${buildingSlug}/${listing.floorPlanSlug}`} className="mt-3 inline-block text-sm font-semibold text-accent hover:text-primary">View {listing.floorPlan} Floor Plan →</Link>
                  )}
                </div>
              )}
              {listing.publicRemarks && (
                <div className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">About This Property</h2>
                  <p className="mt-3 whitespace-pre-line text-secondary leading-relaxed">{listing.publicRemarks}</p>
                </div>
              )}
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
              {historyEvents.length > 0 && (
                <div className="mt-8">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">Listing History</h2>
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {historyEvents.map((event, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 ${i === 0 ? "border-zilker bg-zilker" : "border-gray-300 bg-white"}`} />
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-primary">{event.label}</span>
                              {event.date && <span className="text-xs text-secondary">{event.date}</span>}
                            </div>
                            <p className="mt-0.5 text-sm text-secondary">{event.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-8 border-t border-gray-200 pt-6 text-sm text-secondary">
                {(listing.listAgentFullName || listing.listOfficeName) && (
                  <p>Listed by: {listing.listAgentFullName}{listing.listAgentDirectPhone && ` (${listing.listAgentDirectPhone})`}{listing.listOfficeName && <>, {listing.listOfficeName}{listing.listOfficePhone && ` (${listing.listOfficePhone})`}</>}</p>
                )}
                <p className={listing.listAgentFullName || listing.listOfficeName ? "mt-1" : ""}>Source: Unlock MLS, MLS#: {stripMlsPrefix(listing.mlsNumber)}</p>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {building && building.coordinates && (
                  <div className="overflow-hidden rounded border border-gray-200"><div className="h-[200px] md:h-[250px]"><BuildingLocationMap lat={building.coordinates.lat} lng={building.coordinates.lng} buildingName={building.name} /></div></div>
                )}
                {building && (
                  <div className="rounded border border-gray-200 bg-white p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Building</h3>
                    <Link href={`/${buildingSlug}`} className="mt-2 block text-lg font-semibold text-primary hover:text-accent">{building.name} →</Link>
                    <p className="mt-2 text-sm text-secondary">{building.address}</p>
                  </div>
                )}
                <ShareButton title={`${listing.buildingName || building?.name || ""} ${listing.unitNumber ? `#${listing.unitNumber}` : ""} - $${listing.listPrice.toLocaleString()}`} text={`Check out this ${listing.bedroomsTotal} bed, ${listing.bathroomsTotalInteger} bath condo in downtown Austin`} pageType="listing" listingId={listing.listingId} buildingSlug={buildingSlug || undefined} />
                <div className="rounded border border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Interested?</h3>
                  <p className="mt-2 text-sm text-secondary">Contact Jacob for more information about this listing.</p>
                  <a href="#contact" className="mt-4 block rounded bg-primary py-3 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-accent">Contact Agent</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div id="contact"><ContactForm buildingName={listing.buildingName || building?.name} /></div>
      <section className="border-t border-gray-100 bg-white px-6 py-8 text-center">
        {building && <Link href={`/${buildingSlug}`} className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary">← Back to {building.name}</Link>}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}

// ================================================================
// Analytics (Closed/Historical) Listing Renderer
// ================================================================
function renderAnalyticsListing(
  al: AnalyticsListing,
  building: typeof buildings[number] | undefined,
  buildingSlug: string | null
) {
  const isClosed = al.status === "Closed";
  const isLease = al.propertyType?.toLowerCase().includes("lease");
  // Always show list price publicly — close price hidden per Unlock MLS rules
  const displayPrice = al.listPrice;
  const priceSf = al.livingArea > 0 ? displayPrice / al.livingArea : 0;

  // Status badge styling
  const statusColors: Record<string, string> = {
    "Closed": "bg-green-100 text-green-800",
    "Pending": "bg-yellow-100 text-yellow-800",
    "Active Under Contract": "bg-yellow-100 text-yellow-800",
    "Active": "bg-blue-100 text-blue-800",
    "Withdrawn": "bg-gray-100 text-gray-700",
    "Expired": "bg-gray-100 text-gray-700",
    "Hold": "bg-gray-100 text-gray-700",
    "Canceled": "bg-red-100 text-red-700",
  };
  const badgeClass = statusColors[al.status] || "bg-gray-100 text-gray-700";

  // Property details — no close price or close/list ratios per Unlock MLS rules
  const propertyDetails: { label: string; value: string }[] = [];
  const displayStatus = al.status === "Active Under Contract" ? "Pending" : al.status;
  propertyDetails.push({ label: "Status", value: isClosed ? "Sold" : displayStatus });
  propertyDetails.push({ label: "Days on Market", value: String(al.daysOnMarket) });
  if (al.listingContractDate) propertyDetails.push({ label: "List Date", value: formatDate(al.listingContractDate) });
  if (isClosed && al.closeDate) propertyDetails.push({ label: "Close Date", value: formatDate(al.closeDate) });
  if (al.yearBuilt) propertyDetails.push({ label: "Year Built", value: String(al.yearBuilt) });
  if (al.propertySubType) propertyDetails.push({ label: "Property Type", value: al.propertySubType });
  if (al.hoaFee) {
    const freq = al.associationFeeFrequency ? `/${al.associationFeeFrequency.toLowerCase()}` : "/month";
    propertyDetails.push({ label: "HOA Fee", value: `$${al.hoaFee.toLocaleString()}${freq}` });
  }
  if (al.parkingFeatures) propertyDetails.push({ label: "Parking", value: al.parkingFeatures });
  if (al.buyerFinancing) propertyDetails.push({ label: "Buyer Financing", value: al.buyerFinancing });

  // Build listing history timeline — no close price per Unlock MLS rules
  const historyEvents: { date: string; label: string; detail: string }[] = [];
  if (al.listingContractDate) {
    const origPrice = al.originalListPrice > 0 ? al.originalListPrice : al.listPrice;
    historyEvents.push({ date: formatDate(al.listingContractDate), label: "Listed", detail: `Listed for $${origPrice.toLocaleString()}` });
  }
  if (al.originalListPrice > 0 && al.originalListPrice !== al.listPrice) {
    const direction = al.listPrice > al.originalListPrice ? "increased" : "reduced";
    const priceDate = al.priceChangeTimestamp ? formatDate(al.priceChangeTimestamp) : "";
    historyEvents.push({ date: priceDate, label: `Price ${direction}`, detail: `Price ${direction} to $${al.listPrice.toLocaleString()}` });
  }
  if (al.pendingTimestamp) {
    historyEvents.push({ date: formatDate(al.pendingTimestamp), label: "Pending", detail: "Under contract" });
  }
  if (isClosed && al.closeDate) {
    historyEvents.push({ date: formatDate(al.closeDate), label: "Sold", detail: `Sold after ${al.daysOnMarket} days on market` });
  } else if (al.status === "Withdrawn" || al.status === "Expired" || al.status === "Canceled" || al.status === "Hold") {
    const offDate = al.offMarketDate || al.withdrawnDate || al.cancellationDate || al.holdDate || al.statusChangeTimestamp;
    historyEvents.push({ date: offDate ? formatDate(offDate) : "", label: al.status, detail: `${al.status} after ${al.daysOnMarket} days on market` });
  }
  historyEvents.reverse();

  return (
    <>
      {/* Photo Gallery — on-demand fetch; maxPhotos=1 for Closed per Unlock MLS rules */}
      <div className="bg-light pb-6 md:pb-8">
        <ClosedListingGallery
          listingId={al.listingId}
          buildingName={al.buildingName || building?.name || ""}
          unitNumber={al.unitNumber}
          maxPhotos={isClosed ? 1 : undefined}
        />
      </div>

      {/* Listing Details */}
      <section className="bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Info */}
            <div className="lg:col-span-2">
              {/* Status Badge + Title + Price */}
              <div className="mb-6">
                <span className={`inline-block rounded px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badgeClass}`}>
                  {isClosed ? "Sold" : al.status}
                  {isClosed && al.closeDate && ` · ${formatDate(al.closeDate)}`}
                </span>
                <h1 className="mt-3 text-3xl font-bold text-primary md:text-4xl">
                  {al.buildingName || building?.name}
                  {al.unitNumber && <span className="ml-2">#{al.unitNumber}</span>}
                </h1>
                <p className="mt-1 text-secondary">
                  {al.address}
                  {al.unitNumber && ` #${al.unitNumber}`}
                  {building?.city && `, ${building.city}`}
                  {building?.state && `, ${building.state}`}
                  {building?.zip && ` ${building.zip}`}
                </p>

                {/* Pricing — always list price per Unlock MLS rules */}
                <div className="mt-3">
                  <p className="text-2xl font-bold text-primary">
                    ${al.listPrice.toLocaleString()}
                    {isLease && <span className="text-lg font-normal">/month</span>}
                    {isClosed && <span className="ml-2 text-sm font-normal text-green-700">Sold</span>}
                  </p>
                  {isClosed && (
                    <p className="mt-1 text-xs text-secondary">Last listed price shown per MLS rules</p>
                  )}
                  {al.originalListPrice > 0 && al.originalListPrice !== al.listPrice && (
                    <p className="mt-1 text-sm text-secondary">
                      Originally listed at ${al.originalListPrice.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{al.bedroomsTotal}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Bedrooms</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{al.bathroomsTotalInteger}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Bathrooms</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{al.livingArea.toLocaleString()}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">Sq Ft</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">${priceSf.toFixed(0)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-accent">List $/SF</p>
                </div>
              </div>

              {/* Insight by Jacob — Floor Plan & Orientation */}
              {al.floorPlan && (
                <div className="mt-8 rounded border-l-4 border-accent bg-accent/5 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">Insight by Jacob</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-sm text-secondary">
                      <span className="font-medium text-primary">Floor Plan:</span> {al.floorPlan}
                    </span>
                    {al.orientation && (
                      <span className="text-sm text-secondary">
                        <span className="font-medium text-primary">Orientation:</span> {formatOrientation(al.orientation)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Description / Remarks */}
              {al.publicRemarks && (
                <div className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">About This Property</h2>
                  <p className="mt-3 whitespace-pre-line text-secondary leading-relaxed">{al.publicRemarks}</p>
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
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {historyEvents.map((event, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 ${i === 0 ? "border-zilker bg-zilker" : "border-gray-300 bg-white"}`} />
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-primary">{event.label}</span>
                              {event.date && <span className="text-xs text-secondary">{event.date}</span>}
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
                {(al.listAgentFullName || al.listOfficeName) && (
                  <p>Listed by: {al.listAgentFullName}{al.listOfficeName && <>, {al.listOfficeName}</>}</p>
                )}
                {al.buyerAgentFullName && (
                  <p className="mt-1">Buyer&apos;s agent: {al.buyerAgentFullName}</p>
                )}
                <p className={al.listAgentFullName || al.listOfficeName ? "mt-1" : ""}>
                  Source: Unlock MLS, MLS#: {al.listingId}
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
                      <BuildingLocationMap lat={building.coordinates.lat} lng={building.coordinates.lng} buildingName={building.name} />
                    </div>
                  </div>
                )}

                {/* Building Link */}
                {building && buildingSlug && (
                  <div className="rounded border border-gray-200 bg-white p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">Building</h3>
                    <Link href={`/${buildingSlug}`} className="mt-2 block text-lg font-semibold text-primary hover:text-accent">{building.name} →</Link>
                    <p className="mt-2 text-sm text-secondary">{building.address}</p>
                  </div>
                )}

                {/* Share Button — no close price in share text */}
                <ShareButton
                  title={`${al.buildingName || building?.name || ""} ${al.unitNumber ? `#${al.unitNumber}` : ""} — ${isClosed ? "Sold" : al.status}`}
                  text={`${al.bedroomsTotal} bed, ${al.bathroomsTotalInteger} bath condo in downtown Austin — ${isClosed ? "sold" : al.status.toLowerCase()}`}
                  pageType="listing"
                  listingId={al.listingId}
                  buildingSlug={buildingSlug || undefined}
                />

                {/* Contact CTA */}
                <div className="rounded border border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">
                    {isClosed ? "Similar Unit?" : "Interested?"}
                  </h3>
                  <p className="mt-2 text-sm text-secondary">
                    {isClosed
                      ? "Looking for a similar unit? Contact Jacob for current availability."
                      : "Contact Jacob for more information about this listing."}
                  </p>
                  <a href="#contact" className="mt-4 block rounded bg-primary py-3 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-accent">
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
        <ContactForm buildingName={al.buildingName || building?.name} />
      </div>

      {/* Back Link */}
      <section className="border-t border-gray-100 bg-white px-6 py-8 text-center">
        {building && buildingSlug && (
          <Link href={`/${buildingSlug}`} className="text-sm uppercase tracking-wider text-accent transition-colors hover:text-primary">
            ← Back to {building.name}
          </Link>
        )}
      </section>
    </>
  );
}
