// Content Gap Analysis API
// Analyzes GSC data to find content opportunities

import { NextResponse } from "next/server";
import { analyzeContentGaps } from "@/lib/seo/content-gaps";

export async function GET() {
  try {
    const analysis = await analyzeContentGaps();

    return NextResponse.json({
      success: true,
      date: analysis.date,
      gapCount: analysis.gaps.length,
      totalOpportunityImpressions: analysis.totalOpportunityImpressions,
      gaps: analysis.gaps,
    });
  } catch (error) {
    console.error("[Content Gaps] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Content gap analysis failed", message },
      { status: 500 }
    );
  }
}
