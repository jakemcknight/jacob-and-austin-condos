"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";
import { median, computeSeasonalPattern } from "@/lib/mls/analytics-computations";
import SummaryCards from "@/components/analytics/SummaryCards";

const OFF_MARKET_STATUSES = ["Withdrawn", "Hold", "Expired", "Canceled"];

interface OffMarketAnalysisProps {
  analyticsListings: AnalyticsListing[];
}

function formatPrice(value: number): string {
  if (value === 0) return "$0";
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OffMarketAnalysis({
  analyticsListings,
}: OffMarketAnalysisProps) {
  // --- Filter to off-market listings ---
  const offMarketListings = useMemo(
    () =>
      analyticsListings.filter((l) =>
        OFF_MARKET_STATUSES.includes(l.status)
      ),
    [analyticsListings]
  );

  // --- Summary card data ---
  const summaryCards = useMemo(() => {
    const total = offMarketListings.length;

    const listPrices = offMarketListings
      .map((l) => l.listPrice)
      .filter((p) => p > 0);
    const medianListPrice = median(listPrices);

    const statusCounts: Record<string, number> = {};
    for (const l of offMarketListings) {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    }
    const breakdownParts = OFF_MARKET_STATUSES
      .filter((s) => statusCounts[s])
      .map((s) => `${statusCounts[s]} ${s}`);
    const breakdownStr = breakdownParts.join(", ") || "None";

    return [
      {
        label: "Total Off-Market",
        value: total.toLocaleString(),
      },
      {
        label: "Median List Price at Withdrawal",
        value: formatPrice(medianListPrice),
      },
      {
        label: "Status Breakdown",
        value: breakdownStr,
      },
    ];
  }, [offMarketListings]);

  // --- Overpricing analysis ---
  const overpricingAnalysis = useMemo(() => {
    const withdrawnPrices = offMarketListings
      .map((l) => l.listPrice)
      .filter((p) => p > 0);
    const medianWithdrawnListPrice = median(withdrawnPrices);

    const closedListings = analyticsListings.filter(
      (l) => l.status === "Closed" && l.closePrice && l.closePrice > 0
    );
    const closedPrices = closedListings
      .map((l) => l.closePrice!)
      .filter((p) => p > 0);
    const medianClosePrice = median(closedPrices);

    const gapPercent =
      medianClosePrice > 0
        ? ((medianWithdrawnListPrice - medianClosePrice) / medianClosePrice) *
          100
        : 0;

    return {
      medianWithdrawnListPrice,
      medianClosePrice,
      gapPercent,
      withdrawnCount: withdrawnPrices.length,
      closedCount: closedPrices.length,
    };
  }, [offMarketListings, analyticsListings]);

  // --- Seasonal withdrawal patterns ---
  const seasonalData = useMemo(() => {
    // Try offMarketDate first, fall back to statusChangeTimestamp
    const withOffMarketDate = offMarketListings.filter(
      (l) => l.offMarketDate
    );
    const withStatusChange = offMarketListings.filter(
      (l) => l.statusChangeTimestamp
    );

    if (withOffMarketDate.length >= withStatusChange.length) {
      return computeSeasonalPattern(offMarketListings, "offMarketDate");
    }
    // Use statusChangeTimestamp-based approach manually
    const byMonth = new Map<number, number>();
    for (const l of offMarketListings) {
      const dateStr = l.statusChangeTimestamp || l.offMarketDate;
      if (!dateStr) continue;
      const month = parseInt(dateStr.substring(5, 7));
      if (month >= 1 && month <= 12) {
        byMonth.set(month, (byMonth.get(month) || 0) + 1);
      }
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: monthNames[i],
      count: byMonth.get(i + 1) || 0,
      medianValue: 0,
    }));
  }, [offMarketListings]);

  // --- Sorted table data ---
  const sortedListings = useMemo(() => {
    return [...offMarketListings].sort((a, b) => {
      const dateA = a.offMarketDate || a.statusChangeTimestamp || "";
      const dateB = b.offMarketDate || b.statusChangeTimestamp || "";
      return dateB.localeCompare(dateA);
    });
  }, [offMarketListings]);

  if (offMarketListings.length === 0) {
    return (
      <div className="py-12 text-center text-secondary">
        <p className="text-lg font-semibold">No off-market listings found</p>
        <p className="mt-1 text-sm">
          Off-market listings include Withdrawn, Hold, Expired, and Canceled statuses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Section 2: Overpricing Analysis */}
      <div className="rounded border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
          Overpricing Analysis
        </h3>
        <p className="mt-1 text-xs text-secondary/70">
          Compares the median list price of withdrawn/failed listings against
          the median close price of successfully sold listings to reveal
          overpricing patterns.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              Median List Price (Off-Market)
            </p>
            <p className="mt-1 text-xl font-bold text-primary">
              {formatPrice(overpricingAnalysis.medianWithdrawnListPrice)}
            </p>
            <p className="mt-0.5 text-xs text-secondary">
              {overpricingAnalysis.withdrawnCount} listing
              {overpricingAnalysis.withdrawnCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              Median Close Price (Sold)
            </p>
            <p className="mt-1 text-xl font-bold text-primary">
              {formatPrice(overpricingAnalysis.medianClosePrice)}
            </p>
            <p className="mt-0.5 text-xs text-secondary">
              {overpricingAnalysis.closedCount} listing
              {overpricingAnalysis.closedCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              Overpricing Gap
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                overpricingAnalysis.gapPercent > 0
                  ? "text-red-600"
                  : overpricingAnalysis.gapPercent < 0
                    ? "text-green-600"
                    : "text-primary"
              }`}
            >
              {overpricingAnalysis.gapPercent > 0 ? "+" : ""}
              {overpricingAnalysis.gapPercent.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-xs text-secondary">
              {overpricingAnalysis.gapPercent > 0
                ? "Off-market listings priced above sold"
                : overpricingAnalysis.gapPercent < 0
                  ? "Off-market listings priced below sold"
                  : "No gap detected"}
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Seasonal Patterns */}
      <div className="rounded border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
          Seasonal Withdrawal Patterns
        </h3>
        <p className="mt-1 text-xs text-secondary/70">
          Which months see the most listings withdrawn from market.
        </p>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={seasonalData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="monthName"
                tick={{ fontSize: 11, fill: "#4A3427" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#4A3427" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
                formatter={(value) => [value, "Withdrawals"]}
              />
              <Bar
                dataKey="count"
                fill="#4A3427"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 4: Off-Market Listings Table */}
      <div className="rounded border border-gray-200 bg-white">
        <h3 className="px-5 pt-5 text-sm font-bold uppercase tracking-wider text-secondary">
          Off-Market Listings
        </h3>
        <p className="mt-1 px-5 text-xs text-secondary/70">
          {offMarketListings.length} listing
          {offMarketListings.length !== 1 ? "s" : ""} sorted by most recent.
        </p>

        <div className="mt-4 max-h-[500px] overflow-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-accent text-white">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Building
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Unit
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Beds
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Baths
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  List Price
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  $/SF
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  DOM
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Off-Market Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedListings.map((listing, idx) => (
                <tr
                  key={listing.listingId}
                  className={
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                    {listing.buildingName || "Unknown"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-secondary">
                    {listing.unitNumber || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        listing.status === "Withdrawn"
                          ? "bg-red-100 text-red-700"
                          : listing.status === "Expired"
                            ? "bg-orange-100 text-orange-700"
                            : listing.status === "Hold"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {listing.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center text-secondary">
                    {listing.bedroomsTotal}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center text-secondary">
                    {listing.bathroomsTotalInteger}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                    {formatPrice(listing.listPrice)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-secondary">
                    {listing.priceSf > 0
                      ? `$${Math.round(listing.priceSf).toLocaleString()}`
                      : "N/A"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center text-secondary">
                    {listing.daysOnMarket}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-secondary">
                    {formatDate(
                      listing.offMarketDate || listing.statusChangeTimestamp
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
