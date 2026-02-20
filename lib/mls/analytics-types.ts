// Analytics Data Types for Market Research Tool
// Covers all listing statuses (Closed, Pending, Withdrawn, etc.) with lifecycle tracking

export interface AnalyticsListing {
  // Core identifiers
  listingId: string;
  buildingSlug: string | null;
  buildingName: string;
  address: string;
  unitNumber: string;

  // Pricing
  listPrice: number;
  originalListPrice: number;
  closePrice?: number;
  previousListPrice?: number;
  currentPrice?: number;

  // Specs
  bedroomsTotal: number;
  bathroomsTotalInteger: number;
  livingArea: number;
  priceSf: number; // closePrice/sqft for closed, listPrice/sqft for others

  // Status + Lifecycle dates
  status: string; // Active, Closed, Pending, Withdrawn, Hold, Expired, Canceled
  listingContractDate?: string;
  closeDate?: string;
  pendingTimestamp?: string;
  statusChangeTimestamp?: string;
  priceChangeTimestamp?: string;
  backOnMarketDate?: string;
  offMarketDate?: string;
  tempOffMarketDate?: string;
  purchaseContractDate?: string;
  statusContractualSearchDate?: string;

  // Metrics
  daysOnMarket: number;
  cumulativeDaysOnMarket?: number;
  cpLp?: number; // closePrice / listPrice
  cpOlp?: number; // closePrice / originalListPrice

  // Property details
  hoaFee?: number;
  associationFeeFrequency?: string;
  propertyType?: string;
  propertySubType?: string;
  yearBuilt?: number;

  // Agent info
  listAgentFullName?: string;
  buyerAgentFullName?: string;
  listOfficeName?: string;

  // Financing
  buyerFinancing?: string;

  // Enrichment (from floor plan mapping or CSV direct)
  floorPlan?: string;
  orientation?: string;

  // Parking & Remarks
  parkingFeatures?: string;
  publicRemarks?: string;
  privateRemarks?: string;

  // Additional lifecycle dates
  holdDate?: string;
  withdrawnDate?: string;
  cancellationDate?: string;
  contingentDate?: string;

  // Tracking
  source: "csv-import" | "api-sync";
  importedAt: string; // ISO timestamp
}

// Snapshot captured during each sync for lifecycle tracking
export interface ListingSnapshot {
  listingId: string;
  capturedAt: string; // ISO timestamp
  status: string;
  listPrice: number;
  daysOnMarket: number;
}

// Analytics sync state (separate from active listings sync)
export interface AnalyticsSyncState {
  lastSyncTimestamp: string; // ISO 8601 — for ModificationTimestamp incremental
  lastSyncDate: string; // Human-readable
  closedCount: number;
  pendingCount: number;
  activeCount: number; // Active only (AUC now counted as Pending)
  otherCount: number; // withdrawn, hold, expired, canceled
  totalCount: number;
  status: "success" | "error" | "in_progress";
  errorMessage?: string;
  dataRangeStart?: string; // Earliest closeDate
  dataRangeEnd?: string; // Latest closeDate
}

// Import state tracking
export interface AnalyticsImportState {
  lastImportDate: string;
  totalImported: number;
  matchedCount: number;
  unmatchedCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  buildingsAffected: number;
}

// Enrichment map for a single building
export interface EnrichmentEntry {
  floorPlan: string;
  orientation: string;
}

export type BuildingEnrichmentMap = Record<string, EnrichmentEntry>; // unitNumber → enrichment
export type AllEnrichmentMaps = Record<string, BuildingEnrichmentMap>; // buildingSlug → map
