"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import SummaryCards from "@/components/analytics/SummaryCards";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";
import type { StatusScatterListing } from "@/components/MarketChart";
import {
  median,
  computeYearlyBreakdown,
  computeAppreciation,
  getLast12MonthsCutoff,
  type YearlyRow,
} from "@/lib/mls/analytics-computations";
import { buildings as buildingsData } from "@/data/buildings";

// Lazy-load chart
const MarketChart = dynamic(() => import("@/components/MarketChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center border border-gray-200 bg-white">
      <p className="text-sm uppercase tracking-wider text-gray-400">Loading chart...</p>
    </div>
  ),
});

const BEDROOM_COLORS: Record<number, string> = {
  0: "#93B9BC",
  1: "#886752",
  2: "#324A32",
  3: "#4A3427",
  4: "#191919",
  5: "#6B8F71",
};

function bedroomLabel(bed: number): string {
  if (bed === 0) return "Studio";
  if (bed === 1) return "1 Bed";
  return `${bed} Bed`;
}

function formatDollar(val: number): string {
  return "$" + Math.round(val).toLocaleString();
}

function formatPsf(val: number, isLease: boolean): string {
  if (isLease) {
    return "$" + val.toFixed(2);
  }
  return "$" + Math.round(val).toLocaleString();
}

