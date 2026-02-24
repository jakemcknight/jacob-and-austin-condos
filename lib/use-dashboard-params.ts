"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import type { BuildingMarketRow } from "@/lib/mls/analytics-computations";

// ─── Dashboard state shape for URL sync ──────────────────────────────

export interface DashboardUrlState {
  // Global
  activeTab: "analytics" | "buildings" | "yoy";
  listingMode: "buy" | "lease";
  selectedBuildings: Set<string>;
  yearFrom: number;
  yearTo: number;
  advancedDates: boolean;
  dateFrom: string;
  dateTo: string;
  // Analytics tab
  activeBedrooms: Set<number>;
  activeOrientations: Set<string>;
  activeFloorPlans: Set<string>;
  metric: "priceSf" | "price";
  scatterStatuses: Set<string>;
  // Buildings tab
  buildingSortKey: keyof BuildingMarketRow;
  buildingSortAsc: boolean;
  // YoY tab
  yoyPeriod: "ytd" | "rolling" | "monthly";
  monthlyMetric: "closings" | "medianPrice" | "medianPsf" | "pendings";
  // Appreciation
  appreciationRange: "all" | "5" | "10" | "custom";
  appreciationDateFrom: string;
  appreciationDateTo: string;
}

const CURRENT_YEAR = new Date().getFullYear();

const DEFAULT_SCATTER = new Set(["Closed", "Active", "Pending", "Didn't Sell"]);

// Valid building sort keys for validation
const VALID_SORT_KEYS: Set<string> = new Set([
  "buildingName", "activeCount", "pendingCount", "closedLast12",
  "medianPsf", "absorptionRate", "avgDom", "medianPrice", "medianHoaPsf", "medianSf",
]);

// ─── Parse URL → DashboardUrlState ───────────────────────────────────

function parseDashboardParams(params: URLSearchParams): DashboardUrlState {
  const state: DashboardUrlState = {
    activeTab: "analytics",
    listingMode: "buy",
    selectedBuildings: new Set(),
    yearFrom: 2015,
    yearTo: CURRENT_YEAR,
    advancedDates: false,
    dateFrom: "2015-01-01",
    dateTo: `${CURRENT_YEAR}-12-31`,
    activeBedrooms: new Set(),
    activeOrientations: new Set(),
    activeFloorPlans: new Set(),
    metric: "priceSf",
    scatterStatuses: new Set(),
    buildingSortKey: "closedLast12",
    buildingSortAsc: false,
    yoyPeriod: "ytd",
    monthlyMetric: "closings",
    appreciationRange: "5",
    appreciationDateFrom: "",
    appreciationDateTo: "",
  };

  const tab = params.get("tab");
  if (tab === "buildings" || tab === "yoy") state.activeTab = tab;

  const mode = params.get("mode");
  if (mode === "lease") state.listingMode = "lease";

  const buildings = params.get("buildings");
  if (buildings) state.selectedBuildings = new Set(buildings.split(",").filter(Boolean));

  const yf = params.get("yearFrom");
  if (yf) { const n = parseInt(yf, 10); if (!isNaN(n)) state.yearFrom = n; }

  const yt = params.get("yearTo");
  if (yt) { const n = parseInt(yt, 10); if (!isNaN(n)) state.yearTo = n; }

  const adv = params.get("advDates");
  if (adv === "1") state.advancedDates = true;

  const df = params.get("dateFrom");
  if (df && /^\d{4}-\d{2}-\d{2}$/.test(df)) state.dateFrom = df;

  const dt = params.get("dateTo");
  if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) state.dateTo = dt;

  const beds = params.get("beds");
  if (beds) state.activeBedrooms = new Set(beds.split(",").map(Number).filter(n => !isNaN(n)));

  const facing = params.get("facing");
  if (facing) state.activeOrientations = new Set(facing.split(",").filter(Boolean));

  const plans = params.get("plans");
  if (plans) state.activeFloorPlans = new Set(plans.split(",").filter(Boolean));

  const metric = params.get("metric");
  if (metric === "price") state.metric = "price";

  const statuses = params.get("statuses");
  if (statuses) state.scatterStatuses = new Set(statuses.split(",").filter(Boolean));

  const bSort = params.get("bSort");
  if (bSort && VALID_SORT_KEYS.has(bSort)) state.buildingSortKey = bSort as keyof BuildingMarketRow;

  const bDir = params.get("bDir");
  if (bDir === "asc") state.buildingSortAsc = true;

  const period = params.get("period");
  if (period === "rolling" || period === "monthly") state.yoyPeriod = period;

  const mMetric = params.get("mMetric");
  if (mMetric === "medianPrice" || mMetric === "medianPsf" || mMetric === "pendings") {
    state.monthlyMetric = mMetric;
  }

  const appRange = params.get("appRange");
  if (appRange === "10" || appRange === "all" || appRange === "custom") state.appreciationRange = appRange;

  const appFrom = params.get("appFrom");
  if (appFrom && /^\d{4}-\d{2}-\d{2}$/.test(appFrom)) state.appreciationDateFrom = appFrom;

  const appTo = params.get("appTo");
  if (appTo && /^\d{4}-\d{2}-\d{2}$/.test(appTo)) state.appreciationDateTo = appTo;

  return state;
}

