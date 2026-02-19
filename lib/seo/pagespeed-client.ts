// Google PageSpeed Insights API Client
// Free tier: 500 requests/day, no API key required (but recommended for higher quota)

import type { PageSpeedResult, CoreWebVitals } from "./types";

const API_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Key pages to audit
export const AUDIT_URLS = [
  "https://jacobinaustin.com/downtown-condos",
  "https://jacobinaustin.com/downtown-condos/for-sale",
  "https://jacobinaustin.com/downtown-condos/the-independent",
  "https://jacobinaustin.com/downtown-condos/seaholm-residences",
  "https://jacobinaustin.com/downtown-condos/70-rainey",
  "https://jacobinaustin.com/downtown-condos/the-modern-austin",
  "https://jacobinaustin.com/downtown-condos/austin-proper-residences",
];

interface LighthouseAudit {
  id: string;
  numericValue?: number;
  displayValue?: string;
  score?: number;
}

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      seo?: { score?: number };
      accessibility?: { score?: number };
    };
    audits?: Record<string, LighthouseAudit>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
}

/**
 * Run a PageSpeed Insights audit for a single URL.
 */
export async function auditUrl(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<PageSpeedResult> {
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
    // Also request SEO and accessibility categories
  });

  // Add API key if available (higher quota)
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (apiKey) {
    params.set("key", apiKey);
  }

  // Request all categories
  const categories = ["performance", "seo", "accessibility"];
  const categoryParams = categories.map((c) => `category=${c}`).join("&");

  const response = await fetch(`${API_BASE}?${params.toString()}&${categoryParams}`);

  if (!response.ok) {
    throw new Error(
      `PageSpeed API error for ${url}: ${response.status} ${response.statusText}`
    );
  }

  const data: PageSpeedApiResponse = await response.json();

  const lighthouse = data.lighthouseResult;
  const audits = lighthouse?.audits || {};

  // Extract Core Web Vitals from lab data
  const cwv: CoreWebVitals = {
    lcp: audits["largest-contentful-paint"]?.numericValue || 0,
    inp: audits["interaction-to-next-paint"]?.numericValue ||
         audits["total-blocking-time"]?.numericValue || 0, // TBT as INP proxy in lab
    cls: audits["cumulative-layout-shift"]?.numericValue || 0,
  };

  // Try to use field data (CrUX) if available — more accurate
  const fieldMetrics = data.loadingExperience?.metrics;
  if (fieldMetrics) {
    if (fieldMetrics["LARGEST_CONTENTFUL_PAINT_MS"]?.percentile) {
      cwv.lcp = fieldMetrics["LARGEST_CONTENTFUL_PAINT_MS"].percentile;
    }
    if (fieldMetrics["INTERACTION_TO_NEXT_PAINT"]?.percentile) {
      cwv.inp = fieldMetrics["INTERACTION_TO_NEXT_PAINT"].percentile;
    }
    if (fieldMetrics["CUMULATIVE_LAYOUT_SHIFT"]?.percentile) {
      cwv.cls = fieldMetrics["CUMULATIVE_LAYOUT_SHIFT"].percentile / 100; // CrUX reports as percentage
    }
  }

  return {
    url,
    performanceScore: Math.round(
      (lighthouse?.categories?.performance?.score || 0) * 100
    ),
    seoScore: Math.round(
      (lighthouse?.categories?.seo?.score || 0) * 100
    ),
    accessibilityScore: Math.round(
      (lighthouse?.categories?.accessibility?.score || 0) * 100
    ),
    coreWebVitals: cwv,
    lcpElement: audits["largest-contentful-paint"]?.displayValue,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Audit all key pages. Runs sequentially to avoid rate limits.
 */
export async function auditAllPages(): Promise<PageSpeedResult[]> {
  const results: PageSpeedResult[] = [];

  for (const url of AUDIT_URLS) {
    try {
      const result = await auditUrl(url, "mobile");
      results.push(result);
      // Delay between requests to avoid rate limiting (429s)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`[PageSpeed] Failed to audit ${url}:`, error);
      // Continue with remaining URLs
    }
  }

  return results;
}
