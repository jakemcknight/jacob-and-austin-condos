// Daily Google Search Console data sync cron job
// Schedule: 0 2 * * * (daily at 2am UTC)
// Stores daily snapshots + summary in Vercel KV

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getSearchPerformance, buildSummary, getDateDaysAgo } from "@/lib/seo/gsc-client";

const CRON_SECRET = process.env.CRON_SECRET;
const KV_RETENTION_DAYS = 90;

export async function GET(request: Request) {
  // Verify cron authorization
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // GSC data has a ~2-3 day lag, so fetch data from 3 days ago
    const targetDate = getDateDaysAgo(3);

    console.log(`[GSC Sync] Fetching data for ${targetDate}`);

    // Fetch with query + page dimensions
    const rows = await getSearchPerformance(targetDate, targetDate, [
      "query",
      "page",
    ]);

    console.log(`[GSC Sync] Got ${rows.length} rows for ${targetDate}`);

    // Store daily snapshot (raw rows)
    await kv.set(
      `seo:gsc:daily:${targetDate}`,
      { date: targetDate, rows, fetchedAt: new Date().toISOString() },
      { ex: KV_RETENTION_DAYS * 86400 }
    );

    // Build and store summary
    const summary = buildSummary(targetDate, rows);
    await kv.set(
      `seo:gsc:summary:${targetDate}`,
      summary,
      { ex: KV_RETENTION_DAYS * 86400 }
    );

    // Store latest summary reference for quick dashboard access
    await kv.set("seo:gsc:latest", summary);

    console.log(
      `[GSC Sync] Saved: ${summary.totalImpressions} impressions, ${summary.totalClicks} clicks, avg position ${summary.avgPosition.toFixed(1)}`
    );

    return NextResponse.json({
      success: true,
      date: targetDate,
      rowCount: rows.length,
      impressions: summary.totalImpressions,
      clicks: summary.totalClicks,
      avgPosition: Math.round(summary.avgPosition * 10) / 10,
    });
  } catch (error) {
    console.error("[GSC Sync] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    // If it's a credentials error, return helpful message
    if (message.includes("GOOGLE_SERVICE_ACCOUNT_JSON")) {
      return NextResponse.json(
        {
          error: "GSC not configured",
          message:
            "Set GOOGLE_SERVICE_ACCOUNT_JSON env var with your Google service account credentials.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "GSC sync failed", message },
      { status: 500 }
    );
  }
}
