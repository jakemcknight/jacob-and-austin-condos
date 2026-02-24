"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useRef, useEffect } from "react";
import type { FilterState, StatusFilter } from "@/components/filters/FilterBar";

// ─── Defaults ────────────────────────────────────────────────────────

const ALL_LISTINGS_DEFAULTS: FilterState = {
  listingTypeFilter: "Sale",
  statusFilter: "active",
  bedroomFilters: [],
  selectedBuildings: [],
  priceMin: "",
  priceMax: "",
  sqftMin: "",
  sqftMax: "",
  sortBy: "dom",
  floorPlanFilters: [],
  orientationFilters: [],
  maxDom: null,
  listedAfter: null,
  listedBefore: null,
};

// ─── Parse URL → FilterState ─────────────────────────────────────────

function parseFiltersFromParams(params: URLSearchParams): FilterState {
  const filters = { ...ALL_LISTINGS_DEFAULTS };

  const type = params.get("type");
  if (type === "lease") filters.listingTypeFilter = "Lease";

  const status = params.get("status");
  const validStatuses: StatusFilter[] = ["active", "pending", "sold", "offmarket", "all"];
  if (status && validStatuses.includes(status as StatusFilter)) {
    filters.statusFilter = status as StatusFilter;
  }

  const beds = params.get("beds");
  if (beds) {
    filters.bedroomFilters = beds
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
  }

  const buildings = params.get("buildings");
  if (buildings) {
    filters.selectedBuildings = buildings.split(",").filter(Boolean);
  }

  const minPrice = params.get("minPrice");
  if (minPrice) filters.priceMin = minPrice;

  const maxPrice = params.get("maxPrice");
  if (maxPrice) filters.priceMax = maxPrice;

  const minSqft = params.get("minSqft");
  if (minSqft) filters.sqftMin = minSqft;

  const maxSqft = params.get("maxSqft");
  if (maxSqft) filters.sqftMax = maxSqft;

  const sort = params.get("sort");
  if (sort && ["price", "priceSf", "dom", "date"].includes(sort)) {
    filters.sortBy = sort as FilterState["sortBy"];
  }

  const plans = params.get("plans");
  if (plans) filters.floorPlanFilters = plans.split(",").filter(Boolean);

  const facing = params.get("facing");
  if (facing) filters.orientationFilters = facing.split(",").filter(Boolean);

  const dom = params.get("dom");
  if (dom) {
    const n = parseInt(dom, 10);
    if (!isNaN(n) && n > 0) filters.maxDom = n;
  }

  const after = params.get("after");
  if (after && /^\d{4}-\d{2}-\d{2}$/.test(after)) filters.listedAfter = after;

  const before = params.get("before");
  if (before && /^\d{4}-\d{2}-\d{2}$/.test(before)) filters.listedBefore = before;

  return filters;
}

// ─── FilterState → URL params ────────────────────────────────────────

function filtersToParams(filters: FilterState, includeBuildings: boolean): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.listingTypeFilter !== "Sale") {
    params.set("type", filters.listingTypeFilter.toLowerCase());
  }
  if (filters.statusFilter !== "active") {
    params.set("status", filters.statusFilter);
  }
  if (filters.bedroomFilters.length > 0) {
    params.set("beds", filters.bedroomFilters.join(","));
  }
  if (includeBuildings && filters.selectedBuildings.length > 0) {
    params.set("buildings", filters.selectedBuildings.join(","));
  }
  if (filters.priceMin) params.set("minPrice", filters.priceMin);
  if (filters.priceMax) params.set("maxPrice", filters.priceMax);
  if (filters.sqftMin) params.set("minSqft", filters.sqftMin);
  if (filters.sqftMax) params.set("maxSqft", filters.sqftMax);
  if (filters.sortBy !== "dom") params.set("sort", filters.sortBy);
  if (filters.floorPlanFilters.length > 0) {
    params.set("plans", filters.floorPlanFilters.join(","));
  }
  if (filters.orientationFilters.length > 0) {
    params.set("facing", filters.orientationFilters.join(","));
  }
  if (filters.maxDom !== null) {
    params.set("dom", String(filters.maxDom));
  }
  if (filters.listedAfter) params.set("after", filters.listedAfter);
  if (filters.listedBefore) params.set("before", filters.listedBefore);

  return params;
}

// ─── Shared hook logic ───────────────────────────────────────────────

function useFilterParamsBase(includeBuildings: boolean) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialFilters = parseFiltersFromParams(searchParams);

  const syncToUrl = useCallback(
    (filters: FilterState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = filtersToParams(filters, includeBuildings);
        const qs = params.toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        router.replace(url, { scroll: false });
      }, 300);
    },
    [pathname, router, includeBuildings],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { initialFilters, syncToUrl };
}

// ─── Public hooks ────────────────────────────────────────────────────

/** URL sync for /for-sale page (includes buildings param) */
export function useAllListingsFilterParams() {
  return useFilterParamsBase(true);
}

/** URL sync for building detail pages (no buildings param) */
export function useBuildingFilterParams() {
  return useFilterParamsBase(false);
}
