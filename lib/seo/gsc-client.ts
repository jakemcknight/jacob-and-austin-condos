// Google Search Console API Client
// Requires GOOGLE_SERVICE_ACCOUNT_JSON env var with service account credentials

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import type { GSCRow, GSCSummary } from "./types";

const SITE_URL = "https://jacobinaustin.com/downtown-condos";
const MAX_ROWS_PER_REQUEST = 25000;

function getAuth(): JWT {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON env var is not set. " +
      "Create a Google Cloud service account, enable Search Console API, " +
      "and store the JSON key in this env var."
    );
  }

  const serviceAccount = JSON.parse(raw);

  return new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

/**
 * Fetch search performance data from GSC for a date range.
 * Paginates automatically to get all results (GSC caps at 25k per request).
 */
export async function getSearchPerformance(
  startDate: string,
  endDate: string,
  dimensions: string[] = ["query", "page"]
): Promise<GSCRow[]> {
  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const allRows: GSCRow[] = [];
  let startRow = 0;

  while (true) {
    const response = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit: MAX_ROWS_PER_REQUEST,
        startRow,
      },
    });

    const rows = response.data.rows;
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      allRows.push({
        keys: row.keys || [],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
    }

    // If we got fewer than the max, we've fetched everything
    if (rows.length < MAX_ROWS_PER_REQUEST) break;
    startRow += rows.length;
  }

  return allRows;
}

/**
 * Build a summary from raw GSC rows.
 * Groups by query and page to find top performers.
 */
export function buildSummary(date: string, rows: GSCRow[]): GSCSummary {
  const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  // Weighted average position (by impressions)
  const weightedPositionSum = rows.reduce(
    (sum, r) => sum + r.position * r.impressions,
    0
  );
  const avgPosition =
    totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

  // Top queries — aggregate by query (keys[0])
  const queryMap = new Map<string, { impressions: number; clicks: number; positionSum: number; count: number }>();
  for (const row of rows) {
    const query = row.keys[0];
    if (!query) continue;
    const existing = queryMap.get(query) || { impressions: 0, clicks: 0, positionSum: 0, count: 0 };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.positionSum += row.position * row.impressions;
    existing.count += row.impressions;
    queryMap.set(query, existing);
  }

  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      impressions: data.impressions,
      clicks: data.clicks,
      position: data.count > 0 ? data.positionSum / data.count : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);

  // Top pages — aggregate by page (keys[1])
  const pageMap = new Map<string, { impressions: number; clicks: number; positionSum: number; count: number }>();
  for (const row of rows) {
    const page = row.keys[1];
    if (!page) continue;
    const existing = pageMap.get(page) || { impressions: 0, clicks: 0, positionSum: 0, count: 0 };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.positionSum += row.position * row.impressions;
    existing.count += row.impressions;
    pageMap.set(page, existing);
  }

  const topPages = Array.from(pageMap.entries())
    .map(([page, data]) => ({
      page,
      impressions: data.impressions,
      clicks: data.clicks,
      position: data.count > 0 ? data.positionSum / data.count : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50);

  return {
    date,
    totalImpressions,
    totalClicks,
    avgCtr,
    avgPosition,
    topQueries,
    topPages,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a formatted date string N days ago (YYYY-MM-DD).
 */
export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}
