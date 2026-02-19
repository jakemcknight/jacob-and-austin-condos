// SEO System Types

// --- Google Search Console ---

export interface GSCRow {
  keys: string[]; // [query, page, device] depending on dimensions requested
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCDailySnapshot {
  date: string;
  rows: GSCRow[];
  fetchedAt: string;
}

export interface GSCSummary {
  date: string;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: { query: string; impressions: number; clicks: number; position: number }[];
  topPages: { page: string; impressions: number; clicks: number; position: number }[];
  updatedAt: string;
}

// --- PageSpeed Insights ---

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint (ms)
  inp: number; // Interaction to Next Paint (ms)
  cls: number; // Cumulative Layout Shift
}

export interface PageSpeedResult {
  url: string;
  performanceScore: number; // 0-100
  seoScore: number; // 0-100
  accessibilityScore: number; // 0-100
  coreWebVitals: CoreWebVitals;
  lcpElement?: string;
  fetchedAt: string;
}

export interface PageSpeedAudit {
  date: string;
  results: PageSpeedResult[];
  fetchedAt: string;
}

// --- Content Gaps ---

export interface ContentGap {
  query: string;
  impressions: number;
  clicks: number;
  avgPosition: number;
  type: "question" | "keyword" | "building"; // question = PAA-style, keyword = general, building = building-specific
  status: "not_covered" | "draft_in_progress" | "published";
  suggestedSlug?: string;
  publishedUrl?: string;
}

export interface ContentGapAnalysis {
  date: string;
  gaps: ContentGap[];
  totalOpportunityImpressions: number;
  fetchedAt: string;
}

// --- Content Pipeline ---

export interface BlogDraft {
  slug: string;
  topic: string;
  keywords: string[];
  content: string; // MDX content
  status: "gap_identified" | "draft_generated" | "ready_for_review" | "published";
  createdAt: string;
  updatedAt: string;
  sourceGap?: string; // The query that inspired this draft
  performanceMetrics?: {
    impressions: number;
    clicks: number;
    avgPosition: number;
  };
}

// --- Keyword Rankings ---

export interface KeywordRanking {
  keyword: string;
  position: number;
  previousPosition?: number;
  impressions: number;
  clicks: number;
  ctr: number;
  trend: "improving" | "declining" | "stable" | "new";
  page?: string; // Which page ranks for this keyword
}

export interface KeywordRankingsSnapshot {
  date: string;
  rankings: KeywordRanking[];
  fetchedAt: string;
}

// --- SEO Recommendations ---

export interface SEORecommendation {
  type: "title_rewrite" | "content_gap" | "cwv_issue" | "ranking_drop" | "low_ctr" | "high_impression_low_click";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  page?: string;
  query?: string;
  metric?: number;
}
