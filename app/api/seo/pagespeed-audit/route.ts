// Weekly PageSpeed Insights audit cron job
// Schedule: 0 3 * * 0 (Sundays at 3am UTC)
// Audits key pages and stores results in Vercel KV

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { auditAllPages } from "@/lib/seo/pagespeed-client";
import type { PageSpeedAudit } from "@/lib/seo/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("[PageSpeed Audit] Starting weekly audit...");

    const results = await auditAllPages();

    const today = new Date().toISOString().split("T")[0];

    const audit: PageSpeedAudit = {
      date: today,
      results,
      fetchedAt: new Date().toISOString(),
    };

    // Store dated audit (retain for 180 days)
    await kv.set(`seo:pagespeed:${today}`, audit, {
      ex: 180 * 86400,
    });

    // Store as latest for quick dashboard access
    await kv.set("seo:pagespeed:latest", audit);

    const avgPerf =
      results.length > 0
        ? Math.round(
            results.reduce((s, r) => s + r.performanceScore, 0) /
              results.length
          )
        : 0;

    console.log(
      `[PageSpeed Audit] Complete: ${results.length} pages audited, avg performance score: ${avgPerf}`
    );

    return NextResponse.json({
      success: true,
      date: today,
      pagesAudited: results.length,
      avgPerformanceScore: avgPerf,
      results: results.map((r) => ({
        url: r.url,
        performance: r.performanceScore,
        seo: r.seoScore,
        lcp: Math.round(r.coreWebVitals.lcp),
        cls: r.coreWebVitals.cls.toFixed(3),
      })),
    });
  } catch (error) {
    console.error("[PageSpeed Audit] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "PageSpeed audit failed", message },
      { status: 500 }
    );
  }
}
