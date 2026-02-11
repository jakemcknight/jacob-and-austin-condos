"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { CsvTransaction } from "@/components/MarketChart";

const MarketChart = dynamic(() => import("@/components/MarketChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center border border-gray-200 bg-white">
      <p className="text-sm uppercase tracking-wider text-gray-400">
        Loading chart...
      </p>
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

function normalizeOrientation(raw: string): string {
  const first = raw.split(",")[0].trim();
  return first.replace(/c$/i, "").toUpperCase();
}

const DIRECTION_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Parse CSV text into CsvTransaction[]
function parseCsv(text: string): CsvTransaction[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  const results: CsvTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV with potential quoted fields
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') {
        inQuotes = !inQuotes;
      } else if (line[c] === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += line[c];
      }
    }
    values.push(current.trim());

    let buildingName = values[idx("Building Name")] || "";
    if (!buildingName) continue;
    if (buildingName === "44 East Avenue") buildingName = "44 East";

    const priceSf = parseFloat(values[idx("Closed $/SF")] || "0");
    const closePrice = parseFloat(values[idx("ClosePrice")] || "0");
    if (closePrice <= 0) continue;

    const cpLpRaw = parseFloat(values[idx("Closed Price/List Price")] || "0");
    const cpOlpRaw = parseFloat(values[idx("Closed Price/Original List Price")] || "0");

    results.push({
      buildingName,
      address: values[idx("Address")] || "",
      unit: values[idx("UnitNumber")] || "",
      bedrooms: parseInt(values[idx("BedroomsTotal")] || "0") || 0,
      bathrooms: parseInt(values[idx("BathroomsTotalInteger")] || "0") || 0,
      closeDate: values[idx("CloseDate")] || "",
      closePrice,
      livingArea: parseFloat(values[idx("LivingArea")] || "0") || 0,
      priceSf: isFinite(priceSf) ? priceSf : 0,
      floorPlan: values[idx("Floor Plan")] || "",
      orientation: values[idx("Orientation")] || "",
      year: parseInt(values[idx("Transactional Year")] || "0") || 0,
      hoaFee: parseFloat(values[idx("HOA Fee")] || "0") || 0,
      hoaPsf: parseFloat(values[idx("HOA $/SF")] || "0") || 0,
      dom: parseInt(values[idx("DaysOnMarket")] || "0") || 0,
      cpLp: isFinite(cpLpRaw) ? cpLpRaw : 0,
      cpOlp: isFinite(cpOlpRaw) ? cpOlpRaw : 0,
    });
  }

  return results;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatDollar(val: number): string {
  return "$" + Math.round(val).toLocaleString();
}

function formatPct(val: number): string {
  return Math.round(val * 100) + "%";
}

interface YearlyRow {
  year: number;
  medianValue: number;
  closedPsf: number;
  transactions: number;
  hoaPsf: number;
  dom: number;
  medianSf: number;
  volume: number;
  cpLp: number;
  cpOlp: number;
}

