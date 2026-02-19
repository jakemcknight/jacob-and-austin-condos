"use client";

import { useState, useEffect } from "react";
import type {
  GSCSummary,
  PageSpeedAudit,
  ContentGapAnalysis,
  KeywordRankingsSnapshot,
} from "@/lib/seo/types";

type Tab = "overview" | "queries" | "pages" | "pagespeed" | "gaps" | "keywords";

export default function SEODashboard() {
  // Auth state: null = loading, false = not authenticated, true = authenticated
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [gscData, setGscData] = useState<GSCSummary | null>(null);
  const [pagespeedData, setPagespeedData] = useState<PageSpeedAudit | null>(null);
  const [gapsData, setGapsData] = useState<ContentGapAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch dashboard data once authenticated
  useEffect(() => {
    if (authenticated) {
      fetchData();
    }
  }, [authenticated]);

  async function checkAuth() {
    try {
      const res = await fetch("/downtown-condos/api/seo/auth");
      const data = await res.json();
      setAuthenticated(data.authenticated === true);
    } catch {
      setAuthenticated(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/downtown-condos/api/seo/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setAuthenticated(true);
        setPassword("");
      } else {
        const data = await res.json();
        setAuthError(data.error || "Authentication failed");
      }
    } catch {
      setAuthError("Network error — please try again");
    } finally {
      setAuthLoading(false);
    }
  }

  // --- Auth Loading State ---
  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm uppercase tracking-wider text-accent">Loading...</p>
      </div>
    );
  }

  // --- Login Form ---
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
              Admin
            </p>
            <h1 className="mt-1 text-xl font-bold uppercase tracking-widest text-primary">
              SEO Dashboard
            </h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="seo-password"
                className="mb-1 block text-xs uppercase tracking-wider text-gray-500"
              >
                Password
              </label>
              <input
                id="seo-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Enter dashboard password"
                autoFocus
              />
            </div>
            {authError && (
              <p className="text-xs text-red-600">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authLoading || !password}
              className="w-full rounded bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-accent disabled:opacity-50"
            >
              {authLoading ? "Verifying..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data from KV via API
      const res = await fetch("/downtown-condos/api/seo/dashboard-data");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setGscData(data.gsc || null);
      setPagespeedData(data.pagespeed || null);
      setGapsData(data.gaps || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "queries", label: "Top Queries" },
    { id: "pages", label: "Top Pages" },
    { id: "pagespeed", label: "Core Web Vitals" },
    { id: "gaps", label: "Content Gaps" },
    { id: "keywords", label: "Keyword Rankings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-primary px-6 py-10 text-center text-white">
        <p className="text-xs uppercase tracking-[0.4em] text-gray-300">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-widest">
          SEO Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          {gscData
            ? `Last GSC data: ${gscData.date}`
            : "No GSC data yet — set up your service account"}
        </p>
      </section>

      {/* Action Buttons */}
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3">
          <button
            onClick={() => triggerEndpoint("/downtown-condos/api/seo/gsc-sync")}
            className="rounded border border-gray-300 px-4 py-2 text-xs uppercase tracking-wider text-gray-700 transition hover:bg-gray-100"
          >
            Sync GSC Now
          </button>
          <button
            onClick={() => triggerEndpoint("/downtown-condos/api/seo/pagespeed-audit")}
            className="rounded border border-gray-300 px-4 py-2 text-xs uppercase tracking-wider text-gray-700 transition hover:bg-gray-100"
          >
            Run PageSpeed Audit
          </button>
          <button
            onClick={() => triggerEndpoint("/downtown-condos/api/seo/content-gaps")}
            className="rounded border border-gray-300 px-4 py-2 text-xs uppercase tracking-wider text-gray-700 transition hover:bg-gray-100"
          >
            Analyze Content Gaps
          </button>
          <button
            onClick={fetchData}
            className="ml-auto rounded bg-primary px-4 py-2 text-xs uppercase tracking-wider text-white transition hover:bg-accent"
          >
            Refresh Dashboard
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-6">
        <div className="mx-auto flex max-w-6xl gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-xs uppercase tracking-wider transition ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm uppercase tracking-wider text-accent">
              Loading SEO data...
            </p>
          </div>
        ) : error ? (
          <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 rounded bg-red-600 px-4 py-2 text-xs uppercase tracking-wider text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab gsc={gscData} pagespeed={pagespeedData} />}
            {activeTab === "queries" && <QueriesTab gsc={gscData} />}
            {activeTab === "pages" && <PagesTab gsc={gscData} />}
            {activeTab === "pagespeed" && <PageSpeedTab data={pagespeedData} />}
            {activeTab === "gaps" && <GapsTab data={gapsData} />}
            {activeTab === "keywords" && <KeywordsTab gsc={gscData} />}
          </>
        )}
      </div>
    </div>
  );
}

