// Photo proxy for on-demand MLSGrid CDN URLs
// Used by ClosedListingGallery to serve photos for closed/historical listings
// Validates the URL is from a trusted MLSGrid domain before proxying

import { NextRequest, NextResponse } from "next/server";

// Trusted domains for MLSGrid photo CDN
const TRUSTED_DOMAINS = [
  "api.mlsgrid.com",
  "cdn.mlsgrid.com",
  "media.mlsgrid.com",
  "dvvjkgh94f2v6.cloudfront.net",
];

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const decodedUrl = decodeURIComponent(url);

  if (!isTrustedUrl(decodedUrl)) {
    return new NextResponse("Untrusted URL domain", { status: 403 });
  }

  try {
    const imageResponse = await fetch(decodedUrl);

    if (!imageResponse.ok) {
      // Photo token may be expired or listing too old
      return new NextResponse("Photo unavailable", {
        status: 404,
        headers: {
          "Cache-Control": "public, s-maxage=60, max-age=30",
        },
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache at edge for 5 min (tokens expire ~1 hour, but on-demand
        // photos for closed listings don't get refreshed by sync)
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=600, max-age=120",
      },
    });
  } catch (error) {
    console.error("[Photo Proxy] Error:", error);
    return new NextResponse("Failed to fetch photo", { status: 500 });
  }
}
