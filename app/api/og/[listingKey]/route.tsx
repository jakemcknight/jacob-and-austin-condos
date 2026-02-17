import { NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { readListingIndex, readMlsCache } from "@/lib/mls/cache";

export const dynamic = "force-dynamic";

/**
 * OG Image endpoint for listing social shares.
 *
 * Looks up the first photo URL from the KV cache and tries multiple
 * strategies to serve it:
 *
 * 1. Fetch directly from MLSGrid media CDN → return raw bytes with 24h cache
 * 2. If that fails (rate limited), try our photo proxy (may have Vercel CDN cache)
 * 3. If both fail, redirect to the default OG image
 *
 * Once a successful fetch is cached at Vercel's edge (24h), social crawlers
 * always get a fast 200 regardless of MLSGrid availability.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { listingKey: string } }
) {
  noStore();

  const { listingKey } = params;

  try {
    // 1. Look up listing from KV cache
    const listingIndex = await readListingIndex();
    if (!listingIndex || !listingIndex[listingKey]) {
      return fallbackRedirect();
    }

    const buildingSlug = listingIndex[listingKey];
    const cached = await readMlsCache(buildingSlug);
    if (!cached) {
      return fallbackRedirect();
    }

    const listing = cached.data.find((l) => l.listingId === listingKey);
    if (!listing || !listing.photos || listing.photos.length === 0) {
      return fallbackRedirect();
    }

    const photoUrl = listing.photos[0];

    // 2. Try to fetch the photo directly from MLSGrid media CDN
    const directResult = await tryFetch(photoUrl);
    if (directResult) {
      console.log(`[OG Image] Served photo directly for ${listingKey}: ${(directResult.bytes.byteLength / 1024).toFixed(0)}KB`);
      return imageResponse(directResult.bytes, directResult.contentType);
    }

    // 3. Fallback: try our photo proxy (may have Vercel CDN cached copy)
    const proxyUrl = `https://jacobinaustin.com/downtown-condos/api/mls/photo/${listingKey}/0`;
    const proxyResult = await tryFetch(proxyUrl);
    if (proxyResult) {
      console.log(`[OG Image] Served photo via proxy for ${listingKey}: ${(proxyResult.bytes.byteLength / 1024).toFixed(0)}KB`);
      return imageResponse(proxyResult.bytes, proxyResult.contentType);
    }

    // 4. All fetch attempts failed — redirect to default OG image
    console.warn(`[OG Image] All fetch attempts failed for ${listingKey}, using fallback`);
    return fallbackRedirect();
  } catch (error) {
    console.error(`[OG Image] Error for ${listingKey}:`, error);
    return fallbackRedirect();
  }
}

/**
 * Try to fetch an image URL. Returns bytes + content type, or null on failure.
 */
async function tryFetch(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return { bytes, contentType };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Return image bytes with aggressive 24h CDN cache headers.
 */
function imageResponse(bytes: ArrayBuffer, contentType: string) {
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control":
        "public, s-maxage=86400, stale-while-revalidate=43200, max-age=3600",
      "CDN-Cache-Control":
        "public, s-maxage=86400, stale-while-revalidate=43200",
      "Vercel-CDN-Cache-Control":
        "public, s-maxage=86400, stale-while-revalidate=43200",
    },
  });
}

/**
 * Redirect to the default OG image when listing photo is unavailable.
 */
function fallbackRedirect() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://jacobinaustin.com/downtown-condos/images/og-default.jpg",
      // Short cache so next request tries to fetch the real photo again
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60, max-age=60",
    },
  });
}