function formatPct(val: number): string {
  return Math.round(val * 100) + "%";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DataV2Page() {
  // Data state
  const [analyticsListings, setAnalyticsListings] = useState<AnalyticsListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncInfo, setSyncInfo] = useState<{ lastSync?: string }>({});

  // Filter state
  const [listingMode, setListingMode] = useState<"buy" | "lease">("buy");
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [activeBedrooms, setActiveBedrooms] = useState<Set<number>>(new Set());
  const [yearFrom, setYearFrom] = useState(2015);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [advancedDates, setAdvancedDates] = useState(false);
  const [dateFrom, setDateFrom] = useState("2015-01-01");
  const [dateTo, setDateTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [metric, setMetric] = useState<"priceSf" | "price">("priceSf");
  const [scatterStatuses, setScatterStatuses] = useState<Set<string>>(new Set());

  // Appreciation state
  const [appreciationRange, setAppreciationRange] = useState<"all" | "5" | "10" | "custom">("5");
  const [appreciationDateFrom, setAppreciationDateFrom] = useState("");
  const [appreciationDateTo, setAppreciationDateTo] = useState("");

  // Dropdown state
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [bedroomOpen, setBedroomOpen] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState("");
  const buildingRef = useRef<HTMLDivElement>(null);
  const bedroomRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buildingRef.current && !buildingRef.current.contains(e.target as Node))
        setBuildingOpen(false);
      if (bedroomRef.current && !bedroomRef.current.contains(e.target as Node))
        setBedroomOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetch("/downtown-condos/api/mls/analytics?status=all")
      .then((r) => r.json())
      .then((analyticsRes) => {
        // Normalize unmatched listings to "Other" so they flow through all analytics
        const knownNames = new Set(buildingsData.map((b) => b.name));
        const listings = (analyticsRes.listings || []).map((l: AnalyticsListing) => {
          if (!l.buildingSlug || l.buildingSlug === "_unmatched" || !knownNames.has(l.buildingName)) {
            return { ...l, buildingName: "Other" };
          }
          return l;
        });
        setAnalyticsListings(listings);
        setSyncInfo({
          lastSync: analyticsRes.syncState?.lastSyncDate || analyticsRes.importState?.lastImportDate,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Derived data
  const allBuildingNames = useMemo(() => {
    const names = new Set<string>();
    for (const l of analyticsListings) {
      if (l.buildingName) names.add(l.buildingName);
    }
    return Array.from(names).sort();
  }, [analyticsListings]);

  const allYears = useMemo(() => {
    const years = new Set<number>();
    for (const l of analyticsListings) {
      const date = l.closeDate || l.listingContractDate;
      if (date) years.add(parseInt(date.substring(0, 4)));
    }
    return Array.from(years).sort((a, b) => a - b);
  }, [analyticsListings]);

  // Effective selections
  const effectiveBuildings = selectedBuildings.size === 0 ? new Set(allBuildingNames) : selectedBuildings;

  // Bedroom counts filtered by building + listing mode (NOT by bedroom — avoids circular dep)
  const filteredBedroomCounts = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    const counts = new Set<number>();
    for (const l of analyticsListings) {
      if (l.propertyType !== targetPropertyType) continue;
      if (!effectiveBuildings.has(l.buildingName)) continue;
      counts.add(l.bedroomsTotal);
    }
    return Array.from(counts).sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsListings, listingMode, effectiveBuildings]);

  const effectiveBedrooms = activeBedrooms.size === 0 ? new Set(filteredBedroomCounts) : activeBedrooms;

  // Clean stale bedroom selections when available bedrooms change
  useEffect(() => {
    if (activeBedrooms.size > 0) {
      const valid = new Set(Array.from(activeBedrooms).filter((b) => filteredBedroomCounts.includes(b)));
      if (valid.size !== activeBedrooms.size) {
        setActiveBedrooms(valid.size > 0 ? valid : new Set());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredBedroomCounts]);

  // Date range helper
  function inDateRange(dateStr: string | undefined): boolean {
    if (!dateStr) return true;
    if (advancedDates) {
      return dateStr >= dateFrom && dateStr <= dateTo;
    }
    const year = parseInt(dateStr.substring(0, 4));
    return year >= yearFrom && year <= yearTo;
  }

  // Filtered analytics listings
  const filteredListings = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    return analyticsListings.filter((l) => {
      if (l.propertyType !== targetPropertyType) return false;
      if (!effectiveBuildings.has(l.buildingName)) return false;
      if (!effectiveBedrooms.has(l.bedroomsTotal)) return false;
      const date = l.closeDate || l.listingContractDate;
      if (!inDateRange(date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsListings, listingMode, effectiveBuildings, effectiveBedrooms, yearFrom, yearTo, advancedDates, dateFrom, dateTo]);

  // Closed listings for Sold tab
  const closedListings = useMemo(
    () => filteredListings.filter((l) => l.status === "Closed"),
    [filteredListings]
  );

  // Last 12 months summary
  const cutoff12 = getLast12MonthsCutoff();
  const last12 = useMemo(
    () => closedListings.filter((l) => l.closeDate && l.closeDate >= cutoff12),
    [closedListings, cutoff12]
  );

  const isLease = listingMode === "lease";

  const summaryStats = useMemo(() => {
    const prices = last12.map((l) => l.closePrice || 0).filter((p) => p > 0);
    const psfs = last12
      .map((l) => (l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0))
      .filter((p) => p > 0);
    const doms = last12.map((l) => l.daysOnMarket).filter((d) => d >= 0);
    const cpLps = last12.map((l) => l.cpLp || 0).filter((c) => c > 0);

    return {
      count: last12.length,
      medianPrice: Math.round(median(prices)),
      medianPsf: median(psfs), // raw value — format at display time
      medianDom: Math.round(median(doms)),
      medianCpLp: median(cpLps),
    };
  }, [last12]);

  // Yearly breakdown
  const yearlyRows = useMemo(() => computeYearlyBreakdown(closedListings), [closedListings]);

  // Convert closedListings to CsvTransaction format for MarketChart
  const chartTransactions = useMemo(() => {
    return closedListings.map((l) => ({
      buildingName: l.buildingName,
      address: l.address,
      unit: l.unitNumber,
      bedrooms: l.bedroomsTotal,
      bathrooms: l.bathroomsTotalInteger,
      closeDate: l.closeDate || "",
      closePrice: l.closePrice || 0,
      livingArea: l.livingArea,
      priceSf: l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0,
      floorPlan: l.floorPlan || "",
      orientation: l.orientation || "",
      year: l.closeDate ? parseInt(l.closeDate.substring(0, 4)) : 0,
      hoaFee: l.hoaFee || 0,
      hoaPsf: l.hoaFee && l.livingArea > 0 ? l.hoaFee / l.livingArea : 0,
      dom: l.daysOnMarket,
      cpLp: l.cpLp || 0,
      cpOlp: l.cpOlp || 0,
    }));
  }, [closedListings]);

  // Status scatter listings for multi-status overlay
  const DIDNT_SELL_STATUSES = ["Withdrawn", "Expired", "Hold", "Canceled"];

  const statusScatterListings = useMemo((): StatusScatterListing[] => {
    if (scatterStatuses.size === 0) return [];
    const result: StatusScatterListing[] = [];

    for (const l of filteredListings) {
      const s = l.status;
      let group: string | null = null;

      if (s === "Closed" && scatterStatuses.has("Closed")) {
        group = "Closed";
      } else if (s === "Active" && scatterStatuses.has("Active")) {
        group = "Active";
      } else if ((s === "Pending" || s === "Active Under Contract") && scatterStatuses.has("Pending")) {
        group = "Pending";
      } else if (DIDNT_SELL_STATUSES.includes(s) && scatterStatuses.has("Didn't Sell")) {
        group = "Didn't Sell";
      }

      if (!group) continue;

      // Closed uses closePrice/closeDate; others use listPrice and last-updated date
      const price = group === "Closed" ? (l.closePrice || 0) : (l.listPrice || 0);
      const date = group === "Closed"
        ? (l.closeDate || l.listingContractDate || "")
        : (l.priceChangeTimestamp || l.statusChangeTimestamp || l.listingContractDate || "");

      if (price <= 0 || !date) continue;

      const priceSf = l.livingArea > 0 ? Math.round(price / l.livingArea) : 0;

      result.push({
        statusGroup: group,
        date,
        price,
        priceSf,
        bedrooms: l.bedroomsTotal,
        unit: l.unitNumber,
        buildingName: l.buildingName,
        livingArea: l.livingArea,
        floorPlan: l.floorPlan || "",
        orientation: l.orientation || "",
        dom: l.daysOnMarket,
      });
    }

    return result;
  }, [filteredListings, scatterStatuses]);

  function toggleScatterStatus(status: string) {
    setScatterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // Sorted transactions for table
  const sortedTransactions = useMemo(() => {
    return [...closedListings].sort((a, b) => {
      const da = a.closeDate || "";
      const db = b.closeDate || "";
      return db.localeCompare(da);
    });
  }, [closedListings]);

  // Appreciation
  const appreciation = useMemo(() => {
    if (yearlyRows.length < 2) return null;
    const ascending = [...yearlyRows].reverse();
    const latestYear = ascending[ascending.length - 1].year;

    let rangeRows = ascending;
    if (appreciationRange === "5") {
      rangeRows = ascending.filter((r) => r.year >= latestYear - 5);
    } else if (appreciationRange === "10") {
      rangeRows = ascending.filter((r) => r.year >= latestYear - 10);
    } else if (appreciationRange === "custom") {
      const fromYr = appreciationDateFrom ? new Date(appreciationDateFrom).getFullYear() : 0;
      const toYr = appreciationDateTo ? new Date(appreciationDateTo).getFullYear() : 9999;
      rangeRows = ascending.filter((r) => r.year >= fromYr && r.year <= toYr);
    }
    if (rangeRows.length < 2) return null;

    const first = rangeRows[0];
    const last = rangeRows[rangeRows.length - 1];
    const years = last.year - first.year;
    if (years <= 0) return null;

    return {
      years,
      firstYear: first.year,
      lastYear: last.year,
      priceSf: computeAppreciation(first.medianPsf, last.medianPsf, years),
      value: computeAppreciation(first.medianPrice, last.medianPrice, years),
      hoaPsf: computeAppreciation(first.medianHoaPsf, last.medianHoaPsf, years),
    };
  }, [yearlyRows, appreciationRange, appreciationDateFrom, appreciationDateTo]);

  // Toggle helpers
  function toggleBuilding(name: string) {
    setSelectedBuildings((prev) => {
      if (prev.size === 0) {
        return new Set(allBuildingNames.filter((b) => b !== name));
      }
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleBedroom(bed: number) {
    setActiveBedrooms((prev) => {
      const next = new Set(prev.size === 0 ? filteredBedroomCounts : prev);
      if (next.has(bed)) {
        next.delete(bed);
        if (next.size === 0) next.add(bed);
      } else {
        next.add(bed);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-light">
        <p className="text-sm uppercase tracking-wider text-accent">Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        {/* Header */}
        <h1 className="text-center text-2xl tracking-tight text-primary md:text-3xl">
          <span className="font-bold">Downtown Austin</span>{" "}
          <span className="font-light">Market Analytics</span>
        </h1>

        {/* Sync info */}
        <div className="mt-2 text-center text-xs text-secondary">
          {syncInfo.lastSync ? (
            <span>
              Last updated: {new Date(syncInfo.lastSync).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          ) : (
            <span>No data loaded — <a href="/downtown-condos/data-v2/import" className="text-accent underline">import data</a></span>
          )}
        </div>

        {/* Global Filters */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Buy / Lease toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setListingMode("buy")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  listingMode === "buy" ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-secondary"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setListingMode("lease")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  listingMode === "lease" ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-secondary"
                }`}
              >
                Lease
              </button>
            </div>

            {/* Building multi-select */}
            <div ref={buildingRef} className="relative">
              <button
                onClick={() => setBuildingOpen((v) => !v)}
                className="flex items-center gap-1 border border-gray-200 bg-white px-4 py-2 text-xs uppercase tracking-wider text-primary"
              >
                {selectedBuildings.size === 0
                  ? "All Downtown Buildings"
                  : selectedBuildings.size <= 2
                    ? Array.from(selectedBuildings).join(", ")
                    : `${selectedBuildings.size} buildings`}
                <svg className="ml-1 h-3 w-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {buildingOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-64 border border-gray-200 bg-white shadow-lg">
                  <div className="sticky top-0 border-b border-gray-100 bg-white p-2">
                    <input
                      type="text"
                      placeholder="Search buildings..."
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                      className="w-full border border-gray-200 px-2 py-1 text-xs text-primary"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {allBuildingNames
                      .filter((n) => n.toLowerCase().includes(buildingSearch.toLowerCase()))
                      .map((name) => (
                        <div key={name} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50">
                          <label className="flex flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedBuildings.size === 0 || selectedBuildings.has(name)}
                              onChange={() => toggleBuilding(name)}
                              className="accent-primary"
                            />
                            <span className="text-primary">{name}</span>
                          </label>
                          <button
                            onClick={() => setSelectedBuildings(new Set([name]))}
                            className="ml-2 text-[10px] tracking-wider text-accent hover:text-primary"
                          >
                            only
                          </button>
                        </div>
                      ))}
                  </div>
                  {selectedBuildings.size > 0 && (
                    <button
                      onClick={() => setSelectedBuildings(new Set())}
                      className="sticky bottom-0 w-full border-t border-gray-100 bg-white px-3 py-1.5 text-left text-xs tracking-wider text-accent hover:text-primary"
                    >
                      Select All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              {!advancedDates ? (
                <>
                  <label className="text-xs uppercase tracking-wider text-accent">From:</label>
                  <select
                    value={yearFrom}
                    onChange={(e) => setYearFrom(Number(e.target.value))}
                    className="border border-gray-200 bg-white px-2 py-2 text-xs text-primary"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <label className="text-xs uppercase tracking-wider text-accent">To:</label>
                  <select
                    value={yearTo}
                    onChange={(e) => setYearTo(Number(e.target.value))}
                    className="border border-gray-200 bg-white px-2 py-2 text-xs text-primary"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs uppercase tracking-wider text-accent">From:</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary" />
                  <label className="text-xs uppercase tracking-wider text-accent">To:</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary" />
                </>
              )}
              <button
                onClick={() => setAdvancedDates((v) => !v)}
                className="text-[10px] tracking-wider text-accent underline underline-offset-2 hover:text-primary"
              >
                {advancedDates ? "Simple" : "Advanced"}
              </button>
            </div>
          </div>

          {/* Row 2: Bedrooms + Metric toggle + Scatter */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Bedroom selector */}
            <div ref={bedroomRef} className="relative">
              <button
                onClick={() => setBedroomOpen((v) => !v)}
                className="flex items-center gap-1 border border-gray-200 bg-white px-4 py-2 text-xs uppercase tracking-wider text-primary"
              >
                {activeBedrooms.size === 0
                  ? "All Bedrooms"
                  : activeBedrooms.size <= 3
                    ? Array.from(activeBedrooms).sort((a, b) => a - b).map((b) => bedroomLabel(b)).join(", ")
                    : `${activeBedrooms.size} selected`}
                <svg className="ml-1 h-3 w-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {bedroomOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 border border-gray-200 bg-white shadow-lg">
                  {filteredBedroomCounts.map((bed) => (
                    <div key={bed} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50">
                      <label className="flex flex-1 cursor-pointer items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: BEDROOM_COLORS[bed] || "#666" }} />
                        <input
                          type="checkbox"
                          checked={activeBedrooms.size === 0 || activeBedrooms.has(bed)}
                          onChange={() => toggleBedroom(bed)}
                          className="accent-primary"
                        />
                        <span className="text-primary">{bedroomLabel(bed)}</span>
                      </label>
                      <button
                        onClick={() => setActiveBedrooms(new Set([bed]))}
                        className="ml-2 text-[10px] tracking-wider text-accent hover:text-primary"
                      >
                        only
                      </button>
                    </div>
                  ))}
                  {activeBedrooms.size > 0 && (
                    <button
                      onClick={() => setActiveBedrooms(new Set())}
                      className="w-full border-t border-gray-100 bg-white px-3 py-1.5 text-left text-xs tracking-wider text-accent hover:text-primary"
                    >
                      Select All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Metric toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMetric("priceSf")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  metric === "priceSf" ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-secondary"
                }`}
              >
                $/SF
              </button>
              <button
                onClick={() => setMetric("price")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  metric === "price" ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-secondary"
                }`}
              >
                {listingMode === "buy" ? "Sale Price" : "Lease Price"}
              </button>
            </div>

            {/* Status scatter toggles */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-accent">Scatter:</span>
              {[
                { key: "Closed", label: "Closed", color: "#7AA0A3" },
                { key: "Active", label: "Active", color: "#324A32" },
                { key: "Pending", label: "Pending", color: "#886752" },
                { key: "Didn't Sell", label: "Didn't Sell", color: "#C4BDA8" },
              ].map(({ key, label, color }) => (
                <label key={key} className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer">
                  <span className="inline-block h-3 w-3 rounded-full border border-gray-300" style={{ backgroundColor: color }} />
                  <input
                    type="checkbox"
                    checked={scatterStatuses.has(key)}
                    onChange={() => toggleScatterStatus(key)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-6">
          {/* Summary Cards */}
          <SummaryCards
            cards={[
              { label: "Transactions (12 Mo)", value: summaryStats.count.toLocaleString() },
              { label: "Median $/SF (12 Mo)", value: formatPsf(summaryStats.medianPsf, isLease) },
              { label: "Median Price (12 Mo)", value: formatDollar(summaryStats.medianPrice) },
              { label: "Median DOM (12 Mo)", value: String(summaryStats.medianDom) },
              { label: "Median CP/LP (12 Mo)", value: summaryStats.medianCpLp > 0 ? formatPct(summaryStats.medianCpLp) : "---" },
            ]}
          />

          {/* Chart */}
          <MarketChart
            transactions={chartTransactions}
            metric={metric}
            showScatter={false}
            activeBedrooms={activeBedrooms.size === 0 ? new Set(filteredBedroomCounts) : activeBedrooms}
            bedroomCounts={filteredBedroomCounts}
            selectedBuildings={Array.from(selectedBuildings)}
            statusScatterListings={statusScatterListings}
            isLease={isLease}
          />

          {/* Yearly Breakdown Table */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Yearly Breakdown
            </h3>
            <div className="max-h-[200px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-accent text-white">
                    {["Year", "Med Value", "$/SF", "TXNs", "HOA $/SF", "DOM", "Med SF", "Volume", "CP/LP", "CP/OLP"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-center font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearlyRows.map((row, i) => (
                    <tr key={row.year} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-1.5 text-center font-medium text-primary">{row.year}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{formatDollar(row.medianPrice)}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{formatPsf(row.medianPsf, isLease)}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{row.count}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{formatPsf(row.medianHoaPsf, isLease)}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{row.medianDom}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{Math.round(row.medianSf).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{formatDollar(row.totalVolume)}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{row.medianCpLp > 0 ? formatPct(row.medianCpLp) : "---"}</td>
                      <td className="px-3 py-1.5 text-center text-primary">{row.medianCpOlp > 0 ? formatPct(row.medianCpOlp) : "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Appreciation */}
          {appreciation && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
                Appreciation ({appreciation.firstYear} – {appreciation.lastYear})
              </h3>
              <div className="mb-3 flex items-center gap-3">
                {(["5", "10", "all", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAppreciationRange(r)}
                    className={`border px-3 py-1 text-xs uppercase tracking-wider ${
                      appreciationRange === r ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-secondary"
                    }`}
                  >
                    {r === "all" ? "All" : r === "custom" ? "Custom" : `${r} Years`}
                  </button>
                ))}
                {appreciationRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={appreciationDateFrom} onChange={(e) => setAppreciationDateFrom(e.target.value)} className="border border-gray-200 bg-white px-2 py-1 text-xs" />
                    <span className="text-xs text-secondary">to</span>
                    <input type="date" value={appreciationDateTo} onChange={(e) => setAppreciationDateTo(e.target.value)} className="border border-gray-200 bg-white px-2 py-1 text-xs" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Median $/SF", data: appreciation.priceSf },
                  { label: "Median Value", data: appreciation.value },
                  { label: "HOA $/SF", data: appreciation.hoaPsf },
                ].map(({ label, data }) => (
                  <div key={label} className="border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wider text-accent">{label}</p>
                    <p className={`mt-1 text-lg font-bold ${data.totalGainPercent >= 0 ? "text-zilker" : "text-red-600"}`}>
                      {data.totalGainPercent >= 0 ? "+" : ""}{data.totalGainPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-secondary">
                      {data.yoyPercent >= 0 ? "+" : ""}{data.yoyPercent.toFixed(1)}% / year
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closed Transactions Table */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Closed Transactions ({closedListings.length})
            </h3>
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-accent text-white">
                    {["Building", "Unit", "Bed", "Bath", "Price", "$/SF", "Close Date", "HOA", "DOM", "Plan", "Dir", "SF"].map((h) => (
                      <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium uppercase tracking-wider ${
                        h === "Building" ? "text-left" : "text-center"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((t, i) => (
                    <tr key={t.listingId + i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="whitespace-nowrap px-2 py-1 text-left text-primary">{t.buildingName}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.unitNumber}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.bedroomsTotal}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.bathroomsTotalInteger}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-center text-primary">{t.closePrice ? formatDollar(t.closePrice) : "---"}</td>
                      <td className="px-2 py-1 text-center text-primary">
                        {t.closePrice && t.livingArea > 0 ? formatPsf(t.closePrice / t.livingArea, isLease) : "---"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-center text-primary">{t.closeDate ? formatDate(t.closeDate) : "---"}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.hoaFee ? `$${t.hoaFee.toLocaleString()}` : "---"}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.daysOnMarket}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.floorPlan || "---"}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.orientation || "---"}</td>
                      <td className="px-2 py-1 text-center text-primary">{t.livingArea > 0 ? t.livingArea.toLocaleString() : "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
