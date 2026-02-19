// Competitor / Keyword Ranking Tracker
// Uses GSC data to track positions for target keywords over time

import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";
import { allTargetKeywords } from "@/data/seo-keywords";
import type { GSCSummary, KeywordRanking, KeywordRankingsSnapshot } from "./types";

/**
 * Extract keyword rankings from GSC data for our target keywords.
 * Compares against previous snapshot to determine trends.
 */
export async function getKeywordRankings(): Promise<KeywordRankingsSnapshot> {
  noStore();

  // Get latest GSC summary
  const latest = await kv.get<GSCSummary>("seo:gsc:latest");

  if (!latest || !latest.topQueries) {
    return {
      date: new Date().toISOString().split("T")[0],
      rankings: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  // Get previous snapshot for trend comparison
  const previous = await kv.get<KeywordRankingsSnapshot>(
    "seo:keyword-rankings:latest"
  );
  const previousMap = new Map(
    previous?.rankings?.map((r) => [r.keyword, r.position]) || []
  );

  // Build query lookup from GSC data
  const gscQueryMap = new Map(
    latest.topQueries.map((q) => [q.query.toLowerCase(), q])
  );

  const rankings: KeywordRanking[] = [];

  for (const keyword of allTargetKeywords) {
    const lowerKeyword = keyword.toLowerCase();
    const gscData = gscQueryMap.get(lowerKeyword);

    if (gscData) {
      const prevPosition = previousMap.get(keyword);
      let trend: KeywordRanking["trend"] = "new";

      if (prevPosition !== undefined) {
        const diff = prevPosition - gscData.position; // positive = improved
        if (diff > 1) trend = "improving";
        else if (diff < -1) trend = "declining";
        else trend = "stable";
      }

      rankings.push({
        keyword,
        position: gscData.position,
        previousPosition: prevPosition,
        impressions: gscData.impressions,
        clicks: gscData.clicks,
        ctr: gscData.impressions > 0 ? gscData.clicks / gscData.impressions : 0,
        trend,
        page: undefined, // Would need page-level data to populate
      });
    } else {
      // Target keyword not found in GSC data — not ranking at all
      rankings.push({
        keyword,
        position: 0,
        previousPosition: previousMap.get(keyword),
        impressions: 0,
        clicks: 0,
        ctr: 0,
        trend: previousMap.has(keyword) ? "declining" : "new",
      });
    }
  }

  // Sort: ranking keywords first (by position), then unranked
  rankings.sort((a, b) => {
    if (a.position === 0 && b.position === 0) return 0;
    if (a.position === 0) return 1;
    if (b.position === 0) return -1;
    return a.position - b.position;
  });

  const snapshot: KeywordRankingsSnapshot = {
    date: latest.date,
    rankings,
    fetchedAt: new Date().toISOString(),
  };

  // Save as latest snapshot
  await kv.set("seo:keyword-rankings:latest", snapshot, { ex: 90 * 86400 });

  return snapshot;
}
