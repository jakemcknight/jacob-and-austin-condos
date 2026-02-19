// On-demand photo fetch for closed/historical listings
// Returns photo URLs from MLSGrid Media endpoint for a specific listing
// Called by ClosedListingGallery when viewing a listing detail page

import { NextRequest, NextResponse } from "next/server";
import { MLSGridClient } from "@/lib/mls/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { listingId: string } }
) {
  const { listingId } = params;

  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  try {
    const mlsClient = new MLSGridClient();
    const photos = await mlsClient.fetchListingPhotos(listingId);

    return NextResponse.json(
      { photos },
      {
        headers: {
          // Cache at Vercel CDN for 5 min (photo tokens expire ~1 hour)
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error(`[Listing Photos] Error fetching photos for ${listingId}:`, error);
    return NextResponse.json(
      { photos: [], error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
