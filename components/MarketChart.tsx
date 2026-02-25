"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Scatter,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface CsvTransaction {
  buildingName: string;
  address: string;
  unit: string;
  bedrooms: number;
  bathrooms: number;
  closeDate: string;
  closePrice: number;
  livingArea: number;
  priceSf: number;
  floorPlan: string;
  orientation: string;
  year: number;
  hoaFee: number;
  hoaPsf: number;
  dom: number;
  cpLp: number;
  cpOlp: number;
}

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

function formatPrice(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

function formatFullPrice(val: number): string {
  return "$" + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

type TrendMode = "rolling12" | "rolling3" | "yearly";

interface RollingDataPoint {
  timestamp: number;
  monthLabel: string;
  medianPsf: number;
  medianPrice: number;
  count: number;
  windowMonths: number;
}

interface ScatterPoint {
  timestamp: number;
  priceSf: number;
  price: number;
  date: string;
  unit: string;
  bedrooms: number;
  sqft: number;
  buildingName: string;
  address: string;
  floorPlan: string;
  orientation: string;
  dom: number;
  statusGroup?: string; // "Closed" | "Active" | "Pending" | "Didn't Sell"
  lastStatusChange?: string; // latest event date for tooltip display
}

// Status-grouped scatter data passed from parent
export interface StatusScatterListing {
  statusGroup: string; // "Closed" | "Active" | "Pending" | "Didn't Sell"
  date: string;
  price: number;
  priceSf: number;
  bedrooms: number;
  unit: string;
  buildingName: string;
  address: string;
  livingArea: number;
  floorPlan: string;
  orientation: string;
  dom: number;
  lastStatusChange?: string; // latest event date for tooltip display
}

const STATUS_COLORS: Record<string, string> = {
  "Closed": "#7AA0A3",      // Darkened denim
  "Active": "#324A32",      // Zilker green
  "Pending": "#886752",     // Barton Creek brown
  "Didn't Sell": "#C4BDA8", // Darkened moontower
};

interface YearDataPoint {
  year: number;
  count: number;
  medianPsf: number;
  medianPrice: number;
  timestamp: number;
  isPartialYear?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, metric, isLease }: any) {
  if (!active || !payload || !payload.length) return null;

  const first = payload[0];
  const fmtPsfLocal = (v: number) => isLease ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString()}`;

  // Rolling data tooltip
  if (first.payload.windowMonths !== undefined) {
    const d = first.payload as RollingDataPoint;
    const windowLabel = d.windowMonths === 12 ? "trailing 12 months" : "trailing 3 months";
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
        <p className="font-semibold text-primary">{d.monthLabel}</p>
        <p className="text-[10px] text-secondary">{windowLabel}</p>
        <p className="mt-1">
          <span className="text-accent">Transactions:</span>{" "}
          <span className="font-medium text-primary">{d.count}</span>
        </p>
        <p>
          <span className="text-accent">Median $/SF:</span>{" "}
          <span className="font-medium text-primary">
            {fmtPsfLocal(d.medianPsf)}
          </span>
        </p>
        <p>
          <span className="text-accent">Median Price:</span>{" "}
          <span className="font-medium text-primary">
            {formatFullPrice(d.medianPrice)}
          </span>
        </p>
      </div>
    );
  }

  // Year data tooltip (bar or median line)
  if (first.payload.count !== undefined && first.payload.year !== undefined) {
    const d = first.payload as YearDataPoint;
    const yearLabel = d.isPartialYear ? `${d.year} YTD` : String(d.year);
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
        <p className="font-semibold text-primary">{yearLabel}</p>
        {d.isPartialYear && (
          <p className="text-[10px] text-secondary">Partial year — {d.count} transactions</p>
        )}
        <p className="mt-1">
          <span className="text-accent">Transactions:</span>{" "}
          <span className="font-medium text-primary">{d.count}</span>
        </p>
        <p>
          <span className="text-accent">Median $/SF:</span>{" "}
          <span className="font-medium text-primary">
            {fmtPsfLocal(d.medianPsf)}
          </span>
        </p>
        <p>
          <span className="text-accent">Median Price:</span>{" "}
          <span className="font-medium text-primary">
            {formatFullPrice(d.medianPrice)}
          </span>
        </p>
      </div>
    );
  }

  // Scatter tooltip
  const d = first.payload as ScatterPoint;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-primary">{d.buildingName === "Other" ? d.address : d.buildingName}</p>
      <p className="text-secondary">
        Unit {d.unit} &middot; {bedroomLabel(d.bedrooms)}
      </p>
      {d.floorPlan && (
        <p className="text-secondary">
          Plan: {d.floorPlan}
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
      {d.priceSf > 0 && (
        <p>
          <span className="text-accent">$/SF:</span>{" "}
          <span className="font-medium text-primary">
            {fmtPsfLocal(d.priceSf)}
          </span>
        </p>
      )}
      {d.sqft > 0 && (
        <p>
          <span className="text-accent">Size:</span>{" "}
          <span className="font-medium text-primary">
            {d.sqft.toLocaleString()} SF
          </span>
        </p>
      )}
      {d.dom > 0 && (
        <p>
          <span className="text-accent">DOM:</span>{" "}
          <span className="font-medium text-primary">
            {d.dom}
          </span>
        </p>
      )}
    </div>
  );
}

interface MarketChartProps {
  transactions: CsvTransaction[];
  showScatter: boolean;
  activeBedrooms: Set<number>;
  bedroomCounts: number[];
  metric: "priceSf" | "price";
  selectedBuildings?: string[];
  activeOrientations?: string[];
  activeFloorPlans?: string[];
  yearRange?: string;
  statusScatterListings?: StatusScatterListing[];
  isLease?: boolean;
}

export default function MarketChart({
  transactions,
  showScatter,
  activeBedrooms,
  bedroomCounts,
  metric,
  selectedBuildings = [],
  activeOrientations = [],
  activeFloorPlans = [],
  yearRange = "",
  statusScatterListings = [],
  isLease = false,
}: MarketChartProps) {
  // Format $/SF: 2 decimals for lease, whole numbers for buy
  const fmtPsf = (v: number) => isLease ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString()}`;

  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [trendMode, setTrendMode] = useState<TrendMode>("rolling12");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderScatterDot = (props: any) => {
    const { cx, cy, payload, fill } = props;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        fillOpacity={0.55}
        cursor="pointer"
        onMouseEnter={() => {
          setHoveredPoint(payload);
          setTooltipPos({ x: cx, y: cy });
        }}
        onMouseLeave={() => setHoveredPoint(null)}
      />
    );
  };

  // Build scatter data by bedroom
  const scatterByBed: Record<number, ScatterPoint[]> = {};
  for (const t of transactions) {
    if (!activeBedrooms.has(t.bedrooms)) continue;
    if (metric === "priceSf" && t.priceSf <= 0) continue;
    if (!scatterByBed[t.bedrooms]) scatterByBed[t.bedrooms] = [];
    scatterByBed[t.bedrooms].push({
      timestamp: new Date(t.closeDate).getTime(),
      priceSf: t.priceSf,
      price: t.closePrice,
      date: t.closeDate,
      unit: t.unit,
      bedrooms: t.bedrooms,
      sqft: t.livingArea,
      buildingName: t.buildingName,
      address: t.address,
      floorPlan: t.floorPlan,
      orientation: t.orientation,
      dom: t.dom,
    });
  }

  // Build status-grouped scatter data (when statusScatterListings provided)
  const statusScatterByGroup: Record<string, ScatterPoint[]> = {};
  const useStatusScatter = statusScatterListings.length > 0;

  if (useStatusScatter) {
    for (const s of statusScatterListings) {
      if (!activeBedrooms.has(s.bedrooms)) continue;
      const val = metric === "priceSf" ? s.priceSf : s.price;
      if (val <= 0) continue;
      if (!statusScatterByGroup[s.statusGroup]) statusScatterByGroup[s.statusGroup] = [];
      statusScatterByGroup[s.statusGroup].push({
        timestamp: new Date(s.date).getTime(),
        priceSf: s.priceSf,
        price: s.price,
        date: s.date,
        unit: s.unit,
        bedrooms: s.bedrooms,
        sqft: s.livingArea,
        buildingName: s.buildingName,
        address: s.address,
        floorPlan: s.floorPlan,
        orientation: s.orientation,
        dom: s.dom,
        statusGroup: s.statusGroup,
        lastStatusChange: s.lastStatusChange,
      });
    }
  }

  // Build yearly aggregated data (bars + median line points)
  const yearBuckets: Record<number, { priceSfs: number[]; prices: number[]; count: number }> = {};
  for (const t of transactions) {
    if (!activeBedrooms.has(t.bedrooms)) continue;
    if (!yearBuckets[t.year]) yearBuckets[t.year] = { priceSfs: [], prices: [], count: 0 };
    yearBuckets[t.year].count++;
    if (t.priceSf > 0) yearBuckets[t.year].priceSfs.push(t.priceSf);
    if (t.closePrice > 0) yearBuckets[t.year].prices.push(t.closePrice);
  }

  const currentYear = new Date().getFullYear();

  const yearData: YearDataPoint[] = Object.entries(yearBuckets)
    .map(([yr, bucket]) => ({
      year: Number(yr),
      count: bucket.count,
      medianPsf: isLease ? Math.round(median(bucket.priceSfs) * 100) / 100 : Math.round(median(bucket.priceSfs)),
      medianPrice: Math.round(median(bucket.prices)),
      timestamp: new Date(Number(yr), 6, 1).getTime(),
      isPartialYear: Number(yr) === currentYear,
    }))
    .sort((a, b) => a.year - b.year);

  // Rolling median computation
  const rollingData = useMemo((): RollingDataPoint[] => {
    if (trendMode === "yearly") return [];

    const windowMonths = trendMode === "rolling12" ? 12 : 3;

    const filtered = transactions.filter((t) => activeBedrooms.has(t.bedrooms));
    if (filtered.length === 0) return [];

    const sorted = [...filtered].sort((a, b) => a.closeDate.localeCompare(b.closeDate));

    const firstDate = new Date(sorted[0].closeDate);
    const lastDate = new Date(sorted[sorted.length - 1].closeDate);

    const startMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    const endMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);

    // Start iterating from startMonth + windowMonths so each point has a full window
    const cursor = new Date(startMonth);
    cursor.setMonth(cursor.getMonth() + windowMonths);

    const points: RollingDataPoint[] = [];

    while (cursor <= endMonth) {
      // Window: from first day of (cursor - windowMonths + 1) to last day of cursor month
      const windowStart = new Date(cursor.getFullYear(), cursor.getMonth() - windowMonths + 1, 1);
      const windowEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

      const wsStr = windowStart.toISOString().substring(0, 10);
      const weStr = windowEnd.toISOString().substring(0, 10);

      const windowTxns = filtered.filter(
        (t) => t.closeDate >= wsStr && t.closeDate <= weStr
      );

      if (windowTxns.length > 0) {
        const priceSfs = windowTxns.map((t) => t.priceSf).filter((v) => v > 0);
        const prices = windowTxns.map((t) => t.closePrice).filter((v) => v > 0);

        points.push({
          timestamp: new Date(cursor.getFullYear(), cursor.getMonth(), 15).getTime(),
          monthLabel: cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          medianPsf: isLease
            ? Math.round(median(priceSfs) * 100) / 100
            : Math.round(median(priceSfs)),
          medianPrice: Math.round(median(prices)),
          count: windowTxns.length,
          windowMonths,
        });
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }, [transactions, activeBedrooms, trendMode, isLease]);

  // Active trend data and bar data based on mode
  const trendData = trendMode === "yearly" ? yearData : rollingData;

  // Metric-specific values
  const metricKey = metric === "priceSf" ? "medianPsf" : "medianPrice";
  const metricLabel = metric === "priceSf" ? "$/SF" : "Sale Price";
  const scatterKey = metric === "priceSf" ? "priceSf" : "price";

  // Compute time domain
  const allScatter: ScatterPoint[] = [
    ...Object.values(scatterByBed).flat(),
    ...Object.values(statusScatterByGroup).flat(),
  ];
  const allTimestamps = [
    ...allScatter.map((p) => p.timestamp),
    ...trendData.map((p) => p.timestamp),
  ];
  const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
  const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

  // Compute max count for right Y axis
  const maxCount = trendData.length > 0 ? Math.max(...trendData.map((b) => b.count)) : 0;

  // Build filter summary for display - separate buildings from other filters
  const buildingFilter = selectedBuildings.length > 0 ? selectedBuildings.join(", ") : "";

  const otherFilterParts: string[] = [];
  const activeBedArray = Array.from(activeBedrooms).sort((a, b) => a - b);
  if (activeBedArray.length > 0 && activeBedArray.length < bedroomCounts.length) {
    otherFilterParts.push(activeBedArray.map(bedroomLabel).join(", "));
  }
  if (activeOrientations.length > 0) {
    otherFilterParts.push(activeOrientations.join(", "));
  }
  if (activeFloorPlans.length > 0) {
    const planSummary =
      activeFloorPlans.length <= 3
        ? activeFloorPlans.join(", ")
        : `${activeFloorPlans.length} floor plans`;
    otherFilterParts.push(planSummary);
  }
  const otherFilters = otherFilterParts.length > 0 ? otherFilterParts.join(" · ") : "";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 md:p-6">
      {/* Title and filter summary */}
      <div className="mb-4 text-center">
        <h3 className="text-base font-semibold text-primary">
          {metric === "priceSf" ? "Downtown Austin: Price per Square Foot" : "Downtown Austin: Sale Price"}
        </h3>
        {buildingFilter && (
          <p className="mt-1 text-xs text-accent">
            {buildingFilter}
          </p>
        )}
        {otherFilters && (
          <p className={buildingFilter ? "text-xs text-accent" : "mt-1 text-xs text-accent"}>
            {otherFilters}
          </p>
        )}
        {/* Trend mode toggle */}
        <div className="mt-2 flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            {([
              ["rolling12", "12-Mo Rolling"],
              ["rolling3", "3-Mo Rolling"],
              ["yearly", "Yearly"],
            ] as [TrendMode, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTrendMode(key)}
                className={`rounded-md px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  trendMode === key
                    ? "bg-zilker text-white"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-[280px] md:h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={trendData} margin={{ top: 10, right: 60, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[minTime - 86400000 * 180, maxTime + 86400000 * 180]}
            tickFormatter={(val) => `${new Date(val).getFullYear()}`}
            tick={{ fontSize: 11, fill: "#666" }}
            stroke="#d1d5db"
            allowDuplicatedCategory={false}
          />
          <YAxis
            yAxisId="left"
            type="number"
            tickFormatter={(val) =>
              metric === "priceSf" ? fmtPsf(val) : formatPrice(val)
            }
            tick={{ fontSize: 11, fill: "#666" }}
            stroke="#d1d5db"
            width={70}
            label={{
              value: trendMode === "yearly"
                ? `Closed Median ${metricLabel}`
                : `Rolling Median ${metricLabel}`,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#886752" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            type="number"
            domain={[0, Math.ceil(maxCount * 1.15)]}
            tickFormatter={(val) => `${val}`}
            tick={{ fontSize: 11, fill: "#666" }}
            stroke="#d1d5db"
            width={50}
            label={{
              value: "Transactions",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 11, fill: "#886752" },
            }}
          />
          {!useStatusScatter && (
            <Tooltip content={<CustomTooltip metric={metric} isLease={isLease} />} />
          )}
          <Legend
            formatter={(value) => (
              <span className="text-xs uppercase tracking-wider text-secondary">
                {value}
              </span>
            )}
          />

          {/* Bar chart - transaction count */}
          <Bar
            yAxisId="right"
            dataKey="count"
            name={trendMode === "yearly" ? "Transactions / Year" : "Transactions / Window"}
            fill="#E1DDD1"
            stroke="#d1d5db"
            barSize={trendMode === "yearly" ? 20 : 4}
            fillOpacity={0.7}
          />

          {/* Trend line — rolling or yearly */}
          {trendMode !== "yearly" && rollingData.length > 1 && (
            <Line
              yAxisId="left"
              dataKey={metricKey}
              name={`${trendMode === "rolling12" ? "12-Mo" : "3-Mo"} Rolling Median ${metric === "priceSf" ? "$/SF" : "Price"}`}
              stroke="#324A32"
              strokeWidth={2.5}
              dot={false}
              type="monotone"
              legendType="line"
              connectNulls
            />
          )}
          {trendMode === "yearly" && yearData.length > 1 && (
            <Line
              yAxisId="left"
              dataKey={metricKey}
              name={metric === "priceSf" ? "Closed Median $/SF" : "Closed Median Sale Price"}
              stroke="#324A32"
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isPartialYear) {
                  return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill="white" stroke="#324A32" strokeWidth={2} />;
                }
                return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill="#324A32" />;
              }}
              type="monotone"
              legendType="line"
              connectNulls
            />
          )}

          {/* Status-colored scatter dots (when status scatter data provided) */}
          {useStatusScatter &&
            ["Didn't Sell", "Pending", "Active", "Closed"]
              .filter((group) => statusScatterByGroup[group]?.length > 0)
              .map((group) => (
                <Scatter
                  key={`scatter-status-${group}`}
                  yAxisId="left"
                  name={group}
                  data={statusScatterByGroup[group]}
                  dataKey={scatterKey}
                  fill={STATUS_COLORS[group] || "#999"}
                  shape={renderScatterDot}
                />
              ))}

          {/* Bedroom-colored scatter dots (legacy, when no status scatter) */}
          {showScatter &&
            !useStatusScatter &&
            bedroomCounts
              .filter((bed) => activeBedrooms.has(bed) && scatterByBed[bed])
              .map((bed) => (
                <Scatter
                  key={`scatter-${bed}`}
                  yAxisId="left"
                  name={bedroomLabel(bed)}
                  data={scatterByBed[bed]}
                  dataKey={scatterKey}
                  fill={BEDROOM_COLORS[bed] || "#999"}
                  shape={renderScatterDot}
                />
              ))}
        </ComposedChart>
      </ResponsiveContainer>

        {/* Custom scatter tooltip — bypasses Recharts tooltip for reliable hover */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y,
              transform: "translateY(-100%)",
            }}
          >
            <p className="font-semibold text-primary">
              {hoveredPoint.buildingName === "Other" ? hoveredPoint.address : hoveredPoint.buildingName}
            </p>
            <p className="text-secondary">
              Unit {hoveredPoint.unit} &middot;{" "}
              {bedroomLabel(hoveredPoint.bedrooms)}
              {hoveredPoint.statusGroup && (
                <> &middot;{" "}
                  <span style={{ color: STATUS_COLORS[hoveredPoint.statusGroup] || "#666" }}>
                    {hoveredPoint.statusGroup}
                  </span>
                </>
              )}
            </p>
            {hoveredPoint.floorPlan && (
              <p className="text-secondary">
                Plan: {hoveredPoint.floorPlan}
                {hoveredPoint.orientation
                  ? ` · ${hoveredPoint.orientation}`
                  : ""}
              </p>
            )}
            <p className="mt-1 text-secondary">
              {hoveredPoint.statusGroup === "Closed" ? "Closed" : "Listed"}:{" "}
              {new Date(hoveredPoint.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {hoveredPoint.lastStatusChange && hoveredPoint.statusGroup !== "Closed" && (
              <p className="text-secondary">
                Last Activity:{" "}
                {new Date(hoveredPoint.lastStatusChange).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            <p className="mt-1">
              <span className="text-accent">
                {hoveredPoint.statusGroup && hoveredPoint.statusGroup !== "Closed" ? "List Price:" : "Price:"}
              </span>{" "}
              <span className="font-medium text-primary">
                {formatFullPrice(hoveredPoint.price)}
              </span>
            </p>
            {hoveredPoint.priceSf > 0 && (
              <p>
                <span className="text-accent">$/SF:</span>{" "}
                <span className="font-medium text-primary">
                  {fmtPsf(hoveredPoint.priceSf)}
                </span>
              </p>
            )}
            {hoveredPoint.sqft > 0 && (
              <p>
                <span className="text-accent">Size:</span>{" "}
                <span className="font-medium text-primary">
                  {hoveredPoint.sqft.toLocaleString()} SF
                </span>
              </p>
            )}
            {hoveredPoint.dom >= 0 && (
              <p>
                <span className="text-accent">DOM:</span>{" "}
                <span className={`font-medium text-primary ${
                  hoveredPoint.statusGroup && hoveredPoint.statusGroup !== "Closed" ? "text-base" : ""
                }`}>
                  {hoveredPoint.dom}
                  {hoveredPoint.statusGroup && hoveredPoint.statusGroup !== "Closed" && (
                    <span className="ml-1 text-xs font-normal text-secondary">days</span>
                  )}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-accent">
        {(showScatter || useStatusScatter) && "Dots show individual listings · "}
        {trendMode === "yearly"
          ? "Bars show annual transaction volume"
          : `Bars show ${trendMode === "rolling12" ? "12" : "3"}-month rolling transaction count`}
        {trendData.length > 1 && (
          trendMode === "yearly"
            ? ` · Line shows yearly closed median ${metricLabel}`
            : ` · Line shows ${trendMode === "rolling12" ? "12" : "3"}-month rolling closed median ${metricLabel}`
        )}
      </p>
    </div>
  );
}
