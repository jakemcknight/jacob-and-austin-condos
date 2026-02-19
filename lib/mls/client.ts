// MLSGrid API Client for Unlock MLS (formerly ACRTIS)
// Implements replication pattern per MLSGrid best practices

import { MLSListing, MLSSearchParams, MLSApiResponse } from "./types";
import { AnalyticsListing } from "./analytics-types";

export interface ReplicationOptions {
  /** Initial import (includes MlgCanView filter) or incremental sync */
  mode: "initial" | "incremental";
  /** Last sync timestamp for incremental syncs (ISO 8601 format) */
  lastSyncTimestamp?: string;
  /** Originating System Name - REQUIRED by MLSGrid API (e.g., 'actris' for Unlock MLS) */
  originatingSystemName: string;
}

export class MLSGridClient {
  private accessToken: string;
  private baseUrl: string;
  private requestCount: number = 0;
  private requestStartTime: number = Date.now();

  constructor() {
    this.accessToken = process.env.MLSGRID_ACCESS_TOKEN!;
    this.baseUrl = process.env.MLSGRID_API_URL || "https://api.mlsgrid.com/v2";

    if (!this.accessToken) {
      throw new Error("MLSGRID_ACCESS_TOKEN environment variable is required");
    }
  }

  /**
   * Replicate listings from MLSGrid using best practices
   * - Initial mode: Fetch all active listings with MlgCanView=true
   * - Incremental mode: Fetch only changes since lastSyncTimestamp
   *
   * MLSGrid Rate Limits (WARNING THRESHOLDS):
   * - 4 requests/second (RPS)
   * - 7,200 requests/hour
   * - 40,000 requests/24 hours
   * - 3,072 MB/hour
   * - 40 GB/24 hours
   *
   * SUSPENSION THRESHOLDS (CRITICAL):
   * - 6 requests/second (RPS)
   * - 18,000 requests/hour
   * - 60,000 requests/24 hours
   * - 4,096 MB/hour
   * - 60 GB/24 hours
   *
   * Our conservative target: 0.1 req/sec (10-second delay) = ~360 requests/hour
   */
  async replicateListings(options: ReplicationOptions): Promise<MLSListing[]> {
    try {
      // Fetch ALL active listings (no PropertyType filter) to avoid missing any DT listings.
      // Sale vs Lease is determined client-side from PropertyType field in the response.
      const allListings = await this.fetchAllListings(options);

      const salesCount = allListings.filter(l => l.listingType === "Sale").length;
      const leasesCount = allListings.filter(l => l.listingType === "Lease").length;

      console.log(`[MLSGrid] Replicated ${allListings.length} total listings (${salesCount} sales, ${leasesCount} leases)`);
      console.log(`[MLSGrid] Total requests made: ${this.requestCount}`);

      return allListings;
    } catch (error) {
      console.error("[MLSGrid] Error replicating listings:", error);
      throw error;
    }
  }

  /**
   * Fetch ALL active DT listings by querying multiple PropertyType values.
   * Sale vs Lease is determined from the PropertyType field:
   *   - PropertyType containing "Lease" → Lease
   *   - Everything else → Sale
   *
   * We query each known PropertyType separately to avoid fetching the entire
   * actris dataset (which would cause Cloudflare/Vercel timeouts).
   * Results are deduplicated by ListingKey.
   */
  private async fetchAllListings(
    options: ReplicationOptions
  ): Promise<MLSListing[]> {
    // PropertyType values for DT (downtown Austin) residential listings.
    const propertyTypes = [
      "Residential",
      "Residential Lease",
    ];

    const allResults: MLSListing[] = [];
    const seenKeys = new Set<string>();

    for (const pt of propertyTypes) {
      console.log(`[MLSGrid] Fetching PropertyType='${pt}'...`);
      const listings = await this.fetchByPropertyType(pt, options);
      console.log(`[MLSGrid] PropertyType='${pt}' → ${listings.length} DT listings`);

      // Deduplicate by ListingKey
      for (const listing of listings) {
        if (!seenKeys.has(listing.mlsNumber)) {
          seenKeys.add(listing.mlsNumber);
          allResults.push(listing);
        }
      }
    }

    // Log PropertyType distribution for DT listings
    const ptCounts: Record<string, number> = {};
    for (const listing of allResults) {
      const pt = listing.propertyType || 'unknown';
      ptCounts[pt] = (ptCounts[pt] || 0) + 1;
    }
    console.log(`[MLSGrid] Total DT listings: ${allResults.length}`);
    console.log(`[MLSGrid] DT PropertyType distribution:`, JSON.stringify(ptCounts));

    return allResults;
  }

