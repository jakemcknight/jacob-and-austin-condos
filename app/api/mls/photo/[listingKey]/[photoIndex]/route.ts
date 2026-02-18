import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { readListingIndex, readMlsCache } from "@/lib/mls/cache";

/**
 * Image proxy for MLSGrid listing photos.
 *
 * Reads photo URLs from the KV cache (populated by the sync cron every 15 min)
 * instead of calling the MLSGrid API directly. This eliminates all MLSGrid API
 * calls from the photo proxy — the only API calls happen during sync.
 *
 * Flow:
 * 1. Look up listingId → buildingSlug from the KV listing index (1 KV read)
 * 2. Read the building's cached listings (1 KV read)
 * 3. Find the listing and get the photo URL at the requested index
 * 4. Fetch image bytes from the media CDN URL (NOT the MLSGrid API)
 * 5. Return image with CDN cache headers
 *
 * Vercel CDN caches the response for 10 minutes (s-maxage=600),
 * so subsequent requests are served from the edge without hitting
 * our serverless function or KV at all.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { listingKey: string; photoIndex: string } }
) {
  // Prevent Next.js Data Cache from caching stale KV reads
  noStore();

  const { listingKey, photoIndex } = params;
  const index = parseInt(photoIndex, 10);

  // Validate inputs
  if (!listingKey || isNaN(index) || index < 0 || index > 50) {
    return new NextResponse("Invalid parameters", { status: 400 });
  }

  // Debug mode: return JSON diagnostics instead of image
  const debug = request.nextUrl.searchParams.get("debug") === "1";

  try {
    // 1. Look up which building this listing belongs to via the KV index
    const listingIndex = await readListingIndex();

    if (!listingIndex) {
      if (debug) {
        return NextResponse.json({
          error: "Listing index not found in KV — sync may not have run yet",
          listingKey,
          index,
        });
      }
      return new NextResponse("Photo not available", { status: 404 });
    }

    const buildingSlug = listingIndex[listingKey];

    if (!buildingSlug) {
      if (debug) {
        return NextResponse.json({
          error: "Listing not found in index",
          listingKey,
          index,
          indexSize: Object.keys(listingIndex).length,
        });
      }
      return new NextResponse("Photo not available", { status: 404 });
    }

    // 2. Read the building's cached listings from KV
    const cached = await readMlsCache(buildingSlug);

    if (!cached) {
      if (debug) {
        return NextResponse.json({
          error: "Building cache not found",
          listingKey,
          buildingSlug,
          index,
        });
      }
      return new NextResponse("Photo not available", { status: 404 });
    }

    // 3. Find the listing and get the photo URL
    const listing = cached.data.find(l => l.listingId === listingKey);

    if (!listing || !listing.photos || index >= listing.photos.length) {
      if (debug) {
        return NextResponse.json({
          error: "Photo not found at index",
          listingKey,
          buildingSlug,
          index,
          listingFound: !!listing,
          totalPhotos: listing?.photos?.length || 0,
        });
      }
      return new NextResponse("No photo available", { status: 404 });
    }

    const photoUrl = listing.photos[index];

    if (debug) {
      return NextResponse.json({
        listingKey,
        buildingSlug,
        index,
        totalPhotos: listing.photos.length,
        photoUrl: photoUrl.substring(0, 100),
        cacheTimestamp: new Date(cached.timestamp).toISOString(),
        cacheAgeMinutes: Math.round((Date.now() - cached.timestamp) / 60000),
      });
    }

    // 4. Fetch image bytes from the media CDN URL (NOT the MLSGrid API)
    const imageResponse = await fetch(photoUrl);

    if (!imageResponse.ok) {
      // Token expired or rate limited — next sync will refresh (within 15 min)
      console.warn(
        `[Photo Proxy] Media CDN returned ${imageResponse.status} for ${listingKey}/${index} — token may be expired or rate limited`
      );
      // Return 404 so frontend onError handlers trigger retry logic.
      // Very short edge cache so retries with cache-bust bypass quickly.
      return new NextResponse("Photo temporarily unavailable", {
        status: 404,
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5, max-age=5",
        },
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";

    // 5. Return image with long CDN cache to prevent rate limiting.
    // s-maxage=3600: Vercel CDN caches for 1 hour (photo tokens last ~1hr).
    // stale-while-revalidate=3600: serve stale for 1 more hour while revalidating
    //   in the background, so users never see a gap even if the token expires.
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=3600, max-age=300",
        "CDN-Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=3600",
        "Vercel-CDN-Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error(`[Photo Proxy] Error for ${listingKey}/${index}:`, error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
