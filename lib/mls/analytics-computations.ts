// Analytics computation utilities for market research
// Statistical functions, market metrics, and pricing guidance

import { AnalyticsListing } from "./analytics-types";
import type { MLSListing } from "./types";

// --- Core Statistics ---

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// --- Yearly Breakdown ---

export interface YearlyRow {
  year: number;
  count: number;
  medianPrice: number;
  medianPsf: number;
  medianDom: number;
  medianSf: number;
  medianHoaPsf: number;
  totalVolume: number;
  medianCpLp: number;
  medianCpOlp: number;
}

export function computeYearlyBreakdown(
  transactions: AnalyticsListing[]
): YearlyRow[] {
  const closed = transactions.filter((t) => t.status === "Closed");

  const byYear = new Map<number, AnalyticsListing[]>();
  for (const t of closed) {
    const year = t.closeDate
      ? parseInt(t.closeDate.substring(0, 4))
      : 0;
    if (year < 1990) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(t);
  }

  const rows: YearlyRow[] = [];
  for (const [year, items] of Array.from(byYear)) {
    const prices = items
      .map((t) => t.closePrice || 0)
      .filter((p) => p > 0);
    const psfs = items
      .map((t) =>
        t.closePrice && t.livingArea > 0
          ? t.closePrice / t.livingArea
          : 0
      )
      .filter((p) => p > 0);
    const doms = items.map((t) => t.daysOnMarket).filter((d) => d >= 0);
    const sfs = items.map((t) => t.livingArea).filter((s) => s > 0);
    const hoaPsfs = items
      .map((t) =>
        t.hoaFee && t.livingArea > 0 ? t.hoaFee / t.livingArea : 0
      )
      .filter((h) => h > 0);
    const cpLps = items.map((t) => t.cpLp || 0).filter((c) => c > 0);
    const cpOlps = items.map((t) => t.cpOlp || 0).filter((c) => c > 0);

    rows.push({
      year,
      count: items.length,
      medianPrice: median(prices),
      medianPsf: median(psfs),
      medianDom: median(doms),
      medianSf: median(sfs),
      medianHoaPsf: median(hoaPsfs),
      totalVolume: prices.reduce((a, b) => a + b, 0),
      medianCpLp: median(cpLps),
      medianCpOlp: median(cpOlps),
    });
  }

  return rows.sort((a, b) => b.year - a.year);
}

// --- Market Metrics ---

export interface AbsorptionRate {
  monthsOfSupply: number;
  activeCount: number;
  closedLast12Months: number;
  monthlyAbsorption: number;
}

export function computeAbsorptionRate(
  activeCount: number,
  closedLast12Months: number
): AbsorptionRate {
  const monthlyAbsorption = closedLast12Months / 12;
  const monthsOfSupply =
    monthlyAbsorption > 0 ? activeCount / monthlyAbsorption : Infinity;

  return {
    monthsOfSupply,
    activeCount,
    closedLast12Months,
    monthlyAbsorption,
  };
}

export interface PriceGap {
  medianActiveListPrice: number;
  medianRecentClosePrice: number;
  gapPercent: number; // positive = active priced above closed
  medianActivePsf: number;
  medianRecentClosePsf: number;
  psfGapPercent: number;
}

export function computePriceGap(
  activeListings: MLSListing[],
  recentClosed: AnalyticsListing[]
): PriceGap {
  const activePrices = activeListings
    .map((l) => l.listPrice)
    .filter((p) => p > 0);
  const closedPrices = recentClosed
    .map((l) => l.closePrice || 0)
    .filter((p) => p > 0);
  const activePsfs = activeListings
    .map((l) => l.priceSf)
    .filter((p) => p > 0);
  const closedPsfs = recentClosed
    .map((l) =>
      l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0
    )
    .filter((p) => p > 0);

  const medActive = median(activePrices);
  const medClosed = median(closedPrices);
  const medActivePsf = median(activePsfs);
  const medClosedPsf = median(closedPsfs);

  return {
    medianActiveListPrice: medActive,
    medianRecentClosePrice: medClosed,
    gapPercent: medClosed > 0 ? ((medActive - medClosed) / medClosed) * 100 : 0,
    medianActivePsf: medActivePsf,
    medianRecentClosePsf: medClosedPsf,
    psfGapPercent:
      medClosedPsf > 0
        ? ((medActivePsf - medClosedPsf) / medClosedPsf) * 100
        : 0,
  };
}