// ─── DashboardUrlState → URL params ──────────────────────────────────

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  return Array.from(a).every(v => b.has(v));
}

function dashboardToParams(state: DashboardUrlState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.activeTab !== "analytics") params.set("tab", state.activeTab);
  if (state.listingMode !== "buy") params.set("mode", state.listingMode);
  if (state.selectedBuildings.size > 0) params.set("buildings", Array.from(state.selectedBuildings).join(","));
  if (state.yearFrom !== 2015) params.set("yearFrom", String(state.yearFrom));
  if (state.yearTo !== CURRENT_YEAR) params.set("yearTo", String(state.yearTo));
  if (state.advancedDates) {
    params.set("advDates", "1");
    if (state.dateFrom !== "2015-01-01") params.set("dateFrom", state.dateFrom);
    if (state.dateTo !== `${CURRENT_YEAR}-12-31`) params.set("dateTo", state.dateTo);
  }
  if (state.activeBedrooms.size > 0) params.set("beds", Array.from(state.activeBedrooms).join(","));
  if (state.activeOrientations.size > 0) params.set("facing", Array.from(state.activeOrientations).join(","));
  if (state.activeFloorPlans.size > 0) params.set("plans", Array.from(state.activeFloorPlans).join(","));
  if (state.metric !== "priceSf") params.set("metric", state.metric);
  if (state.scatterStatuses.size > 0 && !setsEqual(state.scatterStatuses, DEFAULT_SCATTER)) {
    params.set("statuses", Array.from(state.scatterStatuses).join(","));
  }
  if (state.buildingSortKey !== "closedLast12") params.set("bSort", state.buildingSortKey);
  if (state.buildingSortAsc) params.set("bDir", "asc");
  if (state.yoyPeriod !== "ytd") params.set("period", state.yoyPeriod);
  if (state.monthlyMetric !== "closings") params.set("mMetric", state.monthlyMetric);
  if (state.appreciationRange !== "5") params.set("appRange", state.appreciationRange);
  if (state.appreciationRange === "custom") {
    if (state.appreciationDateFrom) params.set("appFrom", state.appreciationDateFrom);
    if (state.appreciationDateTo) params.set("appTo", state.appreciationDateTo);
  }

  return params;
}

// ─── Public hook ─────────────────────────────────────────────────────

export function useDashboardParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialState = parseDashboardParams(searchParams);

  const syncToUrl = useCallback(
    (state: DashboardUrlState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = dashboardToParams(state);
        const qs = params.toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        router.replace(url, { scroll: false });
      }, 300);
    },
    [pathname, router],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { initialState, syncToUrl };
}
