"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";
import type { MLSListing } from "@/lib/mls/types";
import {
  computeAbsorptionRate,
  computePriceGap,
  computeMarketVelocity,
  computeYoYComparison,
  computeBuildingMarketTable,
  median,
  getLast12MonthsCutoff,
} from "@/lib/mls/analytics-computations";
import type { BuildingMarketRow } from "@/lib/mls/analytics-computations";
import SummaryCards from "@/components/analytics/SummaryCards";

interface MarketSnapshotProps {
  analyticsListings: AnalyticsListing[];
  activeListings: MLSListing[];
  buildings: Array<{ slug: string; name: string }>;
}

type SortKey = keyof Pick<
  BuildingMarketRow,
  | "buildingName"
  | "activeCount"
  | "pendingCount"
  | "closedLast12"
  | "medianPsf"
  | "absorptionRate"
  | "avgDom"
>;

export default function MarketSnapshot({
  analyticsListings,
  activeListings,
  buildings,
}: MarketSnapshotProps) {
  const [sortKey, setSortKey] = useState<SortKey>("closedLast12");
  const [sortAsc, setSortAsc] = useState(false);

  // --- Derived data ---

  const cutoff = useMemo(() => getLast12MonthsCutoff(), []);

  const closedLast12 = useMemo(
    () =>
      analyticsListings.filter(
        (l) =>
          l.status === "Closed" &&
          l.closeDate &&
          l.closeDate >= cutoff
      ),
    [analyticsListings, cutoff]
  );

  const pendingListings = useMemo(
    () => analyticsListings.filter((l) => l.status === "Pending"),
    [analyticsListings]
  );

  const activeForSale = useMemo(
    () => activeListings.filter((l) => l.listingType === "Sale"),
    [activeListings]
  );

  // 1. Summary Cards data
  const absorption = useMemo(
    () => computeAbsorptionRate(activeForSale.length, closedLast12.length),
    [activeForSale.length, closedLast12.length]
  );

  const avgDom = useMemo(() => {
    const doms = closedLast12
      .map((l) => l.daysOnMarket)
      .filter((d) => d >= 0);
    if (doms.length === 0) return 0;
    return doms.reduce((a, b) => a + b, 0) / doms.length;
  }, [closedLast12]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Absorption Rate",
        value:
          absorption.monthsOfSupply === Infinity
            ? "N/A"
            : `${absorption.monthsOfSupply.toFixed(1)} mo`,
        subvalue:
          absorption.monthsOfSupply < 4
            ? "Seller's Market"
            : absorption.monthsOfSupply <= 6
              ? "Balanced Market"
              : "Buyer's Market",
        trend:
          absorption.monthsOfSupply < 4
            ? ("up" as const)
            : absorption.monthsOfSupply > 6
              ? ("down" as const)
              : ("neutral" as const),
      },
      {
        label: "Active Listings",
        value: activeForSale.length.toLocaleString(),
        subvalue: "For sale",
      },
      {
        label: "Pending",
        value: pendingListings.length.toLocaleString(),
        subvalue: "Under contract",
      },
      {
        label: "12-Mo Closings",
        value: closedLast12.length.toLocaleString(),
        subvalue: `${absorption.monthlyAbsorption.toFixed(1)}/mo avg`,
      },
      {
        label: "Avg DOM",
        value: `${Math.round(avgDom)}`,
        subvalue: "Days on market",
      },
    ],
    [absorption, activeForSale.length, pendingListings.length, closedLast12.length, avgDom]
  );

  // 2. Active vs Closed comparison bar chart data
  const comparisonData = useMemo(() => {
    const activePrices = activeForSale
      .map((l) => l.listPrice)
      .filter((p) => p > 0);
    const closedPrices = closedLast12
      .map((l) => l.closePrice || 0)
      .filter((p) => p > 0);

    return [
      {
        label: "Count",
        Active: activeForSale.length,
        Closed: closedLast12.length,
      },
      {
        label: "Median Price",
        Active: Math.round(median(activePrices)),
        Closed: Math.round(median(closedPrices)),
      },
    ];
  }, [activeForSale, closedLast12]);

  // 3. Price Gap
  const priceGap = useMemo(
    () => computePriceGap(activeForSale, closedLast12),
    [activeForSale, closedLast12]
  );

  // 4. Market Velocity
  const velocity = useMemo(() => {
    const doms = closedLast12
      .map((l) => l.daysOnMarket)
      .filter((d) => d >= 0);
    return computeMarketVelocity(
      pendingListings.length,
      activeForSale.length,
      doms
    );
  }, [pendingListings.length, activeForSale.length, closedLast12]);

  // 5. YoY Comparison
  const yoy = useMemo(
    () => computeYoYComparison(analyticsListings),
    [analyticsListings]
  );

  // 6. Building Market Table
  const buildingTable = useMemo(
    () =>
      computeBuildingMarketTable(analyticsListings, activeListings, buildings),
    [analyticsListings, activeListings, buildings]
  );

  const sortedBuildingTable = useMemo(() => {
    const rows = [...buildingTable].filter(
      (r) => r.activeCount > 0 || r.pendingCount > 0 || r.closedLast12 > 0
    );
    rows.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      // Handle Infinity for absorption rate
      if (aVal === Infinity) aVal = 9999;
      if (bVal === Infinity) bVal = 9999;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return rows;
  }, [buildingTable, sortKey, sortAsc]);

  // --- Helpers ---

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  function formatChange(value: number): string {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  }

  // --- Custom tooltip for chart ---

  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-bold text-primary">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}:{" "}
            {label === "Median Price"
              ? `$${Number(entry.value).toLocaleString()}`
              : Number(entry.value).toLocaleString()}
          </p>
        ))}
      </div>
    );
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* 2. Active vs Closed Comparison + 3. Price Gap + 4. Market Velocity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bar Chart */}
        <div className="rounded border border-gray-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
            Active vs 12-Month Closed
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={comparisonData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E1DDD1" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#4A3427" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#4A3427" }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v.toLocaleString()
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="Active" fill="#93B9BC" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Closed" fill="#886752" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Price Gap + Market Velocity stacked */}
        <div className="space-y-4">
          {/* Price Gap Card */}
          <div className="rounded border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
              Price Gap
            </h3>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">Active Median</span>
                <span className="text-sm font-bold text-primary">
                  ${priceGap.medianActiveListPrice.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">Closed Median</span>
                <span className="text-sm font-bold text-primary">
                  ${priceGap.medianRecentClosePrice.toLocaleString()}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-secondary">Price Gap</span>
                  <span
                    className={`text-sm font-bold ${
                      priceGap.gapPercent > 0
                        ? "text-red-600"
                        : priceGap.gapPercent < 0
                          ? "text-green-600"
                          : "text-primary"
                    }`}
                  >
                    {formatChange(priceGap.gapPercent)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-secondary">$/SF Gap</span>
                  <span
                    className={`text-sm font-bold ${
                      priceGap.psfGapPercent > 0
                        ? "text-red-600"
                        : priceGap.psfGapPercent < 0
                          ? "text-green-600"
                          : "text-primary"
                    }`}
                  >
                    {formatChange(priceGap.psfGapPercent)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-secondary/70">
                {priceGap.gapPercent > 0
                  ? "Active listings priced above recent closings"
                  : priceGap.gapPercent < 0
                    ? "Active listings priced below recent closings"
                    : "Active listings aligned with recent closings"}
              </p>
            </div>
          </div>

          {/* Market Velocity Card */}
          <div className="rounded border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
              Market Velocity
            </h3>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">
                  Pending-to-Active Ratio
                </span>
                <span className="text-sm font-bold text-primary">
                  {velocity.pendingToActiveRatio.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">Pending</span>
                <span className="text-sm font-bold text-primary">
                  {velocity.pendingCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">Active</span>
                <span className="text-sm font-bold text-primary">
                  {velocity.activeCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-secondary">Avg Recent DOM</span>
                <span className="text-sm font-bold text-primary">
                  {velocity.avgRecentDom.toFixed(0)} days
                </span>
              </div>
              <p className="text-[10px] text-secondary/70">
                {velocity.pendingToActiveRatio > 0.5
                  ? "High velocity -- strong buyer demand"
                  : velocity.pendingToActiveRatio > 0.2
                    ? "Moderate velocity -- steady demand"
                    : "Low velocity -- sluggish demand"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. YoY Comparison */}
      <div className="rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
          Year-over-Year Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 pr-4 text-left font-bold uppercase tracking-wider text-secondary">
                  Metric
                </th>
                <th className="px-4 py-2 text-right font-bold uppercase tracking-wider text-secondary">
                  {yoy.previousYear}
                </th>
                <th className="px-4 py-2 text-right font-bold uppercase tracking-wider text-secondary">
                  {yoy.currentYear}
                </th>
                <th className="py-2 pl-4 text-right font-bold uppercase tracking-wider text-secondary">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-secondary">Closings</td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  {yoy.previous.count.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  {yoy.current.count.toLocaleString()}
                </td>
                <td
                  className={`py-2 pl-4 text-right font-bold ${
                    yoy.countChange > 0
                      ? "text-green-600"
                      : yoy.countChange < 0
                        ? "text-red-600"
                        : "text-primary"
                  }`}
                >
                  {formatChange(yoy.countChange)}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 text-secondary">Median Price</td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  ${yoy.previous.medianPrice.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  ${yoy.current.medianPrice.toLocaleString()}
                </td>
                <td
                  className={`py-2 pl-4 text-right font-bold ${
                    yoy.priceChange > 0
                      ? "text-green-600"
                      : yoy.priceChange < 0
                        ? "text-red-600"
                        : "text-primary"
                  }`}
                >
                  {formatChange(yoy.priceChange)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-secondary">Median $/SF</td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  ${yoy.previous.medianPsf.toFixed(0)}
                </td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  ${yoy.current.medianPsf.toFixed(0)}
                </td>
                <td
                  className={`py-2 pl-4 text-right font-bold ${
                    yoy.psfChange > 0
                      ? "text-green-600"
                      : yoy.psfChange < 0
                        ? "text-red-600"
                        : "text-primary"
                  }`}
                >
                  {formatChange(yoy.psfChange)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Per-Building Market Table */}
      <div className="rounded border border-gray-200 bg-white">
        <h3 className="px-4 pt-4 text-xs font-bold uppercase tracking-wider text-secondary">
          Per-Building Breakdown
        </h3>
        <div className="mt-3 max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-accent text-white">
                {(
                  [
                    ["buildingName", "Building"],
                    ["activeCount", "Active"],
                    ["pendingCount", "Pending"],
                    ["closedLast12", "Closed (12mo)"],
                    ["medianPsf", "Median $/SF"],
                    ["absorptionRate", "Absorption"],
                    ["avgDom", "Avg DOM"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`cursor-pointer whitespace-nowrap px-3 py-2.5 text-left font-bold uppercase tracking-wider ${
                      key === "buildingName" ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                    {sortIndicator(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBuildingTable.map((row, i) => (
                <tr
                  key={row.buildingSlug}
                  className={`border-b border-gray-100 ${
                    i % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-primary">
                    {row.buildingName}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.activeCount}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.pendingCount}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.closedLast12}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.medianPsf > 0
                      ? `$${row.medianPsf.toFixed(0)}`
                      : "--"}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.absorptionRate === Infinity
                      ? "N/A"
                      : `${row.absorptionRate.toFixed(1)} mo`}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {row.avgDom > 0 ? row.avgDom.toFixed(0) : "--"}
                  </td>
                </tr>
              ))}
              {sortedBuildingTable.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-secondary"
                  >
                    No building data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