export interface MarketVelocity {
  pendingToActiveRatio: number;
  pendingCount: number;
  activeCount: number;
  avgRecentDom: number;
}

export function computeMarketVelocity(
  pendingCount: number,
  activeCount: number,
  recentClosedDoms: number[]
): MarketVelocity {
  return {
    pendingToActiveRatio: activeCount > 0 ? pendingCount / activeCount : 0,
    pendingCount,
    activeCount,
    avgRecentDom: mean(recentClosedDoms),
  };
}

// --- Appreciation ---

export interface Appreciation {
  totalGainPercent: number;
  yoyPercent: number; // CAGR
  startValue: number;
  endValue: number;
  years: number;
}

export function computeAppreciation(
  startValue: number,
  endValue: number,
  years: number
): Appreciation {
  const totalGain =
    startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
  const yoy =
    startValue > 0 && years > 0
      ? (Math.pow(endValue / startValue, 1 / years) - 1) * 100
      : 0;

  return {
    totalGainPercent: totalGain,
    yoyPercent: yoy,
    startValue,
    endValue,
    years,
  };
}

// --- Seasonal Patterns ---

export interface MonthlyPattern {
  month: number; // 1-12
  monthName: string;
  count: number;
  medianValue: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function computeSeasonalPattern(
  transactions: AnalyticsListing[],
  dateField: "closeDate" | "offMarketDate" | "listingContractDate" | "pendingTimestamp"
): MonthlyPattern[] {
  const byMonth = new Map<number, AnalyticsListing[]>();

  for (const t of transactions) {
    const dateStr = t[dateField as keyof AnalyticsListing] as string | undefined;
    if (!dateStr) continue;

    const month = parseInt(dateStr.substring(5, 7));
    if (month < 1 || month > 12) continue;

    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(t);
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const items = byMonth.get(month) || [];
    const prices = items
      .map((t) => t.closePrice || t.listPrice)
      .filter((p) => p > 0);

    return {
      month,
      monthName: MONTH_NAMES[i],
      count: items.length,
      medianValue: median(prices),
    };
  });
}

// --- Pricing Tool ---

export interface PricingComp {
  listing: AnalyticsListing;
  similarity: number; // 0-1 score
}

export interface PricingGuidance {
  comps: PricingComp[];
  suggestedPriceRange: { low: number; high: number };
  suggestedPsfRange: { low: number; high: number };
  medianCompPrice: number;
  medianCompPsf: number;
  compCount: number;
}

export function computePricingComps(
  targetBuildingSlug: string,
  targetBedrooms: number,
  targetSqft: number,
  closedListings: AnalyticsListing[],
  allBuildingSlugs: string[], // For expanding to nearby buildings
  monthsBack: number = 12
): PricingGuidance {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
  const cutoff = cutoffDate.toISOString().substring(0, 10);

  // Filter to recent closed listings
  const recent = closedListings.filter(
    (l) =>
      l.status === "Closed" &&
      l.closeDate &&
      l.closeDate >= cutoff &&
      l.closePrice &&
      l.closePrice > 0
  );

  // Score and rank comps
  const scored: PricingComp[] = [];

  for (const listing of recent) {
    let similarity = 0;

    // Same building = highest weight
    if (listing.buildingSlug === targetBuildingSlug) {
      similarity += 0.5;
    } else {
      similarity += 0.1; // Different building gets a small base
    }

    // Bedroom match
    if (listing.bedroomsTotal === targetBedrooms) {
      similarity += 0.3;
    } else if (Math.abs(listing.bedroomsTotal - targetBedrooms) === 1) {
      similarity += 0.1;
    }

    // Sqft similarity (within 20% = good)
    if (targetSqft > 0 && listing.livingArea > 0) {
      const sqftRatio = Math.min(listing.livingArea, targetSqft) /
        Math.max(listing.livingArea, targetSqft);
      similarity += sqftRatio * 0.2;
    }

    scored.push({ listing, similarity });
  }

  // Sort by similarity (highest first), take top comps
  scored.sort((a, b) => b.similarity - a.similarity);

  // Take comps: prefer same building, expand if needed
  const sameBuildingComps = scored.filter(
    (c) => c.listing.buildingSlug === targetBuildingSlug
  );

  let comps: PricingComp[];
  if (sameBuildingComps.length >= 3) {
    comps = sameBuildingComps.slice(0, 10);
  } else {
    // Not enough same-building comps, expand to nearby
    comps = scored.slice(0, 10);
  }

  if (comps.length === 0) {
    return {
      comps: [],
      suggestedPriceRange: { low: 0, high: 0 },
      suggestedPsfRange: { low: 0, high: 0 },
      medianCompPrice: 0,
      medianCompPsf: 0,
      compCount: 0,
    };
  }

  const compPrices = comps
    .map((c) => c.listing.closePrice!)
    .filter((p) => p > 0);
  const compPsfs = comps
    .map((c) =>
      c.listing.closePrice && c.listing.livingArea > 0
        ? c.listing.closePrice / c.listing.livingArea
        : 0
    )
    .filter((p) => p > 0);

  const medPsf = median(compPsfs);
  const p25Psf = percentile(compPsfs, 25);
  const p75Psf = percentile(compPsfs, 75);

  return {
    comps,
    suggestedPriceRange: {
      low: Math.round(p25Psf * targetSqft),
      high: Math.round(p75Psf * targetSqft),
    },
    suggestedPsfRange: {
      low: Math.round(p25Psf),
      high: Math.round(p75Psf),
    },
    medianCompPrice: median(compPrices),
    medianCompPsf: medPsf,
    compCount: comps.length,
  };
}

