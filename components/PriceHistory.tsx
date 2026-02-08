"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Transaction } from "@/data/transactions";
import type { FloorPlan } from "@/data/floorPlans";

interface PriceHistoryProps {
  buildingName: string;
  transactions?: Transaction[];
  floorPlans?: FloorPlan[];
}

const BEDROOM_COLORS: Record<number, string> = {
  0: "#6366f1", // studio - indigo
  1: "#0ea5e9", // 1 bed - sky
  2: "#10b981", // 2 bed - emerald
  3: "#f59e0b", // 3 bed - amber
  4: "#ef4444", // 4 bed - red
};

function bedroomLabel(bed: number): string {
  if (bed === 0) return "Studio";
  if (bed === 1) return "1 Bed";
  return `${bed} Bed`;
}

function formatPrice(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

function formatFullPrice(val: number): string {
  return "$" + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Normalize orientation string: "NWc" → "NW", "SEc" → "SE", "E, W, W" → "E"
function normalizeOrientation(raw: string): string {
  // Take first orientation if comma-separated
  const first = raw.split(",")[0].trim();
  // Remove trailing "c" (corner designation)
  return first.replace(/c$/i, "").toUpperCase();
}

// Expand unit number ranges like "1106-4306" into individual unit numbers
function expandUnitRange(rangeStr: string): string[] {
  const start = parseInt(rangeStr.split("-")[0].trim());
  const end = parseInt(rangeStr.split("-")[1].trim());
  if (isNaN(start) || isNaN(end) || start > end) return [];

  const units: string[] = [];
  // Determine the unit suffix (last 2 digits) and step by 100 (floor increment)
  for (let u = start; u <= end; u += 100) {
    units.push(String(u));
  }
  return units;
}

// Parse a unitNumbers string into individual unit numbers
function parseUnitNumbers(unitStr: string): string[] {
  if (!unitStr) return [];
  const units: string[] = [];
  // Clean commas inside numbers like "4,301" but keep commas between entries
  // Split by comma-space patterns that separate entries
  const parts = unitStr.split(/,\s*/);

  let i = 0;
  while (i < parts.length) {
    const part = parts[i].trim();
    if (!part) { i++; continue; }

    // Check if this part is a continuation of a number (e.g., "4,301" split into "4" and "301")
    // A range will have a "-" and both sides will be 3+ digits
    if (part.includes("-")) {
      const expanded = expandUnitRange(part);
      units.push(...expanded);
    } else {
      // Single unit - could be "909" or part of "4,301"
      const num = parseInt(part.replace(/,/g, ""));
      if (!isNaN(num)) {
        // Check if next part looks like it continues this number (e.g., "4" then "301")
        if (i + 1 < parts.length && part.length <= 2 && !parts[i + 1].includes("-")) {
          const combined = part + parts[i + 1].trim();
          const combinedNum = parseInt(combined);
          if (!isNaN(combinedNum) && combinedNum > 100) {
            units.push(String(combinedNum));
            i += 2;
            continue;
          }
        }
        units.push(String(num));
      }
    }
    i++;
  }
  return units;
}

interface UnitInfo {
  planName: string;
  orientation: string;
  normalizedOrientation: string;
}

// Build a map from unit number → floor plan info
function buildUnitMap(floorPlans: FloorPlan[]): Map<string, UnitInfo> {
  const map = new Map<string, UnitInfo>();
  for (const plan of floorPlans) {
    const normalized = normalizeOrientation(plan.orientation);
    const unitNums = parseUnitNumbers(plan.unitNumbers);
    for (const unit of unitNums) {
      map.set(unit, {
        planName: plan.name,
        orientation: plan.orientation,
        normalizedOrientation: normalized,
      });
    }
  }
  return map;
}

interface ChartDataPoint {
  timestamp: number;
  pricePerSqft: number;
  price: number;
  date: string;
  unit: string;
  bedrooms: number;
  sqft: number;
  planName?: string;
  orientation?: string;
}

interface RollingAvgPoint {
  timestamp: number;
  value: number;
}

// Compute trailing 12-month rolling median at monthly intervals
function computeRollingAverage(
  points: ChartDataPoint[],
  metric: "pricePerSqft" | "price"
): RollingAvgPoint[] {
  if (points.length < 3) return [];

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const TWELVE_MONTHS = 365.25 * 24 * 60 * 60 * 1000;
  const ONE_MONTH = TWELVE_MONTHS / 12;

  const minTime = sorted[0].timestamp;
  const maxTime = sorted[sorted.length - 1].timestamp;
  const result: RollingAvgPoint[] = [];

  for (let t = minTime + TWELVE_MONTHS; t <= maxTime; t += ONE_MONTH) {
    const windowStart = t - TWELVE_MONTHS;
    const windowPoints = sorted.filter(
      (p) => p.timestamp >= windowStart && p.timestamp <= t
    );
    if (windowPoints.length < 2) continue;

    const values = windowPoints
      .map((p) => p[metric])
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (values.length === 0) continue;

    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0
        ? (values[mid - 1] + values[mid]) / 2
        : values[mid];

    result.push({ timestamp: t, value: Math.round(median) });
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const first = payload[0];
  if (first.payload.unit === undefined && first.payload.value !== undefined) {
    const d = first.payload as RollingAvgPoint;
    const date = new Date(d.timestamp);
    return (
      <div className="border border-gray-200 bg-white p-3 text-xs shadow-lg">
        <p className="font-semibold text-primary">12-Month Rolling Median</p>
        <p className="mt-1 text-secondary">
          {date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </p>
        <p className="mt-1">
          <span className="font-medium text-primary">
            {formatFullPrice(d.value)}
            {first.name?.includes("$/SF") ? "/SF" : ""}
          </span>
        </p>
      </div>
    );
  }

  const d = first.payload as ChartDataPoint;
  return (
    <div className="border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-primary">
        Unit {d.unit} &middot; {bedroomLabel(d.bedrooms)}
      </p>
      {d.planName && (
        <p className="text-secondary">
          Plan {d.planName}
          {d.orientation ? ` · ${d.orientation}` : ""}
        </p>
      )}
      <p className="mt-1 text-secondary">
        {new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })}
      </p>
      <p className="mt-1">
        <span className="text-accent">Price:</span>{" "}
        <span className="font-medium text-primary">
          {formatFullPrice(d.price)}
        </span>
      </p>
      <p>
        <span className="text-accent">$/SF:</span>{" "}
        <span className="font-medium text-primary">
          ${d.pricePerSqft.toLocaleString()}
        </span>
      </p>
      {d.sqft > 0 && (
        <p>
          <span className="text-accent">Size:</span>{" "}
          <span className="font-medium text-primary">
            {d.sqft.toLocaleString()} SF
          </span>
        </p>
      )}
    </div>
  );
}

const DIRECTION_ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export default function PriceHistory({
  buildingName,
  transactions,
  floorPlans,
}: PriceHistoryProps) {
  const [metric, setMetric] = useState<"pricePerSqft" | "price">(
    "pricePerSqft"
  );
  const [activeBedrooms, setActiveBedrooms] = useState<Set<number>>(
    new Set()
  );
  const [activeOrientations, setActiveOrientations] = useState<Set<string>>(new Set());
  const [activeFloorPlans, setActiveFloorPlans] = useState<Set<string>>(new Set());
  const [orientationOpen, setOrientationOpen] = useState(false);
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const orientationRef = useRef<HTMLDivElement>(null);
  const floorPlanRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orientationRef.current && !orientationRef.current.contains(e.target as Node)) {
        setOrientationOpen(false);
      }
      if (floorPlanRef.current && !floorPlanRef.current.contains(e.target as Node)) {
        setFloorPlanOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Build unit → floor plan/orientation map
  const unitMap = useMemo(() => {
    if (!floorPlans || floorPlans.length === 0) return new Map<string, UnitInfo>();
    return buildUnitMap(floorPlans);
  }, [floorPlans]);

  // Get available orientations and floor plan names
  const { orientations, planNames } = useMemo(() => {
    if (!floorPlans || floorPlans.length === 0)
      return { orientations: [] as string[], planNames: [] as string[] };
    const oSet = new Set<string>();
    const pSet = new Set<string>();
    for (const plan of floorPlans) {
      oSet.add(normalizeOrientation(plan.orientation));
      pSet.add(plan.name);
    }
    const orientations = DIRECTION_ORDER.filter((d) => oSet.has(d));
    const planNames = Array.from(pSet).sort();
    return { orientations, planNames };
  }, [floorPlans]);

  const hasFloorPlanData = orientations.length > 0;

  const bedroomCounts = useMemo(() => {
    if (!transactions) return [];
    const counts = new Set<number>();
    for (const t of transactions) counts.add(t.bedrooms);
    return Array.from(counts).sort((a, b) => a - b);
  }, [transactions]);

  const activeBedsSet =
    activeBedrooms.size === 0 ? new Set(bedroomCounts) : activeBedrooms;

  // Enrich transactions with floor plan info and apply all filters
  const enrichedTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.map((t) => {
      const info = unitMap.get(t.unit);
      return {
        ...t,
        planName: info?.planName,
        orientation: info?.orientation,
        normalizedOrientation: info?.normalizedOrientation,
      };
    });
  }, [transactions, unitMap]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return enrichedTransactions.filter((t) => {
      if (!activeBedsSet.has(t.bedrooms)) return false;
      if (activeOrientations.size > 0) {
        if (!t.normalizedOrientation || !activeOrientations.has(t.normalizedOrientation)) return false;
      }
      if (activeFloorPlans.size > 0) {
        if (!t.planName || !activeFloorPlans.has(t.planName)) return false;
      }
      return true;
    });
  }, [enrichedTransactions, activeBedsSet, activeOrientations, activeFloorPlans]);

  // Scatter data grouped by bedroom
  const scatterData = useMemo(() => {
    const byBed: Record<number, ChartDataPoint[]> = {};
    for (const t of filteredTransactions) {
      if (metric === "pricePerSqft" && t.pricePerSqft <= 0) continue;
      if (!byBed[t.bedrooms]) byBed[t.bedrooms] = [];
      byBed[t.bedrooms].push({
        timestamp: new Date(t.date).getTime(),
        pricePerSqft: t.pricePerSqft,
        price: t.price,
        date: t.date,
        unit: t.unit,
        bedrooms: t.bedrooms,
        sqft: t.sqft,
        planName: t.planName,
        orientation: t.orientation,
      });
    }
    return byBed;
  }, [filteredTransactions, metric]);

  // Rolling average lines
  const rollingData = useMemo(() => {
    const result: Record<number, RollingAvgPoint[]> = {};
    for (const bed of bedroomCounts) {
      if (!activeBedsSet.has(bed) || !scatterData[bed]) continue;
      result[bed] = computeRollingAverage(scatterData[bed], metric);
    }
    return result;
  }, [scatterData, bedroomCounts, activeBedsSet, metric]);

  if (!transactions || transactions.length === 0) {
    return null;
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

  const matchedCount = enrichedTransactions.filter((t) => t.planName).length;

  return (
    <section className="section-padding bg-light">
      <div className="container-narrow">
        <h2 className="mb-4 text-center text-2xl tracking-tight text-primary md:text-3xl">
          <span className="font-bold">Price History</span>{" "}
          <span className="font-light">at {buildingName}</span>
        </h2>
        <p className="mb-8 text-center text-sm text-secondary">
          {filteredTransactions.length.toLocaleString()} of{" "}
          {transactions.length.toLocaleString()} transactions shown
        </p>

        {/* Controls */}
        <div className="mb-6 space-y-3">
          {/* Row 1: Metric + Bedrooms */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex border border-gray-200 bg-white text-xs">
              <button
                onClick={() => setMetric("pricePerSqft")}
                className={`px-4 py-2 uppercase tracking-wider transition-colors ${
                  metric === "pricePerSqft"
                    ? "bg-primary text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                $/SF
              </button>
              <button
                onClick={() => setMetric("price")}
                className={`px-4 py-2 uppercase tracking-wider transition-colors ${
                  metric === "price"
                    ? "bg-primary text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                Sale Price
              </button>
            </div>

            <div className="flex gap-1">
              {bedroomCounts.map((bed) => (
                <button
                  key={bed}
                  onClick={() => toggleBedroom(bed)}
                  className={`flex items-center gap-1.5 border px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                    activeBedsSet.has(bed)
                      ? "border-gray-300 bg-white text-primary"
                      : "border-gray-200 bg-gray-100 text-gray-400"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: activeBedsSet.has(bed)
                        ? BEDROOM_COLORS[bed] || "#999"
                        : "#ccc",
                    }}
                  />
                  {bedroomLabel(bed)}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: View & Floor Plan multi-select dropdowns */}
          {hasFloorPlanData && (
            <div className="flex flex-wrap items-center justify-center gap-4">
              {orientations.length > 0 && (
                <div ref={orientationRef} className="relative flex items-center gap-2">
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
                    <svg className="ml-1 h-3 w-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {orientationOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 border border-gray-200 bg-white shadow-lg">
                      {orientations.map((dir) => (
                        <label
                          key={dir}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={activeOrientations.has(dir)}
                            onChange={() => toggleOrientation(dir)}
                            className="accent-primary"
                          />
                          <span className="text-primary">{dir}</span>
                        </label>
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

              {planNames.length > 0 && (
                <div ref={floorPlanRef} className="relative flex items-center gap-2">
                  <label className="text-xs uppercase tracking-wider text-accent">
                    Plan:
                  </label>
                  <button
                    onClick={() => setFloorPlanOpen((v) => !v)}
                    className="flex items-center gap-1 border border-gray-200 bg-white px-3 py-2 text-xs tracking-wider text-primary"
                  >
                    {activeFloorPlans.size === 0
                      ? "All Plans"
                      : activeFloorPlans.size <= 3
                        ? Array.from(activeFloorPlans).join(", ")
                        : `${activeFloorPlans.size} selected`}
                    <svg className="ml-1 h-3 w-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {floorPlanOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-60 overflow-y-auto border border-gray-200 bg-white shadow-lg">
                      {planNames.map((plan) => (
                        <label
                          key={plan}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs tracking-wider hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={activeFloorPlans.has(plan)}
                            onChange={() => toggleFloorPlan(plan)}
                            className="accent-primary"
                          />
                          <span className="text-primary">{plan}</span>
                        </label>
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
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="border border-gray-200 bg-white p-4 md:p-6">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(val) => `${new Date(val).getFullYear()}`}
                tick={{ fontSize: 11, fill: "#666" }}
                stroke="#d1d5db"
                allowDuplicatedCategory={false}
              />
              <YAxis
                dataKey={metric}
                type="number"
                tickFormatter={(val) =>
                  metric === "pricePerSqft" ? `$${val}` : formatPrice(val)
                }
                tick={{ fontSize: 11, fill: "#666" }}
                stroke="#d1d5db"
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs uppercase tracking-wider text-secondary">
                    {value}
                  </span>
                )}
              />

              {/* Scatter dots */}
              {bedroomCounts
                .filter((bed) => activeBedsSet.has(bed) && scatterData[bed])
                .map((bed) => (
                  <Scatter
                    key={`scatter-${bed}`}
                    name={bedroomLabel(bed)}
                    data={scatterData[bed]}
                    fill={BEDROOM_COLORS[bed] || "#999"}
                    fillOpacity={0.4}
                    r={3}
                  />
                ))}

              {/* Rolling average lines */}
              {bedroomCounts
                .filter(
                  (bed) =>
                    activeBedsSet.has(bed) &&
                    rollingData[bed] &&
                    rollingData[bed].length > 1
                )
                .map((bed) => (
                  <Line
                    key={`line-${bed}`}
                    name={`${bedroomLabel(bed)} Avg`}
                    data={rollingData[bed]}
                    dataKey="value"
                    stroke={BEDROOM_COLORS[bed] || "#999"}
                    strokeWidth={2.5}
                    dot={false}
                    legendType="line"
                    connectNulls
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>

          <p className="mt-3 text-center text-xs text-accent">
            Lines show 12-month rolling median
            {hasFloorPlanData && (
              <> &middot; {matchedCount} of {transactions.length} transactions matched to floor plans</>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