  /**
   * Fetch listings for a specific PropertyType value.
   * Returns only DT (downtown Austin) listings after client-side filtering.
   */
  private async fetchByPropertyType(
    propertyType: string,
    options: ReplicationOptions
  ): Promise<MLSListing[]> {
    const endpoint = "Property";
    const results: MLSListing[] = [];
    let nextUrl: string | null = null;

    // Build OData filter
    const filters = [];
    filters.push(`OriginatingSystemName eq '${options.originatingSystemName}'`);
    filters.push(`PropertyType eq '${propertyType}'`);
    // Include both Active and Active Under Contract (user's MLS shows both as "active")
    filters.push("(StandardStatus eq 'Active' or StandardStatus eq 'Active Under Contract')");

    if (options.mode === "initial") {
      filters.push("MlgCanView eq true");
    } else if (options.mode === "incremental" && options.lastSyncTimestamp) {
      filters.push(`ModificationTimestamp gt ${options.lastSyncTimestamp}`);
    }

    // Select essential fields — include PropertyType for classification
    const select = [
      "ListingId",
      "ListingKey",
      "StreetNumber",
      "StreetDirPrefix",
      "StreetName",
      "StreetSuffix",
      "StreetDirSuffix",
      "UnitNumber",
      "BuildingName",
      "ListPrice",
      "BedroomsTotal",
      "BathroomsTotalInteger",
      "LivingArea",
      "StandardStatus",
      "ListingContractDate",
      "DaysOnMarket",
      "PropertyType",
      "PropertySubType",
      "MLSAreaMajor",
      "ModificationTimestamp",
      "MlgCanView",
      "OriginatingSystemName",
      "City",
      "PostalCode",
      "YearBuilt",
      "ListAgentFullName",
      "ListAgentDirectPhone",
      "ListOfficeName",
      "ListOfficePhone",
      "PublicRemarks",
      "TaxAnnualAmount",
      "TaxYear",
      "AssociationFeeFrequency",
      "OriginalListPrice",
    ].join(",");

    const initialUrl = `${this.baseUrl}/${endpoint}?$filter=${encodeURIComponent(filters.join(" and "))}&$select=${select}&$expand=Media&$top=500`;
    nextUrl = initialUrl;

    while (nextUrl) {
      const response = await this.makeRequest(nextUrl);

      if (response.value && Array.isArray(response.value)) {
        const parsed: MLSListing[] = response.value.map(item => {
          // Classify Sale vs Lease based on PropertyType
          const pt = (item.PropertyType || "").toLowerCase();
          const listingType: "Sale" | "Lease" = pt.includes("lease") ? "Lease" : "Sale";
          return this.parseMLSListing(item, listingType);
        });
        results.push(...parsed);
      }

      nextUrl = response["@odata.nextLink"] || null;

      // Rate limiting: minimum 2-second delay between paginated calls
      // Keeps us well under 4 req/s warning threshold
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Client-side filter: MLSAreaMajor = 'DT' (downtown Austin)
    const filtered = results.filter(listing => {
      const rawData = (listing as any).rawData;
      const area = rawData?.MLSAreaMajor || '';
      return area === 'DT';
    });

    console.log(`[MLSGrid] PropertyType='${propertyType}': ${results.length} total → ${filtered.length} DT`);

    return filtered;
  }

  /**
   * Fetch analytics listings (Closed, Pending, Withdrawn, Hold) from MLSGrid.
   * Used by the 15-min sync to capture non-active listing statuses.
   * NO media expansion — analytics data doesn't need photos.
   *
   * @param statuses - Array of StandardStatus values to fetch (e.g., ['Closed', 'Pending'])
   * @param modificationTimestampGt - Optional ISO 8601 timestamp for incremental fetch
   */
  async fetchAnalyticsListings(
    statuses: string[],
    modificationTimestampGt?: string
  ): Promise<{ listings: AnalyticsListing[]; latestModificationTimestamp: string | null }> {
    const propertyTypes = ["Residential", "Residential Lease"];
    const allResults: AnalyticsListing[] = [];
    const seenKeys = new Set<string>();
    let latestModTs: string | null = null;

    // Analytics-specific fields — no Media, adds ClosePrice/CloseDate and lifecycle fields
    const analyticsSelect = [
      "ListingId", "ListingKey",
      "StreetNumber", "StreetDirPrefix", "StreetName", "StreetSuffix", "StreetDirSuffix",
      "UnitNumber", "BuildingName",
      "ListPrice", "OriginalListPrice", "ClosePrice", "CloseDate",
      "PreviousListPrice", "CurrentPrice",
      "BedroomsTotal", "BathroomsTotalInteger", "LivingArea",
      "StandardStatus", "ListingContractDate", "DaysOnMarket", "CumulativeDaysOnMarket",
      "PropertyType", "PropertySubType", "MLSAreaMajor",
      "ModificationTimestamp", "MlgCanView", "OriginatingSystemName",
      "StatusChangeTimestamp", "PendingTimestamp", "PurchaseContractDate",
      "PriceChangeTimestamp", "BackOnMarketDate", "OffMarketDate", "TempOffMarketDate",
      "AssociationFee", "AssociationFeeFrequency", "YearBuilt",
      "ListAgentFullName", "BuyerAgentFullName", "ListOfficeName",
      "BuyerFinancing",
    ].join(",");

    // Build status filter
    const statusFilter = statuses
      .map(s => `StandardStatus eq '${s}'`)
      .join(" or ");

    for (const pt of propertyTypes) {
      const filters = [
        "OriginatingSystemName eq 'actris'",
        `PropertyType eq '${pt}'`,
        `(${statusFilter})`,
        "MlgCanView eq true",
      ];

      if (modificationTimestampGt) {
        filters.push(`ModificationTimestamp gt ${modificationTimestampGt}`);
      }

      const filterStr = encodeURIComponent(filters.join(" and "));
      let nextUrl: string | null = `${this.baseUrl}/Property?$filter=${filterStr}&$select=${analyticsSelect}&$top=500`;

      while (nextUrl) {
        const response = await this.makeRequest(nextUrl);

        if (response.value && Array.isArray(response.value)) {
          for (const item of response.value) {
            // Client-side DT filter
            if (item.MLSAreaMajor !== "DT") continue;

            const id = item.ListingId || item.ListingKey || "";
            if (seenKeys.has(id)) continue;
            seenKeys.add(id);

            // Track the latest ModificationTimestamp for incremental sync
            const modTs = item.ModificationTimestamp;
            if (modTs && (!latestModTs || modTs > latestModTs)) {
              latestModTs = modTs;
            }

            allResults.push(this.parseAnalyticsListing(item));
          }
        }

        nextUrl = response["@odata.nextLink"] || null;
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`[MLSGrid] Analytics fetch: ${allResults.length} DT listings for statuses [${statuses.join(", ")}]`);
    return { listings: allResults, latestModificationTimestamp: latestModTs };
  }

  /**
   * Parse raw MLS data into AnalyticsListing format (no photos, includes lifecycle fields)
   */
  private parseAnalyticsListing(data: any): AnalyticsListing {
    const streetNumber = data.StreetNumber || "";
    const streetDirPrefix = data.StreetDirPrefix || "";
    const streetName = data.StreetName || "";
    const streetSuffix = data.StreetSuffix || "";
    const streetDirSuffix = data.StreetDirSuffix || "";
    const rawAddress = [streetNumber, streetDirPrefix, streetName, streetSuffix, streetDirSuffix]
      .filter(Boolean)
      .join(" ");
    const address = rawAddress.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    const livingArea = parseFloat(data.LivingArea || "0");
    const listPrice = parseFloat(data.ListPrice || "0");
    const closePrice = parseFloat(data.ClosePrice || "0") || undefined;
    const originalListPrice = parseFloat(data.OriginalListPrice || "0") || listPrice;

    // Price per SF: use close price for closed, list price otherwise
    const priceForPsf = closePrice || listPrice;
    const priceSf = livingArea > 0 ? priceForPsf / livingArea : 0;

    // CP/LP ratios
    let cpLp: number | undefined;
    let cpOlp: number | undefined;
    if (closePrice && listPrice > 0) cpLp = closePrice / listPrice;
    if (closePrice && originalListPrice > 0) cpOlp = closePrice / originalListPrice;

    return {
      listingId: data.ListingId || data.ListingKey || "",
      buildingSlug: null, // Set by address matcher in sync
      buildingName: data.BuildingName || "",
      address,
      unitNumber: data.UnitNumber || "",
      listPrice,
      originalListPrice,
      closePrice,
      previousListPrice: parseFloat(data.PreviousListPrice || "0") || undefined,
      currentPrice: parseFloat(data.CurrentPrice || "0") || undefined,
      bedroomsTotal: parseInt(data.BedroomsTotal || "0") || 0,
      bathroomsTotalInteger: parseInt(data.BathroomsTotalInteger || "0") || 0,
      livingArea,
      priceSf,
      status: data.StandardStatus || "Unknown",
      listingContractDate: data.ListingContractDate || undefined,
      closeDate: data.CloseDate || undefined,
      pendingTimestamp: data.PendingTimestamp || undefined,
      statusChangeTimestamp: data.StatusChangeTimestamp || undefined,
      priceChangeTimestamp: data.PriceChangeTimestamp || undefined,
      backOnMarketDate: data.BackOnMarketDate || undefined,
      offMarketDate: data.OffMarketDate || undefined,
      tempOffMarketDate: data.TempOffMarketDate || undefined,
      purchaseContractDate: data.PurchaseContractDate || undefined,
      daysOnMarket: parseInt(data.DaysOnMarket || "0") || 0,
      cumulativeDaysOnMarket: parseInt(data.CumulativeDaysOnMarket || "0") || undefined,
      cpLp,
      cpOlp,
      hoaFee: parseFloat(data.AssociationFee || "0") || undefined,
      associationFeeFrequency: data.AssociationFeeFrequency || undefined,
      propertyType: data.PropertyType || undefined,
      propertySubType: data.PropertySubType || undefined,
      yearBuilt: parseInt(data.YearBuilt || "0") || undefined,
      listAgentFullName: data.ListAgentFullName || undefined,
      buyerAgentFullName: data.BuyerAgentFullName || undefined,
      listOfficeName: data.ListOfficeName || undefined,
      buyerFinancing: data.BuyerFinancing || undefined,
      source: "api-sync",
      importedAt: new Date().toISOString(),
    };
  }

  // Hard cap on requests per sync cycle to prevent runaway loops
  // Set to 500 to accommodate full analytics fetch (all non-active DT listings)
  // alongside the active listings fetch
  private static readonly MAX_REQUESTS_PER_CYCLE = 500;

  /**
   * Make authenticated HTTP request to MLSGrid API
   * Includes rate limiter safety net:
   * - Hard cap of 100 requests per sync cycle
   * - Adaptive delay if rate exceeds 1.5 req/s
   * - Every request is logged for observability
   */
  private async makeRequest(url: string): Promise<MLSApiResponse> {
    this.requestCount++;

    // Hard cap — abort if we've made too many requests (prevents runaway loops)
    if (this.requestCount > MLSGridClient.MAX_REQUESTS_PER_CYCLE) {
      throw new Error(
        `[MLSGrid] SAFETY: Request cap exceeded (${this.requestCount}/${MLSGridClient.MAX_REQUESTS_PER_CYCLE}). ` +
        `Aborting to protect rate limits.`
      );
    }

    // Adaptive rate limiting — slow down if we're going too fast
    const elapsedSeconds = (Date.now() - this.requestStartTime) / 1000;
    const currentRate = this.requestCount / Math.max(elapsedSeconds, 0.1);

    if (currentRate > 1.5 && this.requestCount > 1) {
      console.warn(`[MLSGrid] Rate ${currentRate.toFixed(2)} req/s exceeds 1.5 — adding 2s delay`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[MLSGrid] Request #${this.requestCount} (${currentRate.toFixed(3)} req/s)`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MLSGrid API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch primary photo for a listing from Media endpoint
   * Returns the first photo URL or empty string if none available
   */
  private async fetchPrimaryPhoto(listingKey: string): Promise<string> {
    try {
      // Query Media endpoint for this listing, ordered by Order field, get only first photo
      const url = `${this.baseUrl}/Media?$filter=ResourceRecordKey eq '${listingKey}'&$orderby=Order asc&$top=1&$select=MediaURL`;

      const response = await this.makeRequest(url);

      if (response.value && response.value.length > 0 && response.value[0].MediaURL) {
        return response.value[0].MediaURL;
      }

      return "";
    } catch (error) {
      console.warn(`[MLSGrid] Failed to fetch photo for ${listingKey}:`, error);
      return "";
    }
  }

  /**
   * Parse raw MLS data into MLSListing format
   */
  private parseMLSListing(data: any, listingType: "Sale" | "Lease"): MLSListing {
    // Build full address from RESO components
    const streetNumber = data.StreetNumber || "";
    const streetDirPrefix = data.StreetDirPrefix || "";
    const streetName = data.StreetName || "";
    const streetSuffix = data.StreetSuffix || "";
    const streetDirSuffix = data.StreetDirSuffix || "";
    const rawAddress = [streetNumber, streetDirPrefix, streetName, streetSuffix, streetDirSuffix]
      .filter(Boolean)
      .join(" ");
    // Title-case: MLS data is often ALL CAPS (e.g. "44 EAST AVE" → "44 East Ave")
    const address = rawAddress.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // Calculate price per SF
    const livingArea = parseFloat(data.LivingArea || "0");
    const listPrice = parseFloat(data.ListPrice || "0");
    const priceSf = livingArea > 0 ? listPrice / livingArea : 0;

    // Extract photos from expanded Media field (sorted by Order)
    const photos: string[] = [];
    if (data.Media && Array.isArray(data.Media)) {
      console.log(`[MLSGrid] Media array for ${address}: ${data.Media.length} items`);
      for (const media of data.Media) {
        if (media.MediaURL) {
          photos.push(media.MediaURL);
        }
      }
      if (photos.length === 0 && data.Media.length > 0) {
        console.warn(`[MLSGrid] Media array has ${data.Media.length} items but no MediaURL found for ${address}`);
      }
    } else if (!data.Media) {
      // Log if Media field is missing (expand might not be working)
      console.warn(`[MLSGrid] No Media field for listing at ${address}`);
    }
    console.log(`[MLSGrid] Extracted ${photos.length} photos for ${address}`);

    return {
      listingId: data.ListingId || data.ListingKey || "",
      mlsNumber: (data.ListingId || data.ListingKey || "").replace(/^[A-Z]+/, ""),
      buildingName: data.BuildingName || "",
      address,
      unitNumber: data.UnitNumber || "",
      listPrice,
      originalListPrice: parseFloat(data.OriginalListPrice || "0") || undefined,
      bedroomsTotal: parseInt(data.BedroomsTotal || "0") || 0,
      bathroomsTotalInteger: parseInt(data.BathroomsTotalInteger || "0") || 0,
      bathroomsFull: parseInt(data.BathroomsFull || "0") || undefined,
      bathroomsHalf: parseInt(data.BathroomsHalf || "0") || undefined,
      livingArea,
      priceSf,
      status: this.normalizeStatus(data.StandardStatus),
      listDate: data.ListingContractDate || "",
      daysOnMarket: parseInt(data.DaysOnMarket || "0") || 0,
      modificationTimestamp: data.ModificationTimestamp || undefined,
      mlgCanView: data.MlgCanView !== undefined ? data.MlgCanView : true,
      listingType,
      photos,
      virtualTourUrl: data.VirtualTourURLUnbranded || undefined,
      city: data.City || undefined,
      postalCode: data.PostalCode || undefined,
      propertyType: data.PropertyType || undefined,
      propertySubType: data.PropertySubType || undefined,
      publicRemarks: data.PublicRemarks || undefined,
      parkingFeatures: data.ParkingFeatures || undefined,
      hoaFee: parseFloat(data.AssociationFee || "0") || undefined,
      associationFeeFrequency: data.AssociationFeeFrequency || undefined,
      yearBuilt: parseInt(data.YearBuilt || "0") || undefined,
      taxAnnualAmount: parseFloat(data.TaxAnnualAmount || "0") || undefined,
      taxYear: parseInt(data.TaxYear || "0") || undefined,
      listAgentFullName: data.ListAgentFullName || undefined,
      listAgentDirectPhone: data.ListAgentDirectPhone || undefined,
      listOfficeName: data.ListOfficeName || undefined,
      listOfficePhone: data.ListOfficePhone || undefined,
      rawData: data, // Keep for debugging
    };
  }

  /**
   * Normalize MLS status to our standard types
   */
  private normalizeStatus(status: string): "Active" | "Pending" | "Under Contract" | "Active Under Contract" {
    const normalized = (status || "").toLowerCase();

    if (normalized.includes("active under contract")) return "Active Under Contract";
    if (normalized.includes("pending")) return "Pending";
    if (normalized.includes("under contract")) return "Under Contract";
    return "Active";
  }
}
