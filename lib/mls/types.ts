// MLS Data Types for MLSGrid API

export interface MLSListing {
  // Core identifiers
  listingId: string;
  mlsNumber: string;

  // Property details
  buildingName: string;
  address: string;
  unitNumber: string;

  // Pricing
  listPrice: number;
  originalListPrice?: number;

  // Property specs
  bedroomsTotal: number;
  bathroomsTotalInteger: number;
  bathroomsFull?: number;
  bathroomsHalf?: number;
  livingArea: number; // Square feet
  priceSf: number; // Calculated: listPrice / livingArea

  // Status and dates
  status: "Active" | "Pending" | "Under Contract" | "Active Under Contract";
  listDate: string;
  daysOnMarket: number;
  modificationTimestamp?: string; // ISO 8601 timestamp for replication
  mlgCanView?: boolean; // False = listing should be removed from display

  // Transaction type
  listingType: "Sale" | "Lease";

  // Media
  photos?: string[];
  virtualTourUrl?: string;

  // Location details
  city?: string;
  postalCode?: string;

  // Description
  publicRemarks?: string;

  // Additional details
  propertyType?: string;
  propertySubType?: string;
  parkingFeatures?: string;
  hoaFee?: number;
  associationFeeFrequency?: string;
  yearBuilt?: number;
  taxAnnualAmount?: number;
  taxYear?: number;

  // Agent & Office
  listAgentFullName?: string;
  listAgentDirectPhone?: string;
  listOfficeName?: string;
  listOfficePhone?: string;

  // Floor plan enrichment (populated during sync from unitLookup data)
  floorPlan?: string; // e.g. "A9"
  orientation?: string; // e.g. "SEc", "N", "W"
  floorPlanSlug?: string; // e.g. "a9-1br-801sf-floorplan" (for linking to floor plan pages)

  // Raw MLS data (for debugging)
  rawData?: Record<string, any>;
}

export interface MLSSearchParams {
  areaCode?: string;
  propertySubType?: string;
  status?: string[];
  limit?: number;
  offset?: number;
}

export interface CachedMlsData {
  timestamp: number;
  data: MLSListing[];
}

export interface MLSApiResponse {
  value: any[];
  "@odata.context"?: string;
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}
