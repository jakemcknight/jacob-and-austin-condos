"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsListing } from "@/lib/mls/analytics-types";
import type { MLSListing } from "@/lib/mls/types";
import {
  computePricingComps,
  median,
} from "@/lib/mls/analytics-computations";
import SummaryCards from "@/components/analytics/SummaryCards";

interface PricingToolProps {
  analyticsListings: AnalyticsListing[];
  activeListings: MLSListing[];
  buildings: Array<{ slug: string; name: string }>;
}

function formatPrice(value: number): string {
  if (value === 0) return "$0";
  return `$${value.toLocaleString()}`;
}

function formatPsf(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default function PricingTool({
  analyticsListings,
  activeListings,
  buildings,
}: PricingToolProps) {
  // --- Input State ---
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [sqft, setSqft] = useState<number>(0);
  const [monthsBack, setMonthsBack] = useState<number>(12);

  // --- Sorted buildings for the dropdown ---
  const sortedBuildings = useMemo(
    () => [...buildings].sort((a, b) => a.name.localeCompare(b.name)),
    [buildings]
  );

  // --- All building slugs for the computation ---
  const allBuildingSlugs = useMemo(
    () => buildings.map((b) => b.slug),
    [buildings]
  );

  // --- Compute pricing comps ---
  const guidance = useMemo(() => {
    if (!selectedBuilding) return null;
    return computePricingComps(
      selectedBuilding,
      bedrooms,
      sqft,
      analyticsListings,
      allBuildingSlugs,
      monthsBack
    );
  }, [selectedBuilding, bedrooms, sqft, analyticsListings, allBuildingSlugs, monthsBack]);

  const selectedBuildingName = useMemo(() => {
    const b = buildings.find((b) => b.slug === selectedBuilding);
    return b?.name ?? "";
  }, [buildings, selectedBuilding]);

  // --- Active competition: match building + bedroom count ---
  const competingActive = useMemo(() => {
    if (!selectedBuilding) return [];
    return activeListings.filter((l) => {
      const slug =
        (l as any).buildingSlug as string | undefined;
      const matchesBuilding =
        slug === selectedBuilding || l.buildingName === selectedBuildingName;
      const matchesBeds =
        bedrooms >= 4
          ? l.bedroomsTotal >= 4
          : l.bedroomsTotal === bedrooms;
      return matchesBuilding && matchesBeds;
    });
  }, [activeListings, selectedBuilding, selectedBuildingName, bedrooms]);

  // --- CP/LP analysis from comps ---
  const cpLpAnalysis = useMemo(() => {
    if (!guidance || guidance.comps.length === 0) return null;
    const cpLpValues = guidance.comps
      .map((c) => c.listing.cpLp)
      .filter((v): v is number => v !== undefined && v > 0);
    if (cpLpValues.length === 0) return null;
    const atOrAbove = cpLpValues.filter((v) => v >= 1.0).length;
    const pctAtOrAbove = atOrAbove / cpLpValues.length;
    const medianCpLp = median(cpLpValues);
    return { pctAtOrAbove, medianCpLp, total: cpLpValues.length };
  }, [guidance]);

  // --- Historical trend: yearly median $/SF for building + bedroom count ---
  const trendData = useMemo(() => {
    if (!selectedBuilding) return [];

    const closed = analyticsListings.filter(
      (l) =>
        l.status === "Closed" &&
        l.buildingSlug === selectedBuilding &&
        (bedrooms >= 4
          ? l.bedroomsTotal >= 4
          : l.bedroomsTotal === bedrooms) &&
        l.closeDate &&
        l.closePrice &&
        l.closePrice > 0 &&
        l.livingArea > 0
    );

    const byYear = new Map<number, number[]>();
    for (const l of closed) {
      const year = parseInt(l.closeDate!.substring(0, 4));
      if (year < 2000) continue;
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(l.closePrice! / l.livingArea);
    }

    const rows: { year: number; medianPsf: number }[] = [];
    for (const [year, psfs] of Array.from(byYear)) {
      rows.push({ year, medianPsf: Math.round(median(psfs)) });
    }

    return rows.sort((a, b) => a.year - b.year);
  }, [analyticsListings, selectedBuilding, bedrooms]);

  // --- Where target would rank among active competition ---
  const targetRank = useMemo(() => {
    if (
      !guidance ||
      guidance.medianCompPrice === 0 ||
      competingActive.length === 0
    )
      return null;
    const suggestedMid = Math.round(
      (guidance.suggestedPriceRange.low + guidance.suggestedPriceRange.high) / 2
    );
    const activePrices = competingActive
      .map((l) => l.listPrice)
      .sort((a, b) => a - b);
    let rank = 1;
    for (const p of activePrices) {
      if (suggestedMid > p) rank++;
    }
    return { rank, total: activePrices.length + 1, suggestedMid };
  }, [guidance, competingActive]);

  // --- Summary cards data ---
  const summaryCards = useMemo(() => {
    if (!guidance) return [];
    return [
      {
        label: "Comps Found",
        value: String(guidance.compCount),
      },
      {
        label: "Median Comp Price",
        value: formatPrice(Math.round(guidance.medianCompPrice)),
      },
      {
        label: "Median Comp $/SF",
        value: formatPsf(guidance.medianCompPsf),
      },
      {
        label: "Suggested Price Range",
        value:
          guidance.suggestedPriceRange.low > 0
            ? `${formatPrice(guidance.suggestedPriceRange.low)} - ${formatPrice(guidance.suggestedPriceRange.high)}`
            : "N/A",
        subvalue:
          guidance.suggestedPsfRange.low > 0
            ? `${formatPsf(guidance.suggestedPsfRange.low)} - ${formatPsf(guidance.suggestedPsfRange.high)} /SF`
            : undefined,
      },
    ];
  }, [guidance]);

  // --- CP/LP interpretation text ---
  function getCpLpInterpretation(
    pctAtOrAbove: number,
    medianCpLp: number
  ): string {
    if (medianCpLp >= 1.0 && pctAtOrAbove >= 0.6) {
      return "Sellers are in a strong position. Most comps sold at or above asking price, suggesting buyers are competing and offers above list price are common.";
    }
    if (medianCpLp >= 0.97 && pctAtOrAbove >= 0.4) {
      return "The market is balanced. Comps are selling close to asking price with modest negotiation. Pricing at market value is advisable.";
    }
    return "Buyers have negotiating leverage. Most comps sold below asking price. Consider pricing slightly below market to attract competitive offers.";
  }

  return (
    <div className="space-y-6">
      {/* --- Input Controls --- */}
      <div className="rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
          Pricing Inputs
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Building */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-secondary">
              Building
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select a building...</option>
              {sortedBuildings.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bedrooms */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-secondary">
              Bedrooms
            </label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={0}>Studio</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4+</option>
            </select>
          </div>

          {/* Sqft */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-secondary">
              Approx. Sqft
            </label>
            <input
              type="number"
              value={sqft || ""}
              onChange={(e) => setSqft(Number(e.target.value) || 0)}
              placeholder="e.g. 1200"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Time Window */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-secondary">
              Time Window
            </label>
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(Number(e.target.value))}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- No building selected state --- */}
      {!selectedBuilding && (
        <div className="rounded border border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-secondary">
            Select a building above to find comparable sales and pricing
            guidance.
          </p>
        </div>
      )}

      {/* --- Results --- */}
      {selectedBuilding && guidance && (
        <>
          {/* No comps found */}
          {guidance.compCount === 0 && (
            <div className="rounded border border-gray-200 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-primary">
                No comparable sales found
              </p>
              <p className="mt-1 text-xs text-secondary">
                Try expanding the time window or adjusting bedroom count.
              </p>
            </div>
          )}

          {/* Summary Cards */}
          {guidance.compCount > 0 && (
            <>
              <SummaryCards cards={summaryCards} />

              {/* --- Comp Table --- */}
              <div className="rounded border border-gray-200 bg-white">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
                    Comparable Sales
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Building
                        </th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Unit
                        </th>
                        <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Close Date
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Close Price
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                          $/SF
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Beds
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Baths
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                          SF
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                          DOM
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Similarity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {guidance.comps.map((comp) => {
                        const l = comp.listing;
                        const isSameBuilding =
                          l.buildingSlug === selectedBuilding;
                        const compPsf =
                          l.closePrice && l.livingArea > 0
                            ? l.closePrice / l.livingArea
                            : 0;
                        return (
                          <tr
                            key={l.listingId}
                            className={`border-b border-gray-50 ${
                              isSameBuilding
                                ? "bg-denim/5"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-3 py-2 text-xs font-medium text-primary">
                              {l.buildingName}
                            </td>
                            <td className="px-3 py-2 text-xs text-secondary">
                              {l.unitNumber || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs text-secondary">
                              {l.closeDate
                                ? new Date(l.closeDate).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-primary">
                              {l.closePrice
                                ? formatPrice(l.closePrice)
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-secondary">
                              {compPsf > 0 ? formatPsf(compPsf) : "-"}
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-secondary">
                              {l.bedroomsTotal === 0
                                ? "S"
                                : l.bedroomsTotal}
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-secondary">
                              {l.bathroomsTotalInteger}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-secondary">
                              {l.livingArea > 0
                                ? l.livingArea.toLocaleString()
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-secondary">
                              {l.daysOnMarket >= 0 ? l.daysOnMarket : "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-accent">
                              {formatPercent(comp.similarity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* --- Active Competition --- */}
              {competingActive.length > 0 && (
                <div className="rounded border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
                      Active Competition
                    </h3>
                    <p className="mt-0.5 text-xs text-secondary">
                      {competingActive.length} competing active listing
                      {competingActive.length !== 1 ? "s" : ""} with{" "}
                      {bedrooms === 0 ? "studio" : `${bedrooms}BR`} units
                      {targetRank && (
                        <>
                          {" "}
                          &mdash; suggested price would rank{" "}
                          <span className="font-medium text-primary">
                            #{targetRank.rank} of {targetRank.total}
                          </span>{" "}
                          by price
                        </>
                      )}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
                            Building
                          </th>
                          <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
                            Unit
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                            List Price
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                            $/SF
                          </th>
                          <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-secondary">
                            Beds
                          </th>
                          <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-secondary">
                            Baths
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                            SF
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-secondary">
                            DOM
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {competingActive
                          .sort((a, b) => a.listPrice - b.listPrice)
                          .map((l) => (
                            <tr
                              key={l.listingId}
                              className="border-b border-gray-50 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-xs font-medium text-primary">
                                {l.buildingName}
                              </td>
                              <td className="px-3 py-2 text-xs text-secondary">
                                {l.unitNumber || "-"}
                              </td>
                              <td className="px-3 py-2 text-right text-xs font-medium text-primary">
                                {formatPrice(l.listPrice)}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-secondary">
                                {l.priceSf > 0 ? formatPsf(l.priceSf) : "-"}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-secondary">
                                {l.bedroomsTotal === 0
                                  ? "S"
                                  : l.bedroomsTotal}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-secondary">
                                {l.bathroomsTotalInteger}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-secondary">
                                {l.livingArea > 0
                                  ? l.livingArea.toLocaleString()
                                  : "-"}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-secondary">
                                {l.daysOnMarket >= 0 ? l.daysOnMarket : "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- CP/LP Analysis --- */}
              {cpLpAnalysis && (
                <div className="rounded border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
                    Close Price / List Price Analysis
                  </h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                        Sold At or Above Asking
                      </p>
                      <p className="mt-1 text-xl font-bold text-primary">
                        {(cpLpAnalysis.pctAtOrAbove * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-secondary">
                        {Math.round(
                          cpLpAnalysis.pctAtOrAbove * cpLpAnalysis.total
                        )}{" "}
                        of {cpLpAnalysis.total} comps
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                        Median CP/LP Ratio
                      </p>
                      <p className="mt-1 text-xl font-bold text-primary">
                        {(cpLpAnalysis.medianCpLp * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-secondary">
                        {cpLpAnalysis.medianCpLp >= 1.0
                          ? "At or above asking"
                          : `${((1 - cpLpAnalysis.medianCpLp) * 100).toFixed(1)}% below asking`}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                        Interpretation
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-secondary">
                        {getCpLpInterpretation(
                          cpLpAnalysis.pctAtOrAbove,
                          cpLpAnalysis.medianCpLp
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Historical Trend Line --- */}
              {trendData.length >= 2 && (
                <div className="rounded border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
                    Historical $/SF Trend &mdash; {selectedBuildingName},{" "}
                    {bedrooms === 0
                      ? "Studio"
                      : `${bedrooms}BR${bedrooms >= 4 ? "+" : ""}`}
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e5e7eb"
                        />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 11, fill: "#4A3427" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#4A3427" }}
                          tickLine={false}
                          tickFormatter={(v: number) => `$${v}`}
                        />
                        <Tooltip
                          formatter={(value) => [
                            `$${Number(value).toLocaleString()}/SF`,
                            "Median $/SF",
                          ]}
                          labelFormatter={(label) => `${label}`}
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="medianPsf"
                          stroke="#886752"
                          strokeWidth={2}
                          dot={{ fill: "#886752", r: 3 }}
                          activeDot={{ r: 5, fill: "#886752" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {trendData.length > 0 && trendData.length < 2 && (
                <div className="rounded border border-gray-200 bg-white px-4 py-6 text-center">
                  <p className="text-xs text-secondary">
                    Not enough yearly data to display a trend line. Only{" "}
                    {trendData.length} year of data available.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