export default function DataPage() {
  const [allData, setAllData] = useState<CsvTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(
    new Set()
  );
  const [activeBedrooms, setActiveBedrooms] = useState<Set<number>>(
    new Set()
  );
  const [activeOrientations, setActiveOrientations] = useState<Set<string>>(
    new Set()
  );
  const [activeFloorPlans, setActiveFloorPlans] = useState<Set<string>>(
    new Set()
  );
  const [showScatter, setShowScatter] = useState(false);
  const [scatterLoading, setScatterLoading] = useState(false);
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState(2025);
  const [advancedDates, setAdvancedDates] = useState(false);
  const [dateFrom, setDateFrom] = useState("2000-01-01");
  const [dateTo, setDateTo] = useState("2025-12-31");
  const [metric, setMetric] = useState<"priceSf" | "price">("priceSf");
  const [appreciationRange, setAppreciationRange] = useState<
    "all" | "5" | "10" | "custom"
  >("5");
  const [appreciationDateFrom, setAppreciationDateFrom] = useState("");
  const [appreciationDateTo, setAppreciationDateTo] = useState("");

  // Dropdown open state
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [bedroomOpen, setBedroomOpen] = useState(false);
  const [orientationOpen, setOrientationOpen] = useState(false);
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);

  const buildingRef = useRef<HTMLDivElement>(null);
  const bedroomRef = useRef<HTMLDivElement>(null);
  const orientationRef = useRef<HTMLDivElement>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        buildingRef.current &&
        !buildingRef.current.contains(e.target as Node)
      )
        setBuildingOpen(false);
      if (
        bedroomRef.current &&
        !bedroomRef.current.contains(e.target as Node)
      )
        setBedroomOpen(false);
      if (
        orientationRef.current &&
        !orientationRef.current.contains(e.target as Node)
      )
        setOrientationOpen(false);
      if (
        floorPlanRef.current &&
        !floorPlanRef.current.contains(e.target as Node)
      )
        setFloorPlanOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch and parse CSV
  useEffect(() => {
    fetch("/downtown-condos/data/downtown-condo-data.csv")
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseCsv(text);
        setAllData(parsed);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Derive available options from data
  const allBuildings = useMemo(
    () => Array.from(new Set(allData.map((t) => t.buildingName))).sort(),
    [allData]
  );
  const allYears = useMemo(() => {
    const years = Array.from(new Set(allData.map((t) => t.year))).sort(
      (a, b) => a - b
    );
    return years;
  }, [allData]);
  const bedroomCounts = useMemo(() => {
    const counts = new Set<number>();
    for (const t of allData) counts.add(t.bedrooms);
    return Array.from(counts).sort((a, b) => a - b);
  }, [allData]);

  // Effective selections (empty = all)
  const effectiveBuildings =
    selectedBuildings.size === 0
      ? new Set(allBuildings)
      : selectedBuildings;
  const effectiveBedrooms =
    activeBedrooms.size === 0 ? new Set(bedroomCounts) : activeBedrooms;

  // Date range check helper
  const dateFromTime = advancedDates ? new Date(dateFrom).getTime() : 0;
  const dateToTime = advancedDates ? new Date(dateTo + "T23:59:59").getTime() : 0;

  function inDateRange(t: CsvTransaction): boolean {
    if (advancedDates) {
      const d = new Date(t.closeDate).getTime();
      return d >= dateFromTime && d <= dateToTime;
    }
    return t.year >= yearFrom && t.year <= yearTo;
  }

  // Apply filters
  const filteredData = useMemo(() => {
    return allData.filter((t) => {
      if (!effectiveBuildings.has(t.buildingName)) return false;
      if (!effectiveBedrooms.has(t.bedrooms)) return false;
      if (!inDateRange(t)) return false;
      if (activeOrientations.size > 0) {
        const norm = normalizeOrientation(t.orientation);
        if (!norm || !activeOrientations.has(norm)) return false;
      }
      if (activeFloorPlans.size > 0) {
        const key = t.floorPlan
          ? `${t.buildingName} — ${t.floorPlan}`
          : "";
        if (!key || !activeFloorPlans.has(key)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allData,
    effectiveBuildings,
    effectiveBedrooms,
    yearFrom,
    yearTo,
    advancedDates,
    dateFrom,
    dateTo,
    activeOrientations,
    activeFloorPlans,
  ]);

  // Derive orientation + floor plan options from building-filtered data (before orient/fp filters)
  const buildingFilteredData = useMemo(() => {
    return allData.filter((t) => {
      if (!effectiveBuildings.has(t.buildingName)) return false;
      if (!effectiveBedrooms.has(t.bedrooms)) return false;
      if (!inDateRange(t)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, effectiveBuildings, effectiveBedrooms, yearFrom, yearTo, advancedDates, dateFrom, dateTo]);

  const availableOrientations = useMemo(() => {
    const oSet = new Set<string>();
    for (const t of buildingFilteredData) {
      if (t.orientation) oSet.add(normalizeOrientation(t.orientation));
    }
    return DIRECTION_ORDER.filter((d) => oSet.has(d));
  }, [buildingFilteredData]);

  const availableFloorPlans = useMemo(() => {
    const planMap: Record<string, { key: string; areas: number[] }> = {};
    for (const t of buildingFilteredData) {
      if (!t.floorPlan) continue;
      const key = `${t.buildingName} — ${t.floorPlan}`;
      if (!planMap[key]) planMap[key] = { key, areas: [] };
      if (t.livingArea > 0) planMap[key].areas.push(t.livingArea);
    }
    return Object.values(planMap)
      .map((p) => {
        const medSf =
          p.areas.length > 0
            ? Math.round(median(p.areas))
            : 0;
        return { key: p.key, sf: medSf, label: medSf > 0 ? `${p.key} (${medSf.toLocaleString()} SF)` : p.key };
      })
      .sort((a, b) => a.sf - b.sf);
  }, [buildingFilteredData]);

  // Summary stats — scoped to previous 12 months of filtered data
  const last12 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffTime = cutoff.getTime();
    return filteredData.filter((t) => {
      const d = new Date(t.closeDate).getTime();
      return d >= cutoffTime;
    });
  }, [filteredData]);

  const medianPsf = useMemo(() => {
    const vals = last12.map((t) => t.priceSf).filter((v) => v > 0);
    return Math.round(median(vals));
  }, [last12]);

  const medianPrice = useMemo(() => {
    const vals = last12.map((t) => t.closePrice).filter((v) => v > 0);
    return Math.round(median(vals));
  }, [last12]);

  // Yearly breakdown table data
  const yearlyRows = useMemo(() => {
    const buckets: Record<
      number,
      {
        prices: number[];
        psfs: number[];
        hoaPsfs: number[];
        doms: number[];
        sfs: number[];
        cpLps: number[];
        cpOlps: number[];
        volume: number;
        count: number;
      }
    > = {};
    for (const t of filteredData) {
      if (!buckets[t.year])
        buckets[t.year] = {
          prices: [],
          psfs: [],
          hoaPsfs: [],
          doms: [],
          sfs: [],
          cpLps: [],
          cpOlps: [],
          volume: 0,
          count: 0,
        };
      const b = buckets[t.year];
      b.count++;
      b.volume += t.closePrice;
      if (t.closePrice > 0) b.prices.push(t.closePrice);
      if (t.priceSf > 0) b.psfs.push(t.priceSf);
      if (t.hoaPsf > 0) b.hoaPsfs.push(t.hoaPsf);
      if (t.dom > 0) b.doms.push(t.dom);
      if (t.livingArea > 0) b.sfs.push(t.livingArea);
      if (t.cpLp > 0) b.cpLps.push(t.cpLp);
      if (t.cpOlp > 0) b.cpOlps.push(t.cpOlp);
    }
    return Object.entries(buckets)
      .map(
        ([yr, b]): YearlyRow => ({
          year: Number(yr),
          medianValue: Math.round(median(b.prices)),
          closedPsf: Math.round(median(b.psfs)),
          transactions: b.count,
          hoaPsf: Math.round(median(b.hoaPsfs) * 100) / 100,
          dom: Math.round(median(b.doms)),
          medianSf: Math.round(median(b.sfs)),
          volume: Math.round(b.volume),
          cpLp: median(b.cpLps),
          cpOlp: median(b.cpOlps),
        })
      )
      .sort((a, b) => b.year - a.year);
  }, [filteredData]);

  // Sorted transactions for table (newest first)
  const sortedTransactions = useMemo(() => {
    return [...filteredData].sort(
      (a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime()
    );
  }, [filteredData]);

  // Appreciation calculations
  const appreciation = useMemo(() => {
    if (yearlyRows.length < 2) return null;
    // yearlyRows is sorted newest first; we need ascending for calculations
    const ascending = [...yearlyRows].reverse();
    const latestYear = ascending[ascending.length - 1].year;

    let rangeRows = ascending;
    if (appreciationRange === "5") {
      rangeRows = ascending.filter((r) => r.year >= latestYear - 5);
    } else if (appreciationRange === "10") {
      rangeRows = ascending.filter((r) => r.year >= latestYear - 10);
    } else if (appreciationRange === "custom") {
      const fromYr = appreciationDateFrom
        ? new Date(appreciationDateFrom).getFullYear()
        : 0;
      const toYr = appreciationDateTo
        ? new Date(appreciationDateTo).getFullYear()
        : 9999;
      rangeRows = ascending.filter(
        (r) => r.year >= fromYr && r.year <= toYr
      );
    }
    if (rangeRows.length < 2) return null;

    const first = rangeRows[0];
    const last = rangeRows[rangeRows.length - 1];
    const years = last.year - first.year;
    if (years <= 0) return null;

    function calcAppreciation(startVal: number, endVal: number, numYears: number) {
      if (startVal <= 0) return { totalGain: 0, yoy: 0 };
      const totalGain = ((endVal - startVal) / startVal) * 100;
      const cagr = (Math.pow(endVal / startVal, 1 / numYears) - 1) * 100;
      return { totalGain: Math.round(totalGain * 10) / 10, yoy: Math.round(cagr * 10) / 10 };
    }

    return {
      years,
      firstYear: first.year,
      lastYear: last.year,
      priceSf: calcAppreciation(first.closedPsf, last.closedPsf, years),
      value: calcAppreciation(first.medianValue, last.medianValue, years),
      hoaPsf: calcAppreciation(first.hoaPsf, last.hoaPsf, years),
    };
  }, [yearlyRows, appreciationRange, appreciationDateFrom, appreciationDateTo]);

  // Toggle helpers
  function toggleBuilding(name: string) {
    setSelectedBuildings((prev) => {
      // If all selected (empty set), deselect this one building
      if (prev.size === 0) {
        const next = new Set(allBuildings.filter((b) => b !== name));
        return next;
      }
      // Normal toggle behavior
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleBedroom(bed: number) {
    setActiveBedrooms((prev) => {
      const next = new Set(prev.size === 0 ? bedroomCounts : prev);
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
        <p className="text-sm uppercase tracking-wider text-accent">
          Loading transaction data...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        {/* Header */}
        <h1 className="text-center text-2xl tracking-tight text-primary md:text-3xl">
          <span className="font-bold">Downtown Austin</span>{" "}
          <span className="font-light">Condo Market Data</span>
        </h1>

        {/* Summary Stats — Previous 12 Months */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-accent">
              Transactions (Prev 12 Mo)
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">
              {last12.length.toLocaleString()}
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-accent">
              Median $/SF (Prev 12 Mo)
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">
              ${medianPsf.toLocaleString()}
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-accent">
              Median Price (Prev 12 Mo)
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">
              ${medianPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 space-y-3">
          {/* Row 1: Building dropdown + Date range */}
          <div className="flex flex-wrap items-center justify-center gap-4">
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
                <svg
                  className="ml-1 h-3 w-3 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {buildingOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto border border-gray-200 bg-white shadow-lg">
                  {allBuildings.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <label className="flex flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            selectedBuildings.size === 0 ||
                            selectedBuildings.has(name)
                          }
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
                  <label className="text-xs uppercase tracking-wider text-accent">
                    From:
                  </label>
                  <select
                    value={yearFrom}
                    onChange={(e) => setYearFrom(Number(e.target.value))}
                    className="border border-gray-200 bg-white px-2 py-2 text-xs text-primary"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs uppercase tracking-wider text-accent">
                    To:
                  </label>
                  <select
                    value={yearTo}
                    onChange={(e) => setYearTo(Number(e.target.value))}
                    className="border border-gray-200 bg-white px-2 py-2 text-xs text-primary"
                  >
                    {allYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs uppercase tracking-wider text-accent">
                    From:
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary"
                  />
                  <label className="text-xs uppercase tracking-wider text-accent">
                    To:
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary"
                  />
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

          {/* Row 2: Bedrooms, Orientation, Floor Plan, Metric, Scatter toggle */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Bedroom multi-select */}
            <div ref={bedroomRef} className="relative">
              <button
                onClick={() => setBedroomOpen((v) => !v)}
                className="flex items-center gap-1 border border-gray-200 bg-white px-4 py-2 text-xs uppercase tracking-wider text-primary"
              >
                {activeBedrooms.size === 0
                  ? "All Bedrooms"
                  : activeBedrooms.size <= 3
                    ? Array.from(activeBedrooms)
                        .sort((a, b) => a - b)
                        .map((b) => bedroomLabel(b))
                        .join(", ")
                    : `${activeBedrooms.size} selected`}
                <svg
                  className="ml-1 h-3 w-3 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {bedroomOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 border border-gray-200 bg-white shadow-lg">
                  {bedroomCounts.map((bed) => (
                    <div
                      key={bed}
                      className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <label className="flex flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            activeBedrooms.size === 0 ||
                            activeBedrooms.has(bed)
                          }
                          onChange={() => toggleBedroom(bed)}
                          className="accent-primary"
                        />
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              activeBedrooms.size === 0 || activeBedrooms.has(bed)
                                ? BEDROOM_COLORS[bed] || "#999"
                                : "#ccc",
                          }}
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
                      className="w-full border-t border-gray-100 px-3 py-1.5 text-left text-xs tracking-wider text-accent hover:text-primary"
                    >
                      Select All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Orientation multi-select */}
            {availableOrientations.length > 0 && (
              <div
                ref={orientationRef}
                className="relative flex items-center gap-2"
              >
                <label className="text-xs uppercase tracking-wider text-accent">
                  View:
                </label>
                <button
                  onClick={() => setOrientationOpen((v) => !v)}
                  className="flex items-center gap-1 border border-gray-200 bg-white px-3 py-2 text-xs uppercase tracking-wider text-primary"
                >
                  {activeOrientations.size === 0
                    ? "All Views"
                    : Array.from(activeOrientations).join(", ")}
                  <svg
                    className="ml-1 h-3 w-3 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {orientationOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 border border-gray-200 bg-white shadow-lg">
                    {availableOrientations.map((dir) => (
                      <div
                        key={dir}
                        className="flex items-center justify-between px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-gray-50"
                      >
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
              <div
                ref={floorPlanRef}
                className="relative flex items-center gap-2"
              >
                <label className="text-xs uppercase tracking-wider text-accent">
                  Plan:
                </label>
                <button
                  onClick={() => setFloorPlanOpen((v) => !v)}
                  className="flex items-center gap-1 border border-gray-200 bg-white px-3 py-2 text-xs tracking-wider text-primary"
                >
                  {activeFloorPlans.size === 0
                    ? "All Plans"
                    : activeFloorPlans.size <= 2
                      ? Array.from(activeFloorPlans).join(", ")
                      : `${activeFloorPlans.size} plans`}
                  <svg
                    className="ml-1 h-3 w-3 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {floorPlanOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-80 overflow-y-auto border border-gray-200 bg-white shadow-lg">
                    {availableFloorPlans.map((plan) => (
                      <div
                        key={plan.key}
                        className="flex items-center justify-between px-3 py-1.5 text-xs tracking-wider hover:bg-gray-50"
                      >
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
            <div className="flex items-center">
              <button
                onClick={() => setMetric("priceSf")}
                className={`border px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                  metric === "priceSf"
                    ? "border-gray-300 bg-white text-primary font-semibold"
                    : "border-gray-200 bg-gray-100 text-gray-400"
                }`}
              >
                $/SF
              </button>
              <button
                onClick={() => setMetric("price")}
                className={`border border-l-0 px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                  metric === "price"
                    ? "border-gray-300 bg-white text-primary font-semibold"
                    : "border-gray-200 bg-gray-100 text-gray-400"
                }`}
              >
                Sale Price
              </button>
            </div>

            {/* Scatter toggle */}
            <label className="flex cursor-pointer items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-xs uppercase tracking-wider">
              <input
                type="checkbox"
                checked={showScatter || scatterLoading}
                disabled={scatterLoading}
                onChange={(e) => {
                  if (e.target.checked) {
                    setScatterLoading(true);
                    setTimeout(() => {
                      setShowScatter(true);
                      setScatterLoading(false);
                    }, 50);
                  } else {
                    setShowScatter(false);
                  }
                }}
                className="accent-primary"
              />
              <span className="text-primary">
                {scatterLoading ? "Loading scatterplot..." : "Show Scatterplot"}
              </span>
            </label>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-8">
          <MarketChart
            transactions={filteredData}
            showScatter={showScatter}
            activeBedrooms={effectiveBedrooms}
            bedroomCounts={bedroomCounts}
            metric={metric}
            selectedBuildings={Array.from(selectedBuildings)}
            activeOrientations={Array.from(activeOrientations)}
            activeFloorPlans={Array.from(activeFloorPlans)}
            yearRange={advancedDates ? `${dateFrom} to ${dateTo}` : `${yearFrom}-${yearTo}`}
          />
        </div>

        {/* Yearly Breakdown Table */}
        {yearlyRows.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-center text-lg font-semibold tracking-tight text-primary">
              Yearly Breakdown
            </h2>
            <div className="max-h-[280px] overflow-auto border border-gray-200">
              <table className="w-full min-w-[900px] text-center text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-accent text-xs uppercase tracking-wider text-white">
                    <th className="px-3 py-3 font-medium">Year</th>
                    <th className="px-3 py-3 font-medium">Median Value</th>
                    <th className="px-3 py-3 font-medium">$/SF</th>
                    <th className="px-3 py-3 font-medium">Transactions</th>
                    <th className="px-3 py-3 font-medium">HOA $/SF</th>
                    <th className="px-3 py-3 font-medium">DOM</th>
                    <th className="px-3 py-3 font-medium">Median SF</th>
                    <th className="px-3 py-3 font-medium">Volume</th>
                    <th className="px-3 py-3 font-medium">CP/LP</th>
                    <th className="px-3 py-3 font-medium">CP/OLP</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyRows.map((row, i) => (
                    <tr
                      key={row.year}
                      className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-primary">{row.year}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{formatDollar(row.medianValue)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{formatDollar(row.closedPsf)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{row.transactions}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">${row.hoaPsf.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{row.dom}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{row.medianSf.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{formatDollar(row.volume)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{formatPct(row.cpLp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-primary">{formatPct(row.cpOlp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Appreciation Section */}
        {yearlyRows.length >= 2 && (
          <div className="mt-10">
            <h2 className="mb-4 text-center text-lg font-semibold tracking-tight text-primary">
              Appreciation
            </h2>

            {/* Range toggle */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-0">
                {(
                  [
                    ["5", "5 Years"],
                    ["10", "10 Years"],
                    ["custom", "Custom"],
                  ] as const
                ).map(([val, label], idx) => (
                  <button
                    key={val}
                    onClick={() => setAppreciationRange(val)}
                    className={`border px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                      idx > 0 ? "border-l-0" : ""
                    } ${
                      appreciationRange === val
                        ? "border-gray-300 bg-white text-primary font-semibold"
                        : "border-gray-200 bg-gray-100 text-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {appreciationRange === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={appreciationDateFrom}
                    onChange={(e) => setAppreciationDateFrom(e.target.value)}
                    className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary"
                  />
                  <span className="text-xs text-accent">to</span>
                  <input
                    type="date"
                    value={appreciationDateTo}
                    onChange={(e) => setAppreciationDateTo(e.target.value)}
                    className="border border-gray-200 bg-white px-2 py-1.5 text-xs text-primary"
                  />
                </div>
              )}
            </div>

            {/* Appreciation cards */}
            {appreciation ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { label: "Median $/SF", data: appreciation.priceSf },
                  { label: "Median Value", data: appreciation.value },
                  { label: "HOA $/SF", data: appreciation.hoaPsf },
                ].map(({ label, data }) => (
                  <div
                    key={label}
                    className="border border-gray-200 bg-white p-5 text-center"
                  >
                    <p className="text-xs uppercase tracking-wider text-accent">
                      {label}
                    </p>
                    <p className="mt-1 text-[10px] tracking-wider text-secondary">
                      {appreciation.firstYear}–{appreciation.lastYear}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-accent">
                          Avg YoY
                        </p>
                        <p
                          className={`mt-1 text-xl font-semibold ${
                            data.yoy >= 0 ? "text-zilker" : "text-red-600"
                          }`}
                        >
                          {data.yoy > 0 ? "+" : ""}
                          {data.yoy}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-accent">
                          Total
                        </p>
                        <p
                          className={`mt-1 text-xl font-semibold ${
                            data.totalGain >= 0 ? "text-zilker" : "text-red-600"
                          }`}
                        >
                          {data.totalGain > 0 ? "+" : ""}
                          {data.totalGain}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-secondary">
                {appreciationRange === "custom"
                  ? "Select a date range above"
                  : "Not enough data for this range"}
              </p>
            )}
          </div>
        )}

        {/* Closed Transactions Table */}
        {sortedTransactions.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-center text-lg font-semibold tracking-tight text-primary">
              Closed Transactions
            </h2>
            <div className="max-h-[600px] overflow-auto border border-gray-200">
              <table className="w-full min-w-[1100px] text-center text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-accent text-xs uppercase tracking-wider text-white">
                    <th className="px-3 py-3 text-left font-medium">Building</th>
                    <th className="px-3 py-3 font-medium">Unit</th>
                    <th className="px-3 py-3 font-medium">Bed</th>
                    <th className="px-3 py-3 font-medium">Bath</th>
                    <th className="px-3 py-3 font-medium">Price</th>
                    <th className="px-3 py-3 font-medium">$/SF</th>
                    <th className="px-3 py-3 font-medium">Close Date</th>
                    <th className="px-3 py-3 font-medium">HOA</th>
                    <th className="px-3 py-3 font-medium">DOM</th>
                    <th className="px-3 py-3 font-medium">Plan</th>
                    <th className="px-3 py-3 font-medium">Dir</th>
                    <th className="px-3 py-3 font-medium">SF</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((t, i) => (
                    <tr
                      key={`${t.unit}-${t.closeDate}-${i}`}
                      className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-left text-primary">{t.buildingName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.unit}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.bedrooms}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.bathrooms}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{formatDollar(t.closePrice)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">
                        {t.priceSf > 0 ? formatDollar(t.priceSf) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">
                        {new Date(t.closeDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">
                        {t.hoaFee > 0 ? formatDollar(t.hoaFee) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.dom || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.floorPlan || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">{t.orientation || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-primary">
                        {t.livingArea > 0 ? t.livingArea.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-center text-xs text-accent">
              {sortedTransactions.length.toLocaleString()} transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
