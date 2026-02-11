"use client";

import { useState } from "react";
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

interface ScatterPoint {
  timestamp: number;
  priceSf: number;
  price: number;
  date: string;
  unit: string;
  bedrooms: number;
  sqft: number;
  buildingName: string;
  floorPlan: string;
  orientation: string;
}

interface YearDataPoint {
  year: number;
  count: number;
  medianPsf: number;
  medianPrice: number;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, metric }: any) {
  if (!active || !payload || !payload.length) return null;

  const first = payload[0];

  // Year data tooltip (bar or median line)
  if (first.payload.count !== undefined && first.payload.year !== undefined) {
    const d = first.payload as YearDataPoint;
    return (
      <div className="border border-gray-200 bg-white p-3 text-xs shadow-lg">
        <p className="font-semibold text-primary">{d.year}</p>
        <p className="mt-1">
          <span className="text-accent">Transactions:</span>{" "}
          <span className="font-medium text-primary">{d.count}</span>
        </p>
        <p>
          <span className="text-accent">Median $/SF:</span>{" "}
          <span className="font-medium text-primary">
            ${d.medianPsf.toLocaleString()}
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
    <div className="border border-gray-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-semibold text-primary">{d.buildingName}</p>
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
            ${d.priceSf.toLocaleString()}
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
}: MarketChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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
      floorPlan: t.floorPlan,
      orientation: t.orientation,
    });
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

  const yearData: YearDataPoint[] = Object.entries(yearBuckets)
    .map(([yr, bucket]) => ({
      year: Number(yr),
      count: bucket.count,
      medianPsf: Math.round(median(bucket.priceSfs)),
      medianPrice: Math.round(median(bucket.prices)),
      timestamp: new Date(Number(yr), 6, 1).getTime(),
    }))
    .sort((a, b) => a.year - b.year);

  // Metric-specific values
  const metricKey = metric === "priceSf" ? "medianPsf" : "medianPrice";
  const metricLabel = metric === "priceSf" ? "$/SF" : "Sale Price";
  const scatterKey = metric === "priceSf" ? "priceSf" : "price";

  // Compute time domain
  const allScatter: ScatterPoint[] = Object.values(scatterByBed).flat();
  const allTimestamps = [
    ...allScatter.map((p) => p.timestamp),
    ...yearData.map((p) => p.timestamp),
  ];
  const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : 0;
  const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

  // Compute max count for right Y axis
  const maxCount = yearData.length > 0 ? Math.max(...yearData.map((b) => b.count)) : 0;

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
    <div className="border border-gray-200 bg-white p-4 md:p-6">
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
      </div>

      <div className="relative h-[280px] md:h-[500px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={yearData} margin={{ top: 10, right: 60, bottom: 20, left: 10 }}>
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
              metric === "priceSf" ? `$${val}` : formatPrice(val)
            }
            tick={{ fontSize: 11, fill: "#666" }}
            stroke="#d1d5db"
            width={70}
            label={{
              value: `Median ${metricLabel}`,
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
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs uppercase tracking-wider text-secondary">
                {value}
              </span>
            )}
          />

          {/* Bar chart - transaction count per year */}
          <Bar
            yAxisId="right"
            dataKey="count"
            name="Transactions / Year"
            fill="#E1DDD1"
            stroke="#d1d5db"
            barSize={20}
            fillOpacity={0.7}
          />

          {/* Yearly median line (always visible) - smooth curve */}
          {yearData.length > 1 && (
            <Line
              yAxisId="left"
              dataKey={metricKey}
              name={`Median ${metricLabel}`}
              stroke="#324A32"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#324A32" }}
              type="monotone"
              legendType="line"
              connectNulls
            />
          )}

          {/* Scatter dots (toggleable) */}
          {showScatter &&
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
            className="pointer-events-none absolute z-50 border border-gray-200 bg-white p-3 text-xs shadow-lg"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y,
              transform: "translateY(-100%)",
            }}
          >
            <p className="font-semibold text-primary">
              {hoveredPoint.buildingName}
            </p>
            <p className="text-secondary">
              Unit {hoveredPoint.unit} &middot;{" "}
              {bedroomLabel(hoveredPoint.bedrooms)}
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
              {new Date(hoveredPoint.date).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="mt-1">
              <span className="text-accent">Price:</span>{" "}
              <span className="font-medium text-primary">
                {formatFullPrice(hoveredPoint.price)}
              </span>
            </p>
            {hoveredPoint.priceSf > 0 && (
              <p>
                <span className="text-accent">$/SF:</span>{" "}
                <span className="font-medium text-primary">
                  ${hoveredPoint.priceSf.toLocaleString()}
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
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-accent">
        {showScatter && "Dots show individual transactions · "}
        Bars show annual transaction volume
        {yearData.length > 1 && ` · Line shows yearly median ${metricLabel}`}
      </p>
    </div>
  );
}