// --- YoY Comparison ---

export interface YoYComparison {
  currentYear: number;
  previousYear: number;
  current: { count: number; medianPrice: number; medianPsf: number };
  previous: { count: number; medianPrice: number; medianPsf: number };
  countChange: number; // percent
  priceChange: number; // percent
  psfChange: number; // percent
}

export function computeYoYComparison(
  closedListings: AnalyticsListing[]
): YoYComparison {
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  const currentYearItems = closedListings.filter(
    (l) =>
      l.status === "Closed" &&
      l.closeDate &&
      l.closeDate.startsWith(String(currentYear))
  );
  const previousYearItems = closedListings.filter(
    (l) =>
      l.status === "Closed" &&
      l.closeDate &&
      l.closeDate.startsWith(String(previousYear))
  );

  const currentPrices = currentYearItems
    .map((l) => l.closePrice || 0)
    .filter((p) => p > 0);
  const previousPrices = previousYearItems
    .map((l) => l.closePrice || 0)
    .filter((p) => p > 0);
  const currentPsfs = currentYearItems
    .map((l) =>
      l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0
    )
    .filter((p) => p > 0);
  const previousPsfs = previousYearItems
    .map((l) =>
      l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0
    )
    .filter((p) => p > 0);

  const cMedPrice = median(currentPrices);
  const pMedPrice = median(previousPrices);
  const cMedPsf = median(currentPsfs);
  const pMedPsf = median(previousPsfs);

  return {
    currentYear,
    previousYear,
    current: {
      count: currentYearItems.length,
      medianPrice: cMedPrice,
      medianPsf: cMedPsf,
    },
    previous: {
      count: previousYearItems.length,
      medianPrice: pMedPrice,
      medianPsf: pMedPsf,
    },
    countChange:
      previousYearItems.length > 0
        ? ((currentYearItems.length - previousYearItems.length) /
            previousYearItems.length) *
          100
        : 0,
    priceChange: pMedPrice > 0 ? ((cMedPrice - pMedPrice) / pMedPrice) * 100 : 0,
    psfChange: pMedPsf > 0 ? ((cMedPsf - pMedPsf) / pMedPsf) * 100 : 0,
  };
}

// --- Building Market Table ---

export interface BuildingMarketRow {
  buildingSlug: string;
  buildingName: string;
  activeCount: number;
  pendingCount: number;
  closedLast12: number;
  medianPsf: number;
  absorptionRate: number;
  avgDom: number;
  medianPrice: number;
  medianHoaPsf: number;
  medianSf: number;
}

