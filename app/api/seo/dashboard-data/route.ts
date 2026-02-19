// Dashboard data aggregator
// Returns all SEO data from KV for the dashboard UI

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";

export async function GET() {
  noStore();

  try {
    // Fetch all latest data in parallel
    const [gsc, pagespeed, gaps] = await Promise.all([
      kv.get("seo:gsc:latest"),
      kv.get("seo:pagespeed:latest"),
      kv.get("seo:content-gaps:latest"),
    ]);

    return NextResponse.json({
      gsc: gsc || null,
      pagespeed: pagespeed || null,
      gaps: gaps || null,
    });
  } catch (error) {
    console.error("[Dashboard Data] Error:", error);
    return NextResponse.json(
      { gsc: null, pagespeed: null, gaps: null },
      { status: 200 } // Return empty data, not error — dashboard handles null state
    );
  }
}
