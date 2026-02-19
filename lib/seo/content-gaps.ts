// Content Gap Analyzer
// Finds search queries with high impressions but no dedicated page on the site

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import type { GSCSummary, ContentGap, ContentGapAnalysis } from "./types";

const QUESTION_WORDS = ["how", "what", "where", "which", "when", "why", "who", "is", "are", "can", "does", "do", "should", "best", "top", "vs"];

/**
 * Analyze GSC data to find content gaps — queries we're getting impressions for
 * but don't have dedicated pages to serve.
 */
export async function analyzeContentGaps(): Promise<ContentGapAnalysis> {
  noStore();

  // Get the latest GSC summary
  const latest = await kv.get<GSCSummary>("seo:gsc:latest");

  if (!latest || !latest.topQueries) {
    return {
      date: new Date().toISOString().split("T")[0],
      gaps: [],
      totalOpportunityImpressions: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Get existing site pages for cross-referencing
  const sitePages = new Set(
    latest.topPages?.map((p) => p.page.toLowerCase()) || []
  );

  const gaps: ContentGap[] = [];

  for (const query of latest.topQueries) {
    // Skip if very low impressions
    if (query.impressions < 3) continue;

    // Determine query type
    const lowerQuery = query.query.toLowerCase();
    const isQuestion = QUESTION_WORDS.some(
      (w) => lowerQuery.startsWith(w + " ") || lowerQuery.includes("?")
    );
    const isBuilding = lowerQuery.includes("austin") && (
      lowerQuery.includes("condo") ||
      lowerQuery.includes("apartment") ||
      lowerQuery.includes("high rise") ||
      lowerQuery.includes("tower")
    );

    // Check if we have a dedicated page for this query
    // A "gap" is when we rank position > 5 (meaning we don't have strong content for it)
    // or when it's a question we could answer with a blog post
    const hasGap = query.position > 5 || isQuestion;

    if (hasGap) {
      // Generate a suggested slug from the query
      const suggestedSlug = lowerQuery
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);

      gaps.push({
        query: query.query,
        impressions: query.impressions,
        clicks: query.clicks,
        avgPosition: query.position,
        type: isQuestion ? "question" : isBuilding ? "building" : "keyword",
        status: "not_covered",
        suggestedSlug,
      });
    }
  }

  // Sort by impressions (highest opportunity first)
  gaps.sort((a, b) => b.impressions - a.impressions);

  const analysis: ContentGapAnalysis = {
    date: new Date().toISOString().split("T")[0],
    gaps: gaps.slice(0, 100), // Top 100 gaps
    totalOpportunityImpressions: gaps.reduce((s, g) => s + g.impressions, 0),
    fetchedAt: new Date().toISOString(),
  };

  // Store in KV
  await kv.set("seo:content-gaps:latest", analysis, { ex: 7 * 86400 });

  return analysis;
}
