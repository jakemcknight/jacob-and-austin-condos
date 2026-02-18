// Re-run address matcher on all existing analytics listings
// Use after updating address-matcher.ts or buildings.ts to fix stale buildingSlug assignments

import { NextRequest, NextResponse } from "next/server";
import { buildings } from "@/data/buildings";
import { matchListingToBuilding } from "@/lib/mls/address-matcher";
import { AnalyticsListing } from "@/lib/mls/analytics-types";
import {
  readAnalyticsListings,
  writeAnalyticsListings,
} from "@/lib/mls/analytics-cache";

const AUTH_TOKEN = process.env.CRON_SECRET || "";
const UNMATCHED_SLUG = "_unmatched";

export async function POST(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Load all analytics listings from every building slug + _unmatched
    const allSlugs = [...buildings.map((b) => b.slug), UNMATCHED_SLUG];
    const buildingNameMap = new Map(buildings.map((b) => [b.slug, b.name]));

    const allListings: { slug: string; listings: AnalyticsListing[] }[] = [];
    let totalListings = 0;

    for (const slug of allSlugs) {
      const listings = await readAnalyticsListings(slug);
      if (listings.length > 0) {
        allListings.push({ slug, listings });
        totalListings += listings.length;
      }
    }

    // 2. Re-match every listing and group by new slug
    const rematched = new Map<string, AnalyticsListing[]>();
    const changes: { listingId: string; address: string; from: string; to: string }[] = [];

    for (const { slug: oldSlug, listings } of allListings) {
      for (const listing of listings) {
        // Only match by address — don't pass buildingName since it may be
        // wrong from a previous import and would perpetuate the error
        const newSlug =
          matchListingToBuilding(listing.address) ||
          UNMATCHED_SLUG;

        // Track changes
        const effectiveOldSlug = listing.buildingSlug || UNMATCHED_SLUG;
        if (newSlug !== effectiveOldSlug) {
          changes.push({
            listingId: listing.listingId,
            address: listing.address,
            from: effectiveOldSlug,
            to: newSlug,
          });
        }

        // Update listing fields
        listing.buildingSlug = newSlug === UNMATCHED_SLUG ? null : newSlug;
        listing.buildingName =
          newSlug === UNMATCHED_SLUG
            ? listing.buildingName || "Downtown Austin"
            : buildingNameMap.get(newSlug) || listing.buildingName;

        // Group by new slug
        if (!rematched.has(newSlug)) {
          rematched.set(newSlug, []);
        }
        rematched.get(newSlug)!.push(listing);
      }
    }

    // 3. Write re-grouped listings back to cache
    // First, clear out all slugs that had data (in case a slug is now empty)
    for (const { slug } of allListings) {
      if (!rematched.has(slug)) {
        await writeAnalyticsListings(slug, []);
      }
    }
    // Then write all rematched groups
    const rematchedSlugs = Array.from(rematched.keys());
    for (const slug of rematchedSlugs) {
      await writeAnalyticsListings(slug, rematched.get(slug)!);
    }

    // 4. Summarize changes
    const changeSummary: Record<string, number> = {};
    for (const change of changes) {
      const label = buildingNameMap.get(change.to) || change.to;
      changeSummary[label] = (changeSummary[label] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      totalListings,
      changesCount: changes.length,
      changeSummary,
      changes: changes.slice(0, 50), // First 50 for debugging
    });
  } catch (error) {
    console.error("[Analytics Rematch] Error:", error);
    return NextResponse.json(
      { error: "Re-match failed", details: String(error) },
      { status: 500 }
    );
  }
}
