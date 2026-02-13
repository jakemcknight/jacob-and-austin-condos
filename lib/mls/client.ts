// MLSGrid API Client for Unlock MLS (formerly ACRTIS)
// Implements replication pattern per MLSGrid best practices

import { MLSListing, MLSSearchParams, MLSApiResponse } from "./types";

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
      const allListings: MLSListing[] = [];

      // Fetch both sales and leases from Property resource
      // MLSGrid includes both in Property, distinguished by PropertyType field
      const salesListings = await this.fetchListings("Sale", options);
      const leaseListings = await this.fetchListings("Lease", options);

      allListings.push(...salesListings, ...leaseListings);

      console.log(`[MLSGrid] Replicated ${allListings.length} total listings (${salesListings.length} sales, ${leaseListings.length} leases)`);
      console.log(`[MLSGrid] Total requests made: ${this.requestCount}`);

      return allListings;
    } catch (error) {
      console.error("[MLSGrid] Error replicating listings:", error);
      throw error;
    }
  }

  /**
   * Fetch listings for a specific listing type (Sale or Lease)
   * Implements MLSGrid replication pattern with proper filtering
   *
   * Note: Both sales and leases use the Property resource in MLSGrid,
   * distinguished by PropertyType field ('Residential' vs 'Residential Lease')
   */
  private async fetchListings(
    listingType: "Sale" | "Lease",
    options: ReplicationOptions
  ): Promise<MLSListing[]> {
    const endpoint = "Property"; // Always use Property resource for both sales and leases
    const results: MLSListing[] = [];
    let nextUrl: string | null = null;

    // Build OData query filter per MLSGrid requirements
    // Allowed filter fields: MlgCanView, ModificationTimestamp, OriginatingSystemName,
    // StandardStatus, ListingId, PropertyType, ListOfficeMlsId
    const filters = [];

    // 1. OriginatingSystemName - REQUIRED by MLSGrid API (exactly one per request)
    //    For Unlock MLS (Austin Board of REALTORS), use 'actris'
    filters.push(`OriginatingSystemName eq '${options.originatingSystemName}'`);

    // 2. PropertyType filter - Use standard values from RESO:
    //    - 'Residential' for sales
    //    - 'Residential Lease' for leases
    const propertyType = listingType === "Sale" ? "Residential" : "Residential Lease";
    filters.push(`PropertyType eq '${propertyType}'`);

    // 3. StandardStatus filter - Use standard value 'Active'
    filters.push("StandardStatus eq 'Active'");

    // 4. Mode-specific filters
    if (options.mode === "initial") {
      // Initial import: exclude already-deleted records
      filters.push("MlgCanView eq true");
    } else if (options.mode === "incremental" && options.lastSyncTimestamp) {
      // Incremental: only get changes since last sync (ordered by ModificationTimestamp automatically)
      filters.push(`ModificationTimestamp gt ${options.lastSyncTimestamp}`);
    }

    // Select only essential fields to speed up the query
    // Include ModificationTimestamp for tracking sync state
    const select = [
      "ListingId",
      "ListingKey",
      "StreetNumber",
      "StreetName",
      "UnitNumber",
      "BuildingName",
      "ListPrice",
      "BedroomsTotal",
      "BathroomsTotalInteger",
      "LivingArea",
      "StandardStatus",
      "ListingContractDate",
      "DaysOnMarket",
      "PropertySubType",
      "MLSAreaMajor",
      "ModificationTimestamp",
      "MlgCanView",
      "OriginatingSystemName",
    ].join(",");

    // Use $expand=Media to get photos (v2 API requirement)
    // $top=500 to reduce pagination rounds and stay within Vercel function timeout
    const initialUrl = `${this.baseUrl}/${endpoint}?$filter=${encodeURIComponent(filters.join(" and "))}&$select=${select}&$expand=Media&$top=500`;

    nextUrl = initialUrl;

    // Handle pagination
    while (nextUrl) {
      const response = await this.makeRequest(nextUrl);

      if (response.value && Array.isArray(response.value)) {
        // Parse listings with photos from expanded Media field
        const parsed: MLSListing[] = response.value.map(item =>
          this.parseMLSListing(item, listingType)
        );
        results.push(...parsed);
      }

      // Check for next page
      nextUrl = response["@odata.nextLink"] || null;

      // Rate limiting: 2-second delay = 0.5 req/sec (MLSGrid warning at 4 req/sec, suspension at 6 req/sec)
      // 0.5 req/sec is 8x below the warning threshold — safe margin
      if (nextUrl) {
        this.requestCount++;

        const elapsedSeconds = (Date.now() - this.requestStartTime) / 1000;
        const requestsPerSecond = this.requestCount / elapsedSeconds;

        console.log(`[MLSGrid] Current rate: ${requestsPerSecond.toFixed(3)} req/sec (${this.requestCount} requests in ${elapsedSeconds.toFixed(1)}s)`);

        if (requestsPerSecond > 1.5) {
          console.warn(`[MLSGrid] Rate approaching limit: ${requestsPerSecond.toFixed(3)} req/sec - increasing delay`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay if approaching limit
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Normal 2 second delay
        }
      }
    }

    // Filter client-side: MLSAreaMajor = 'DT' (downtown) and Condominium property subtype
    const filtered = results.filter(listing => {
      const rawData = (listing as any).rawData;

      // 1. Filter by MLSAreaMajor — only downtown Austin listings
      const area = rawData?.MLSAreaMajor || '';
      if (area !== 'DT') {
        return false;
      }

      // 2. Filter by PropertySubType — only condos/townhouses/townhomes
      const propertySubType = rawData?.PropertySubType;
      const subType = (propertySubType || '').toLowerCase();
      const isCondoType = subType.includes('condo') ||
                           subType.includes('townhouse') ||
                           subType.includes('townhome');

      if (!isCondoType && propertySubType) {
        return false;
      }

      return true;
    });

    console.log(`[MLSGrid] Filter Statistics:`);
    console.log(`  - Total from API: ${results.length}`);
    console.log(`  - After DT + Condo filter: ${filtered.length}`);
    console.log(`  - Rejected: ${results.length - filtered.length}`);

    return filtered;
  }

  /**
   * Make authenticated HTTP request to MLSGrid API
   */
  private async makeRequest(url: string): Promise<MLSApiResponse> {
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
    // Build full address
    const streetNumber = data.StreetNumber || "";
    const streetName = data.StreetName || "";
    const address = `${streetNumber} ${streetName}`.trim();

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
      mlsNumber: data.ListingKey || data.ListingId || "",
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
      propertyType: data.PropertyType || undefined,
      propertySubType: data.PropertySubType || undefined,
      parkingFeatures: data.ParkingFeatures || undefined,
      hoaFee: parseFloat(data.AssociationFee || "0") || undefined,
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