// --- Trigger an API endpoint and show status ---
async function triggerEndpoint(url: string) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    alert(res.ok ? `Success: ${JSON.stringify(data, null, 2)}` : `Error: ${data.error || data.message}`);
  } catch (err) {
    alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

// --- Overview Tab ---
function OverviewTab({
  gsc,
  pagespeed,
}: {
  gsc: GSCSummary | null;
  pagespeed: PageSpeedAudit | null;
}) {
  return (
    <div className="space-y-8">
      {/* GSC Summary Cards */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
          Search Performance
        </h2>
        {gsc ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Impressions"
              value={gsc.totalImpressions.toLocaleString()}
            />
            <MetricCard
              label="Clicks"
              value={gsc.totalClicks.toLocaleString()}
            />
            <MetricCard
              label="Avg CTR"
              value={`${(gsc.avgCtr * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Avg Position"
              value={gsc.avgPosition.toFixed(1)}
            />
          </div>
        ) : (
          <EmptyState message="No GSC data yet. Set up your Google service account and run the sync." />
        )}
      </div>

      {/* PageSpeed Summary */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
          Core Web Vitals
        </h2>
        {pagespeed && pagespeed.results.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pagespeed.results.slice(0, 6).map((r) => (
              <div
                key={r.url}
                className="rounded border border-gray-200 bg-white p-4"
              >
                <p className="truncate text-xs text-gray-500">
                  {r.url.replace("https://jacobinaustin.com/downtown-condos", "")}
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <ScoreBadge label="Perf" score={r.performanceScore} />
                  <ScoreBadge label="SEO" score={r.seoScore} />
                  <ScoreBadge label="A11y" score={r.accessibilityScore} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>LCP: {(r.coreWebVitals.lcp / 1000).toFixed(1)}s</span>
                  <span>CLS: {r.coreWebVitals.cls.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No PageSpeed data yet. Run the audit." />
        )}
      </div>

      {/* Top 5 Queries Quick View */}
      {gsc && gsc.topQueries.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-accent">
            Top Queries
          </h2>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Query</th>
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {gsc.topQueries.slice(0, 10).map((q, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{q.query}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {q.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {q.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PositionBadge position={q.position} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Queries Tab ---
function QueriesTab({ gsc }: { gsc: GSCSummary | null }) {
  if (!gsc || !gsc.topQueries.length) {
    return <EmptyState message="No query data available." />;
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Query</th>
            <th className="px-4 py-3 text-right">Impressions</th>
            <th className="px-4 py-3 text-right">Clicks</th>
            <th className="px-4 py-3 text-right">CTR</th>
            <th className="px-4 py-3 text-right">Avg Position</th>
          </tr>
        </thead>
        <tbody>
          {gsc.topQueries.map((q, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{q.query}</td>
              <td className="px-4 py-3 text-right text-gray-500">
                {q.impressions.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {q.clicks.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {q.impressions > 0
                  ? `${((q.clicks / q.impressions) * 100).toFixed(1)}%`
                  : "0%"}
              </td>
              <td className="px-4 py-3 text-right">
                <PositionBadge position={q.position} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Pages Tab ---
function PagesTab({ gsc }: { gsc: GSCSummary | null }) {
  if (!gsc || !gsc.topPages.length) {
    return <EmptyState message="No page data available." />;
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Page</th>
            <th className="px-4 py-3 text-right">Impressions</th>
            <th className="px-4 py-3 text-right">Clicks</th>
            <th className="px-4 py-3 text-right">CTR</th>
            <th className="px-4 py-3 text-right">Avg Position</th>
          </tr>
        </thead>
        <tbody>
          {gsc.topPages.map((p, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
              <td className="max-w-[300px] truncate px-4 py-3 font-medium">
                <a
                  href={p.page}
                  target="_blank"
                  rel="noopener"
                  className="text-accent hover:underline"
                >
                  {p.page.replace("https://jacobinaustin.com/downtown-condos", "")}
                </a>
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {p.impressions.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {p.clicks.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {p.impressions > 0
                  ? `${((p.clicks / p.impressions) * 100).toFixed(1)}%`
                  : "0%"}
              </td>
              <td className="px-4 py-3 text-right">
                <PositionBadge position={p.position} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- PageSpeed Tab ---
function PageSpeedTab({ data }: { data: PageSpeedAudit | null }) {
  if (!data || !data.results.length) {
    return <EmptyState message="No PageSpeed data yet. Click 'Run PageSpeed Audit' above." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Last audit: {data.date}</p>
      {data.results.map((r) => (
        <div
          key={r.url}
          className="rounded border border-gray-200 bg-white p-6"
        >
          <p className="mb-3 text-sm font-medium">
            {r.url.replace("https://jacobinaustin.com/downtown-condos", "") || "/"}
          </p>
          <div className="flex flex-wrap gap-6">
            <ScoreBadge label="Performance" score={r.performanceScore} large />
            <ScoreBadge label="SEO" score={r.seoScore} large />
            <ScoreBadge label="Accessibility" score={r.accessibilityScore} large />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <CWVMetric
              label="LCP"
              value={`${(r.coreWebVitals.lcp / 1000).toFixed(2)}s`}
              good={r.coreWebVitals.lcp <= 2500}
              poor={r.coreWebVitals.lcp > 4000}
            />
            <CWVMetric
              label="INP/TBT"
              value={`${Math.round(r.coreWebVitals.inp)}ms`}
              good={r.coreWebVitals.inp <= 200}
              poor={r.coreWebVitals.inp > 500}
            />
            <CWVMetric
              label="CLS"
              value={r.coreWebVitals.cls.toFixed(3)}
              good={r.coreWebVitals.cls <= 0.1}
              poor={r.coreWebVitals.cls > 0.25}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Content Gaps Tab ---
function GapsTab({ data }: { data: ContentGapAnalysis | null }) {
  if (!data || !data.gaps.length) {
    return (
      <EmptyState message="No content gaps found yet. Run 'Analyze Content Gaps' after GSC data is synced." />
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {data.gaps.length} content opportunities found •{" "}
        {data.totalOpportunityImpressions.toLocaleString()} total impression opportunity
      </p>
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Query</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Impressions</th>
              <th className="px-4 py-3 text-right">Position</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.gaps.map((gap, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{gap.query}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      gap.type === "question"
                        ? "bg-blue-100 text-blue-700"
                        : gap.type === "building"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {gap.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {gap.impressions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <PositionBadge position={gap.avgPosition} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">
                    {gap.status.replace(/_/g, " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Keywords Tab ---
function KeywordsTab({ gsc }: { gsc: GSCSummary | null }) {
  if (!gsc) {
    return <EmptyState message="No keyword data available. Sync GSC data first." />;
  }

  // Show target keywords from GSC data
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Tracking target keywords from GSC data. Rankings update daily with each GSC sync.
      </p>
      <EmptyState message="Keyword rankings will populate after your first GSC sync. Click 'Sync GSC Now' to get started." />
    </div>
  );
}

// --- Shared Components ---

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-accent">
        {label}
      </p>
    </div>
  );
}

function ScoreBadge({
  label,
  score,
  large,
}: {
  label: string;
  score: number;
  large?: boolean;
}) {
  const color =
    score >= 90
      ? "text-green-600"
      : score >= 50
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="text-center">
      <p className={`${large ? "text-2xl" : "text-lg"} font-bold ${color}`}>
        {score}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function CWVMetric({
  label,
  value,
  good,
  poor,
}: {
  label: string;
  value: string;
  good: boolean;
  poor: boolean;
}) {
  const color = good
    ? "border-green-200 bg-green-50"
    : poor
      ? "border-red-200 bg-red-50"
      : "border-yellow-200 bg-yellow-50";
  const textColor = good
    ? "text-green-700"
    : poor
      ? "text-red-700"
      : "text-yellow-700";

  return (
    <div className={`rounded border p-3 text-center ${color}`}>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  const color =
    position <= 3
      ? "text-green-600 font-bold"
      : position <= 10
        ? "text-yellow-600"
        : "text-red-500";

  return <span className={color}>{position.toFixed(1)}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded border border-dashed border-gray-300 bg-white">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
