"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SummaryCards from "@/components/analytics/SummaryCards";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";
import type { StatusScatterListing } from "@/components/MarketChart";
import {
  median,
  computeYearlyBreakdown,
  computeAppreciation,
  computeAbsorptionRate,
  computeBuildingComparisonTable,
  getLast12MonthsCutoff,
  type YearlyRow,
  type BuildingMarketRow,
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
  if (bed >= 4) return "4+ Bed";
  return `${bed} Bed`;
}

// Cap bedrooms at 4 (4+ grouped together)
function capBedrooms(bed: number): number {
  return bed >= 4 ? 4 : bed;
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeOrientation(raw: string): string {
  const first = raw.split(",")[0].trim();
  return first.replace(/c$/i, "").toUpperCase();
}

const DIRECTION_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Pick the most recent lifecycle event date for tooltip display. */
function getLatestEventDate(l: AnalyticsListing): string {
  const candidates: string[] = [];
  if (l.closeDate) candidates.push(l.closeDate);
  if (l.statusChangeTimestamp) candidates.push(l.statusChangeTimestamp.substring(0, 10));
  if (l.priceChangeTimestamp) candidates.push(l.priceChangeTimestamp.substring(0, 10));
  if (l.pendingTimestamp) candidates.push(l.pendingTimestamp.substring(0, 10));
  if (l.backOnMarketDate) candidates.push(l.backOnMarketDate.substring(0, 10));
  return candidates.length > 0 ? candidates.sort().pop()! : "";
}

export default function DataPage() {
  const router = useRouter();

  // Data state
  const [analyticsListings, setAnalyticsListings] = useState<AnalyticsListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncInfo, setSyncInfo] = useState<{ lastSync?: string }>({});

  // Filter state
  const [listingMode, setListingMode] = useState<"buy" | "lease">("buy");
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [activeBedrooms, setActiveBedrooms] = useState<Set<number>>(new Set());
  const [activeOrientations, setActiveOrientations] = useState<Set<string>>(new Set());
  const [activeFloorPlans, setActiveFloorPlans] = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState(2015);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [advancedDates, setAdvancedDates] = useState(false);
  const [dateFrom, setDateFrom] = useState("2015-01-01");
  const [dateTo, setDateTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [metric, setMetric] = useState<"priceSf" | "price">("priceSf");
  const [scatterStatuses, setScatterStatuses] = useState<Set<string>>(
    new Set(["Active", "Pending"])
  );

  // Tab state
  const [activeTab, setActiveTab] = useState<"analytics" | "buildings">("analytics");

  // Building comparison sort state
  const [buildingSortKey, setBuildingSortKey] = useState<keyof BuildingMarketRow>("closedLast12");
  const [buildingSortAsc, setBuildingSortAsc] = useState(false);

  // Appreciation state
  const [appreciationRange, setAppreciationRange] = useState<"all" | "5" | "10" | "custom">("5");
  const [appreciationDateFrom, setAppreciationDateFrom] = useState("");
  const [appreciationDateTo, setAppreciationDateTo] = useState("");

  // Dropdown state
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [bedroomOpen, setBedroomOpen] = useState(false);
  const [orientationOpen, setOrientationOpen] = useState(false);
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState("");
  const buildingRef = useRef<HTMLDivElement>(null);
  const bedroomRef = useRef<HTMLDivElement>(null);
  const orientationRef = useRef<HTMLDivElement>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (buildingRef.current && !buildingRef.current.contains(e.target as Node))
        setBuildingOpen(false);
      if (bedroomRef.current && !bedroomRef.current.contains(e.target as Node))
        setBedroomOpen(false);
      if (orientationRef.current && !orientationRef.current.contains(e.target as Node))
        setOrientationOpen(false);
      if (floorPlanRef.current && !floorPlanRef.current.contains(e.target as Node))
        setFloorPlanOpen(false);
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
  // Bedrooms capped at 4 (4+ grouped together)
  const filteredBedroomCounts = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    const counts = new Set<number>();
    for (const l of analyticsListings) {
      if (l.propertyType !== targetPropertyType) continue;
      if (!effectiveBuildings.has(l.buildingName)) continue;
      counts.add(capBedrooms(l.bedroomsTotal));
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

  // Data filtered by building, bedroom, date — but NOT orientation/floorPlan
  // Used to derive available orientations and floor plans without circular deps
  const buildingFilteredData = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    return analyticsListings.filter((l) => {
      if (l.propertyType !== targetPropertyType) return false;
      if (!effectiveBuildings.has(l.buildingName)) return false;
      if (!effectiveBedrooms.has(capBedrooms(l.bedroomsTotal))) return false;
      const date = l.closeDate || l.listingContractDate;
      if (!inDateRange(date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsListings, listingMode, effectiveBuildings, effectiveBedrooms, yearFrom, yearTo, advancedDates, dateFrom, dateTo]);

  // Available orientations from building-filtered data
  const availableOrientations = useMemo(() => {
    const oSet = new Set<string>();
    for (const l of buildingFilteredData) {
      if (l.orientation) oSet.add(normalizeOrientation(l.orientation));
    }
    return DIRECTION_ORDER.filter((d) => oSet.has(d));
  }, [buildingFilteredData]);

  // Available floor plans from building-filtered data
  const availableFloorPlans = useMemo(() => {
    const planMap: Record<string, { key: string; areas: number[] }> = {};
    for (const l of buildingFilteredData) {
      if (!l.floorPlan) continue;
      const key = `${l.buildingName} \u2014 ${l.floorPlan}`;
      if (!planMap[key]) planMap[key] = { key, areas: [] };
      if (l.livingArea > 0) planMap[key].areas.push(l.livingArea);
    }
    return Object.values(planMap)
      .map((p) => {
        const medSf = p.areas.length > 0 ? Math.round(median(p.areas)) : 0;
        return {
          key: p.key,
          sf: medSf,
          label: medSf > 0 ? `${p.key} (${medSf.toLocaleString()} SF)` : p.key,
        };
      })
      .sort((a, b) => a.sf - b.sf);
  }, [buildingFilteredData]);

  // Clean stale orientation selections
  useEffect(() => {
    if (activeOrientations.size > 0) {
      const valid = new Set(Array.from(activeOrientations).filter((o) => availableOrientations.includes(o)));
      if (valid.size !== activeOrientations.size) {
        setActiveOrientations(valid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOrientations]);

  // Clean stale floor plan selections
  useEffect(() => {
    if (activeFloorPlans.size > 0) {
      const validKeys = new Set(availableFloorPlans.map((p) => p.key));
      const valid = new Set(Array.from(activeFloorPlans).filter((fp) => validKeys.has(fp)));
      if (valid.size !== activeFloorPlans.size) {
        setActiveFloorPlans(valid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFloorPlans]);

  // Filtered analytics listings
  const filteredListings = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    return analyticsListings.filter((l) => {
      if (l.propertyType !== targetPropertyType) return false;
      if (!effectiveBuildings.has(l.buildingName)) return false;
      if (!effectiveBedrooms.has(capBedrooms(l.bedroomsTotal))) return false;
      const date = l.closeDate || l.listingContractDate;
      if (!inDateRange(date)) return false;
      // Orientation filter
      if (activeOrientations.size > 0) {
        const norm = l.orientation ? normalizeOrientation(l.orientation) : "";
        if (!norm || !activeOrientations.has(norm)) return false;
      }
      // Floor plan filter
      if (activeFloorPlans.size > 0) {
        const key = l.floorPlan ? `${l.buildingName} \u2014 ${l.floorPlan}` : "";
        if (!key || !activeFloorPlans.has(key)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsListings, listingMode, effectiveBuildings, effectiveBedrooms, yearFrom, yearTo, advancedDates, dateFrom, dateTo, activeOrientations, activeFloorPlans]);

  // Closed listings for Sold tab
  const closedListings = useMemo(
    () => filteredListings.filter((l) => l.status === "Closed"),
    [filteredListings]
  );

  // Active & Pending listings
  const activeListings = useMemo(
    () => filteredListings.filter((l) => l.status === "Active"),
    [filteredListings]
  );
  const pendingListings = useMemo(
    () => filteredListings.filter((l) => l.status === "Pending" || l.status === "Active Under Contract"),
    [filteredListings]
  );

  // Last 12 months summary
  const cutoff12 = getLast12MonthsCutoff();
  const last12 = useMemo(
    () => closedListings.filter((l) => l.closeDate && l.closeDate >= cutoff12),
    [closedListings, cutoff12]
  );

  const isLease = listingMode === "lease";

  // Active market stats
  const activeStats = useMemo(() => {
    const prices = activeListings.map((l) => l.listPrice).filter((p) => p > 0);
    const psfs = activeListings
      .map((l) => (l.livingArea > 0 ? l.listPrice / l.livingArea : 0))
      .filter((p) => p > 0);
    const doms = activeListings.map((l) => l.daysOnMarket).filter((d) => d >= 0);
    return {
      count: activeListings.length,
      medianPrice: Math.round(median(prices)),
      medianPsf: median(psfs),
      medianDom: Math.round(median(doms)),
    };
  }, [activeListings]);

  const pendingStats = useMemo(() => {
    const doms = pendingListings.map((l) => l.daysOnMarket).filter((d) => d >= 0);
    return {
      count: pendingListings.length,
      medianDom: Math.round(median(doms)),
    };
  }, [pendingListings]);

  const absorptionRate = useMemo(() => {
    if (last12.length === 0 || activeListings.length === 0) return null;
    return computeAbsorptionRate(activeListings.length, last12.length);
  }, [activeListings.length, last12.length]);

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
      bedrooms: capBedrooms(l.bedroomsTotal),
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

      // X-axis date: Closed → closeDate, Didn't Sell → off-market date, Active/Pending → original list date
      const price = group === "Closed" ? (l.closePrice || 0) : (l.listPrice || 0);
      const date = group === "Closed"
        ? (l.closeDate || "")
        : group === "Didn't Sell"
          ? (l.statusChangeTimestamp?.substring(0, 10) || l.offMarketDate || "")
          : (l.listingContractDate || "");

      if (price <= 0 || !date) continue;

      const priceSf = l.livingArea > 0 ? price / l.livingArea : 0;

      result.push({
        statusGroup: group,
        date,
        price,
        priceSf,
        bedrooms: capBedrooms(l.bedroomsTotal),
        unit: l.unitNumber,
        buildingName: l.buildingName,
        address: l.address,
        livingArea: l.livingArea,
        floorPlan: l.floorPlan || "",
        orientation: l.orientation || "",
        dom: l.daysOnMarket,
        lastStatusChange: getLatestEventDate(l),
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

  // Building comparison table (unfiltered by building/bedroom/date — portfolio-level view)
  const buildingComparisonRows = useMemo(() => {
    const targetPropertyType = listingMode === "buy" ? "Residential" : "Residential Lease";
    const modeFiltered = analyticsListings.filter(
      (l) => l.propertyType === targetPropertyType
    );
    return computeBuildingComparisonTable(
      modeFiltered,
      buildingsData.map((b) => ({ slug: b.slug, name: b.name }))
    );
  }, [analyticsListings, listingMode]);

  const sortedBuildingRows = useMemo(() => {
    const rows = [...buildingComparisonRows];
    rows.sort((a, b) => {
      let aVal: string | number = a[buildingSortKey];
      let bVal: string | number = b[buildingSortKey];
      if (aVal === Infinity) aVal = 9999;
      if (bVal === Infinity) bVal = 9999;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return buildingSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return buildingSortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return rows;
  }, [buildingComparisonRows, buildingSortKey, buildingSortAsc]);

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

  function toggleOrientation(dir: string) {
    setActiveOrientations((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }

  function toggleFloorPlan(plan: string) {
    setActiveFloorPlans((prev) => {
      const next = new Set(prev);
      if (next.has(plan)) next.delete(plan);
      else next.add(plan);
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
            <span>No data loaded — <a href="/downtown-condos/data/import" className="text-accent underline">import data</a></span>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`rounded-md px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "analytics"
                  ? "bg-accent text-white"
                  : "text-accent hover:text-primary"
              }`}
            >
              Market Analytics
            </button>
            <button
              onClick={() => setActiveTab("buildings")}
              className={`rounded-md px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "buildings"
                  ? "bg-accent text-white"
                  : "text-accent hover:text-primary"
              }`}
            >
              Building Comparison
            </button>
          </div>
        </div>

        {activeTab === "analytics" && (
        <>
        {/* Global Filters */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Buy / Lease toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                onClick={() => setListingMode("buy")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  listingMode === "buy" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setListingMode("lease")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  listingMode === "lease" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                Lease
              </button>
            </div>

            {/* Building multi-select */}
            <div ref={buildingRef} className="relative">
              <button
                onClick={() => setBuildingOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  selectedBuildings.size > 0
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-gray-300 bg-white text-primary hover:border-gray-400"
                }`}
              >
                {selectedBuildings.size === 0
                  ? "All Buildings"
                  : selectedBuildings.size <= 2
                    ? Array.from(selectedBuildings).join(", ")
                    : `${selectedBuildings.size} buildings`}
                <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {buildingOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
                  <div className="sticky top-0 border-b border-gray-100 bg-white pb-2">
                    <input
                      type="text"
                      placeholder="Search buildings..."
                      value={buildingSearch}
                      onChange={(e) => setBuildingSearch(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
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
                  <label className="text-xs font-medium text-secondary">From:</label>
                  <select
                    value={yearFrom}
                    onChange={(e) => setYearFrom(Number(e.target.value))}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <label className="text-xs font-medium text-secondary">To:</label>
                  <select
                    value={yearTo}
                    onChange={(e) => setYearTo(Number(e.target.value))}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs font-medium text-secondary">From:</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none" />
                  <label className="text-xs font-medium text-secondary">To:</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none" />
                </>
              )}
              <button
                onClick={() => setAdvancedDates((v) => !v)}
                className="text-xs font-medium text-accent hover:text-primary"
              >
                {advancedDates ? "Simple" : "Advanced"}
              </button>
            </div>
          </div>

          {/* Row 2: Bedrooms + Orientation + Floor Plan + Metric toggle + Scatter */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Bedroom selector */}
            <div ref={bedroomRef} className="relative">
              <button
                onClick={() => setBedroomOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeBedrooms.size > 0
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-gray-300 bg-white text-primary hover:border-gray-400"
                }`}
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
                <div className="absolute left-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                  {filteredBedroomCounts.map((bed) => (
                    <div key={bed} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50">
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

            {/* Orientation multi-select */}
            {availableOrientations.length > 0 && (
              <div ref={orientationRef} className="relative">
                <button
                  onClick={() => setOrientationOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    activeOrientations.size > 0
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-gray-300 bg-white text-primary hover:border-gray-400"
                  }`}
                >
                  {activeOrientations.size === 0
                    ? "All Views"
                    : Array.from(activeOrientations).join(", ")}
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {orientationOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    {availableOrientations.map((dir) => (
                      <div key={dir} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={activeOrientations.has(dir)}
                            onChange={() => toggleOrientation(dir)}
                            className="accent-primary"
                          />
                          <span className="text-primary">{dir}</span>
                        </label>
                        <button
                          onClick={() => setActiveOrientations(new Set([dir]))}
                          className="ml-2 text-[10px] normal-case tracking-wider text-accent hover:text-primary"
                        >
                          only
                        </button>
                      </div>
                    ))}
                    {activeOrientations.size > 0 && (
                      <button
                        onClick={() => setActiveOrientations(new Set())}
                        className="w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs tracking-wider text-accent hover:text-primary"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Floor Plan multi-select */}
            {availableFloorPlans.length > 0 && (
              <div ref={floorPlanRef} className="relative">
                <button
                  onClick={() => setFloorPlanOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    activeFloorPlans.size > 0
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-gray-300 bg-white text-primary hover:border-gray-400"
                  }`}
                >
                  {activeFloorPlans.size === 0
                    ? "All Plans"
                    : activeFloorPlans.size <= 2
                      ? Array.from(activeFloorPlans).join(", ")
                      : `${activeFloorPlans.size} plans`}
                  <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {floorPlanOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 max-h-60 w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    {availableFloorPlans.map((plan) => (
                      <div key={plan.key} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={activeFloorPlans.has(plan.key)}
                            onChange={() => toggleFloorPlan(plan.key)}
                            className="accent-primary"
                          />
                          <span className="text-primary">{plan.label}</span>
                        </label>
                        <button
                          onClick={() => setActiveFloorPlans(new Set([plan.key]))}
                          className="ml-2 shrink-0 text-[10px] tracking-wider text-accent hover:text-primary"
                        >
                          only
                        </button>
                      </div>
                    ))}
                    {activeFloorPlans.size > 0 && (
                      <button
                        onClick={() => setActiveFloorPlans(new Set())}
                        className="sticky bottom-0 w-full border-t border-gray-100 bg-white px-3 py-1.5 text-left text-xs tracking-wider text-accent hover:text-primary"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metric toggle */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                onClick={() => setMetric("priceSf")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  metric === "priceSf" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
                }`}
              >
                $/SF
              </button>
              <button
                onClick={() => setMetric("price")}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  metric === "price" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
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
          {/* Market Summary — consolidated cards */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Market Summary
            </h3>
            <SummaryCards
              cards={[
                {
                  label: "Active",
                  value: activeStats.count.toLocaleString(),
                  subvalue: absorptionRate
                    ? absorptionRate.monthsOfSupply === Infinity
                      ? "N/A supply"
                      : `${absorptionRate.monthsOfSupply.toFixed(1)} mo supply`
                    : undefined,
                },
                {
                  label: "Pending",
                  value: pendingStats.count.toLocaleString(),
                  subvalue: pendingStats.count > 0 ? `${pendingStats.medianDom} DOM median` : undefined,
                },
                {
                  label: "Closed (12 Mo)",
                  value: summaryStats.count.toLocaleString(),
                },
                {
                  label: "Median $/SF",
                  value: formatPsf(summaryStats.medianPsf, isLease),
                  subvalue: activeStats.count > 0 ? `${formatPsf(activeStats.medianPsf, isLease)} ask` : undefined,
                },
                {
                  label: "Median Price",
                  value: formatDollar(summaryStats.medianPrice),
                  subvalue: activeStats.count > 0 ? `${formatDollar(activeStats.medianPrice)} ask` : undefined,
                },
                {
                  label: "Median DOM",
                  value: String(summaryStats.medianDom),
                  subvalue: summaryStats.medianCpLp > 0 ? `${formatPct(summaryStats.medianCpLp)} CP/LP` : undefined,
                },
              ]}
            />
          </div>

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
            activeOrientations={Array.from(activeOrientations)}
            activeFloorPlans={Array.from(activeFloorPlans)}
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
                      <td className="px-3 py-1.5 text-center text-primary">${row.medianHoaPsf.toFixed(2)}</td>
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
                    {["Building", "Unit", "Bed", "Bath", "Price", "$/SF", "Close Date", "HOA", "DOM", "Plan", "Dir", "SF", "MLS ID"].map((h) => (
                      <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium uppercase tracking-wider ${
                        h === "Building" ? "text-left" : "text-center"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((t, i) => (
                    <tr
                      key={t.listingId + i}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} cursor-pointer transition-colors hover:bg-accent/5`}
                      onClick={() => router.push(`/downtown-condos/listings/${t.listingId}`)}
                    >
                      <td className="whitespace-nowrap px-2 py-1 text-left text-primary">{t.buildingName === "Other" ? t.address : t.buildingName}</td>
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
                      <td className="whitespace-nowrap px-2 py-1 text-center text-xs text-secondary">{t.listingId || "---"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active & Pending Inventory Table */}
          {(activeListings.length > 0 || pendingListings.length > 0) && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
                Active &amp; Pending Inventory ({activeListings.length + pendingListings.length})
              </h3>
              <div className="max-h-[280px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-accent text-white">
                      {["Building", "Unit", "Bed", "Bath", "Status", "List Price", "$/SF", "DOM", "List Date", "MLS ID"].map((h) => (
                        <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium uppercase tracking-wider ${
                          h === "Building" ? "text-left" : "text-center"
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...activeListings, ...pendingListings]
                      .sort((a, b) => (b.daysOnMarket || 0) - (a.daysOnMarket || 0))
                      .map((t, i) => (
                        <tr
                          key={t.listingId + i}
                          className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} cursor-pointer transition-colors hover:bg-accent/5`}
                          onClick={() => router.push(`/downtown-condos/listings/${t.listingId}`)}
                        >
                          <td className="whitespace-nowrap px-2 py-1 text-left text-primary">
                            {t.buildingName === "Other" ? t.address : t.buildingName}
                          </td>
                          <td className="px-2 py-1 text-center text-primary">{t.unitNumber}</td>
                          <td className="px-2 py-1 text-center text-primary">{t.bedroomsTotal}</td>
                          <td className="px-2 py-1 text-center text-primary">{t.bathroomsTotalInteger}</td>
                          <td className="px-2 py-1 text-center">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              t.status === "Active"
                                ? "bg-[#324A32]/10 text-[#324A32]"
                                : t.status === "Pending" || t.status === "Active Under Contract"
                                  ? "bg-yellow-500/10 text-yellow-700"
                                  : "bg-[#886752]/10 text-[#886752]"
                            }`}>
                              {t.status === "Active Under Contract" ? "Pending" : t.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-center text-primary">
                            {formatDollar(t.listPrice)}
                          </td>
                          <td className="px-2 py-1 text-center text-primary">
                            {t.livingArea > 0 ? formatPsf(t.listPrice / t.livingArea, isLease) : "---"}
                          </td>
                          <td className="px-2 py-1 text-center text-primary">{t.daysOnMarket}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-center text-primary">
                            {t.listingContractDate ? formatDate(t.listingContractDate) : "---"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-center text-xs text-secondary">
                            {t.listingId || "---"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {activeTab === "buildings" && (
          <div className="mt-6">
            {/* Buy/Lease toggle */}
            <div className="mb-4 flex items-center justify-center">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                <button
                  onClick={() => setListingMode("buy")}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    listingMode === "buy" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setListingMode("lease")}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    listingMode === "lease" ? "bg-accent text-white" : "bg-gray-100 text-secondary hover:bg-gray-200"
                  }`}
                >
                  Lease
                </button>
              </div>
            </div>

            {/* Building Comparison Table */}
            <div className="overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-accent text-white">
                    {([
                      ["buildingName", "Building"],
                      ["medianPsf", "Median $/SF"],
                      ["medianPrice", "Med Price (12 Mo)"],
                      ["medianHoaPsf", "HOA $/SF"],
                      ["activeCount", "Active"],
                      ["pendingCount", "Pending"],
                      ["closedLast12", "Closed (12 Mo)"],
                      ["absorptionRate", "Absorption"],
                      ["avgDom", "Avg DOM"],
                      ["medianSf", "Med SF"],
                    ] as [keyof BuildingMarketRow, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => {
                          if (buildingSortKey === key) setBuildingSortAsc(!buildingSortAsc);
                          else { setBuildingSortKey(key); setBuildingSortAsc(false); }
                        }}
                        className={`cursor-pointer whitespace-nowrap px-3 py-2.5 font-bold uppercase tracking-wider select-none ${
                          key === "buildingName" ? "text-left" : "text-right"
                        } ${buildingSortKey === key ? "bg-accent/90" : ""}`}
                      >
                        {label}
                        {buildingSortKey === key ? (buildingSortAsc ? " \u25B2" : " \u25BC") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBuildingRows.map((row, i) => (
                    <tr
                      key={row.buildingSlug}
                      className={`border-b border-gray-100 transition-colors hover:bg-accent/5 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-primary">{row.buildingName}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.medianPsf > 0 ? formatPsf(row.medianPsf, isLease) : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.medianPrice > 0 ? formatDollar(row.medianPrice) : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.medianHoaPsf > 0 ? `$${row.medianHoaPsf.toFixed(2)}` : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.activeCount > 0 ? row.activeCount : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.pendingCount > 0 ? row.pendingCount : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.closedLast12 > 0 ? row.closedLast12 : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.absorptionRate === Infinity ? <span className="text-secondary">N/A</span> : row.absorptionRate > 0 ? `${row.absorptionRate.toFixed(1)} mo` : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.avgDom > 0 ? Math.round(row.avgDom).toString() : <span className="text-secondary">--</span>}</td>
                      <td className="px-3 py-2 text-right text-primary">{row.medianSf > 0 ? Math.round(row.medianSf).toLocaleString() : <span className="text-secondary">--</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-center text-xs text-secondary">
              {sortedBuildingRows.length} buildings · Last 12 months · Click column headers to sort
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