export function computeBuildingMarketTable(
  analyticsListings: AnalyticsListing[],
  activeListings: MLSListing[],
  buildingsData: Array<{ slug: string; name: string }>
): BuildingMarketRow[] {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const cutoff = cutoffDate.toISOString().substring(0, 10);

  return buildingsData.map((building) => {
    const active = activeListings.filter(
      (l) =>
        (l as any).buildingSlug === building.slug ||
        (l as any).buildingName === building.name
    );
    const pending = analyticsListings.filter(
      (l) =>
        l.buildingSlug === building.slug && l.status === "Pending"
    );
    const closed12 = analyticsListings.filter(
      (l) =>
        l.buildingSlug === building.slug &&
        l.status === "Closed" &&
        l.closeDate &&
        l.closeDate >= cutoff
    );

    const closedPsfs = closed12
      .map((l) =>
        l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0
      )
      .filter((p) => p > 0);
    const closedDoms = closed12
      .map((l) => l.daysOnMarket)
      .filter((d) => d >= 0);
    const closedPrices = closed12
      .map((l) => l.closePrice || 0)
      .filter((p) => p > 0);
    const closedSfs = closed12
      .map((l) => l.livingArea)
      .filter((s) => s > 0);
    const buildingListings = analyticsListings.filter(
      (l) => l.buildingSlug === building.slug
    );
    const hoaPsfs = buildingListings
      .map((l) => (l.hoaFee && l.livingArea > 0 ? l.hoaFee / l.livingArea : 0))
      .filter((h) => h > 0);

    const monthlyRate = closed12.length / 12;

    return {
      buildingSlug: building.slug,
      buildingName: building.name,
      activeCount: active.length,
      pendingCount: pending.length,
      closedLast12: closed12.length,
      medianPsf: median(closedPsfs),
      absorptionRate:
        monthlyRate > 0 ? active.length / monthlyRate : Infinity,
      avgDom: mean(closedDoms),
      medianPrice: median(closedPrices),
      medianHoaPsf: median(hoaPsfs),
      medianSf: median(closedSfs),
    };
  });
}

/**
 * Building comparison table computed purely from AnalyticsListing[].
 * Used by the /data page's Building Comparison tab — no MLSListing[] dependency.
 */
export function computeBuildingComparisonTable(
  analyticsListings: AnalyticsListing[],
  buildingsData: Array<{ slug: string; name: string }>
): BuildingMarketRow[] {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 12);
  const cutoff = cutoffDate.toISOString().substring(0, 10);

  return buildingsData.map((building) => {
    const buildingListings = analyticsListings.filter(
      (l) => l.buildingSlug === building.slug
    );
    const active = buildingListings.filter(
      (l) => l.status === "Active" || l.status === "Active Under Contract"
    );
    const pending = buildingListings.filter((l) => l.status === "Pending");
    const closed12 = buildingListings.filter(
      (l) => l.status === "Closed" && l.closeDate && l.closeDate >= cutoff
    );

    const closedPrices = closed12.map((l) => l.closePrice || 0).filter((p) => p > 0);
    const closedPsfs = closed12
      .map((l) => (l.closePrice && l.livingArea > 0 ? l.closePrice / l.livingArea : 0))
      .filter((p) => p > 0);
    const closedDoms = closed12.map((l) => l.daysOnMarket).filter((d) => d >= 0);
    const closedSfs = closed12.map((l) => l.livingArea).filter((s) => s > 0);
    const hoaPsfs = buildingListings
      .map((l) => (l.hoaFee && l.livingArea > 0 ? l.hoaFee / l.livingArea : 0))
      .filter((h) => h > 0);

    const monthlyRate = closed12.length / 12;

    return {
      buildingSlug: building.slug,
      buildingName: building.name,
      activeCount: active.length,
      pendingCount: pending.length,
      closedLast12: closed12.length,
      medianPsf: median(closedPsfs),
      absorptionRate: monthlyRate > 0 ? active.length / monthlyRate : Infinity,
      avgDom: mean(closedDoms),
      medianPrice: median(closedPrices),
      medianHoaPsf: median(hoaPsfs),
      medianSf: median(closedSfs),
    };
  });
}

// --- Utility ---

export function filterByDateRange(
  listings: AnalyticsListing[],
  from: string | null,
  to: string | null
): AnalyticsListing[] {
  return listings.filter((l) => {
    const date = l.status === "Closed" ? l.closeDate : l.listingContractDate;
    if (!date) return true;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

export function getLast12MonthsCutoff(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().substring(0, 10);
}
