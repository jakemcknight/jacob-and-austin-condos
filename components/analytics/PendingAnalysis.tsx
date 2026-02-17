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
import { median, mean, computeSeasonalPattern } from "@/lib/mls/analytics-computations";
import SummaryCards from "@/components/analytics/SummaryCards";

interface PendingAnalysisProps {
  analyticsListings: AnalyticsListing[];
}

export default function PendingAnalysis({
  analyticsListings,
}: PendingAnalysisProps) {
  // Current pending listings (status === 'Pending')
  const pendingListings = useMemo(
    () => analyticsListings.filter((l) => l.status === "Pending"),
    [analyticsListings]
  );

  // Summary card values
  const summaryCards = useMemo(() => {
    const prices = pendingListings
      .map((l) => l.listPrice)
      .filter((p) => p > 0);
    const doms = pendingListings
      .map((l) => l.daysOnMarket)
      .filter((d) => d >= 0);
    const psfs = pendingListings
      .map((l) => l.priceSf)
      .filter((p) => p > 0);

    return [
      {
        label: "Total Pending",
        value: pendingListings.length.toLocaleString(),
      },
      {
        label: "Median List Price",
        value: prices.length > 0 ? `$${median(prices).toLocaleString()}` : "$0",
      },
      {
        label: "Avg DOM Before Pending",
        value: doms.length > 0 ? `${Math.round(mean(doms))}` : "0",
        subvalue: "days",
      },
      {
        label: "Median $/SF",
        value:
          psfs.length > 0
            ? `$${Math.round(median(psfs)).toLocaleString()}`
            : "$0",
      },
    ];
  }, [pendingListings]);

  // Monthly pending trend — seasonal pattern using pendingTimestamp
  const monthlyPendingData = useMemo(() => {
    const listingsWithPending = analyticsListings.filter(
      (l) => l.pendingTimestamp
    );
    return computeSeasonalPattern(listingsWithPending, "pendingTimestamp");
  }, [analyticsListings]);

  // Table rows sorted by most recent list date first
  const tableRows = useMemo(() => {
    return [...pendingListings].sort((a, b) => {
      const dateA = a.listingContractDate || "";
      const dateB = b.listingContractDate || "";
      return dateB.localeCompare(dateA);
    });
  }, [pendingListings]);

  return (
    <div className="space-y-8">
      {/* Section 1: Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Section 2: Monthly Pending Trend */}
      <div className="rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-primary">
          Monthly Pending Trend
        </h3>
        <p className="mb-4 text-xs text-secondary">
          Seasonal pattern of listings going pending by month
        </p>
        {monthlyPendingData.some((d) => d.count > 0) ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyPendingData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="monthName"
                  tick={{ fontSize: 11, fill: "#4A3427" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#4A3427" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 4,
                    borderColor: "#e5e7eb",
                  }}
                  formatter={(value) => [value, "Pending"]}
                  labelStyle={{ fontWeight: 700, color: "#191919" }}
                />
                <Bar
                  dataKey="count"
                  fill="#93B9BC"
                  radius={[3, 3, 0, 0]}
                  name="Pending"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-secondary">
            No pending timestamp data available for seasonal analysis.
          </p>
        )}
      </div>

      {/* Section 3: Pending Listings Table */}
      <div className="rounded border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-accent text-white">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">
                  Building
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider">
                  Beds
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider">
                  Baths
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">
                  List Price
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">
                  $/SF
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">
                  DOM
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">
                  List Date
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length > 0 ? (
                tableRows.map((listing, idx) => (
                  <tr
                    key={listing.listingId}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 font-medium text-primary">
                      {listing.buildingName}
                    </td>
                    <td className="px-3 py-2 text-secondary">
                      {listing.unitNumber || "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-secondary">
                      {listing.bedroomsTotal}
                    </td>
                    <td className="px-3 py-2 text-center text-secondary">
                      {listing.bathroomsTotalInteger}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-primary">
                      ${listing.listPrice.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      ${Math.round(listing.priceSf).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {listing.daysOnMarket}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {listing.listingContractDate || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-12 text-center text-secondary"
                  >
                    No pending listings found.
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
