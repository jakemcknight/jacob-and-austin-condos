// Shared CSV parsing and transformation utilities for analytics imports
// Used by both the browser upload endpoint and the server-side file import endpoint

import { AnalyticsListing } from "@/lib/mls/analytics-types";

// Column name aliases — maps various MLS export column names to our internal field names
export const COLUMN_ALIASES: Record<string, string[]> = {
  listingId: ["ListingId", "ListingID", "MLS ID", "MLS #", "MlsNumber", "Listing ID"],
  address: ["Address", "StreetAddress", "Street Address", "Full Address"],
  unitNumber: ["UnitNumber", "Unit Number", "Unit", "Unit #", "UnitNorm"],
  buildingName: ["Building Name", "BuildingName", "SubdivisionName", "Subdivision"],
  bedroomsTotal: ["BedroomsTotal", "Bedrooms", "Beds", "BR", "# Beds"],
  bathroomsTotalInteger: ["BathroomsTotalInteger", "Bathrooms", "Baths", "BA", "# Baths"],
  livingArea: ["LivingArea", "Living Area", "Sqft", "SqFt", "Square Feet", "SF", "Living Area Srch Sq Ft"],
  listPrice: ["ListPrice", "List Price"],
  originalListPrice: ["OriginalListPrice", "Original List Price", "Orig List Price"],
  closePrice: ["ClosePrice", "Close Price", "Closed Price", "SoldPrice", "Sold Price"],
  closeDate: ["CloseDate", "Close Date", "Closed Date", "Sold Date"],
  status: ["MlsStatus", "StandardStatus", "Standard Status", "Status", "Listing Status"],
  daysOnMarket: ["DaysOnMarket", "Days On Market", "DOM", "Days on Market"],
  cumulativeDaysOnMarket: ["CumulativeDaysOnMarket", "Cumulative Days On Market", "CDOM"],
  listingContractDate: ["ListingContractDate", "Listing Contract Date", "List Date"],
  pendingTimestamp: ["PendingTimestamp", "Pending Timestamp", "Pending Date"],
  statusChangeTimestamp: ["StatusChangeTimestamp", "Status Change Timestamp"],
  priceChangeTimestamp: ["PriceChangeTimestamp", "Price Change Timestamp"],
  backOnMarketDate: ["BackOnMarketDate", "Back On Market Date"],
  offMarketDate: ["OffMarketDate", "Off Market Date"],
  tempOffMarketDate: ["TempOffMarketDate", "Temp Off Market Date"],
  purchaseContractDate: ["PurchaseContractDate", "Purchase Contract Date", "Contract Date"],
  statusContractualSearchDate: ["StatusContractualSearchDate"],
  previousListPrice: ["PreviousListPrice", "Previous List Price"],
  currentPrice: ["CurrentPrice", "Current Price", "Price"],
  hoaFee: ["HOA Fee", "AssociationFee", "Association Fee", "HOA"],
  associationFeeFrequency: ["AssociationFeeFrequency", "HOA Fee Frequency"],
  propertyType: ["PropertyType", "Property Type"],
  propertySubType: ["PropertySubType", "Property Sub Type"],
  yearBuilt: ["YearBuilt", "Year Built"],
  listAgentFullName: ["Listing Agent", "ListAgentFullName", "List Agent", "List Agent Full Name"],
  buyerAgentFullName: ["Buyer Agent", "BuyerAgentFullName", "Buyer's Agent", "Buyer Agent Full Name"],
  listOfficeName: ["ListOfficeName", "List Office", "List Office Name"],
  buyerFinancing: ["BuyerFinancing", "Buyer Financing", "Financing"],
  closedPsfRaw: ["Closed $/SF", "Closed Price/Sqft", "Close$/SqFt"],
  cpLpRaw: ["Closed Price/List Price", "CP/LP", "CP$/LP$ %"],
  cpOlpRaw: ["Closed Price/Original List Price", "Close Price/Original List Price", "CP/OLP", "CP$/OLP$ %"],
  parkingFeatures: ["Parking Features", "ParkingFeatures"],
  publicRemarks: ["Public Remarks", "PublicRemarks"],
  privateRemarks: ["Private Remarks", "PrivateRemarks"],
  holdDate: ["Hold Date", "HoldDate"],
  withdrawnDate: ["Withdrawn Date", "WithdrawnDate"],
  cancellationDate: ["Cancellation Date", "CancellationDate"],
  contingentDate: ["Contingent Date", "ContingentDate"],
  floorPlan: ["Floor Plan Name/Number", "FloorPlanName", "Floor Plan"],
  orientation: ["Direction Faces", "DirectionFaces"],
};

// --- CSV Parsing ---

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);

  const results: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    results.push(row);
  }

  return results;
}

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

// --- Column Detection ---

export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const match = headers.find(
        (h) => h.trim().toLowerCase() === alias.toLowerCase()
      );
      if (match) {
        mapping[field] = match;
        break;
      }
    }
  }

  return mapping;
}

// --- Date Normalization ---
// MLS exports dates as "MM/DD/YYYY HH:MM:SS AM" or "MM/DD/YYYY 12:00:00 AM"
// We normalize to YYYY-MM-DD

export function normalizeDate(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Already ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  // US format: MM/DD/YYYY or MM/DD/YYYY HH:MM:SS AM/PM
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    const year = usMatch[3];
    return `${year}-${month}-${day}`;
  }

  return "";
}

// --- Row Conversion ---

export function rowToAnalyticsListing(
  row: Record<string, string>,
  columnMap: Record<string, string>
): AnalyticsListing | null {
  const get = (field: string): string => {
    const col = columnMap[field];
    return col ? (row[col] || "").trim() : "";
  };

  const address = get("address");
  const listingId = get("listingId");

  // Must have at least an address or listing ID
  if (!address && !listingId) return null;

  const closePrice = parseCurrency(get("closePrice"));
  const listPrice = parseCurrency(get("listPrice"));
  const originalListPrice = parseCurrency(get("originalListPrice"));
  const livingArea = parseNum(get("livingArea"));
  const status = normalizeStatus(get("status"));

  // Calculate price per sqft
  let priceSf = 0;
  if (status === "Closed" && closePrice > 0 && livingArea > 0) {
    priceSf = closePrice / livingArea;
  } else if (listPrice > 0 && livingArea > 0) {
    priceSf = listPrice / livingArea;
  }

  // Calculate CP/LP ratios
  let cpLp: number | undefined;
  let cpOlp: number | undefined;

  const cpLpRaw = parseNum(get("cpLpRaw"));
  const cpOlpRaw = parseNum(get("cpOlpRaw"));

  if (cpLpRaw > 0) {
    cpLp = cpLpRaw;
  } else if (closePrice > 0 && listPrice > 0) {
    cpLp = closePrice / listPrice;
  }

  if (cpOlpRaw > 0) {
    cpOlp = cpOlpRaw;
  } else if (closePrice > 0 && originalListPrice > 0) {
    cpOlp = closePrice / originalListPrice;
  }

  return {
    listingId: listingId || `import-${address}-${get("unitNumber")}`,
    buildingSlug: null,
    buildingName: get("buildingName"),
    address,
    unitNumber: get("unitNumber"),
    listPrice,
    originalListPrice: originalListPrice || listPrice,
    closePrice: closePrice || undefined,
    previousListPrice: parseCurrency(get("previousListPrice")) || undefined,
    currentPrice: parseCurrency(get("currentPrice")) || undefined,
    bedroomsTotal: parseInt(get("bedroomsTotal")) || 0,
    bathroomsTotalInteger: parseInt(get("bathroomsTotalInteger")) || 0,
    livingArea,
    priceSf,
    status,
    listingContractDate: normalizeDate(get("listingContractDate")) || undefined,
    closeDate: normalizeDate(get("closeDate")) || undefined,
    pendingTimestamp: normalizeDate(get("pendingTimestamp")) || undefined,
    statusChangeTimestamp: normalizeDate(get("statusChangeTimestamp")) || undefined,
    priceChangeTimestamp: normalizeDate(get("priceChangeTimestamp")) || undefined,
    backOnMarketDate: normalizeDate(get("backOnMarketDate")) || undefined,
    offMarketDate: normalizeDate(get("offMarketDate")) || undefined,
    tempOffMarketDate: normalizeDate(get("tempOffMarketDate")) || undefined,
    purchaseContractDate: normalizeDate(get("purchaseContractDate")) || undefined,
    statusContractualSearchDate: normalizeDate(get("statusContractualSearchDate")) || undefined,
    holdDate: normalizeDate(get("holdDate")) || undefined,
    withdrawnDate: normalizeDate(get("withdrawnDate")) || undefined,
    cancellationDate: normalizeDate(get("cancellationDate")) || undefined,
    contingentDate: normalizeDate(get("contingentDate")) || undefined,
    daysOnMarket: parseInt(get("daysOnMarket")) || 0,
    cumulativeDaysOnMarket: parseInt(get("cumulativeDaysOnMarket")) || undefined,
    cpLp,
    cpOlp,
    hoaFee: parseCurrency(get("hoaFee")) || undefined,
    associationFeeFrequency: get("associationFeeFrequency") || undefined,
    propertyType: get("propertyType") || undefined,
    propertySubType: get("propertySubType") || undefined,
    yearBuilt: parseInt(get("yearBuilt")) || undefined,
    listAgentFullName: get("listAgentFullName") || undefined,
    buyerAgentFullName: get("buyerAgentFullName") || undefined,
    listOfficeName: get("listOfficeName") || undefined,
    buyerFinancing: get("buyerFinancing") || undefined,
    parkingFeatures: get("parkingFeatures") || undefined,
    publicRemarks: get("publicRemarks") || undefined,
    privateRemarks: get("privateRemarks") || undefined,
    floorPlan: get("floorPlan") || undefined,
    // orientation intentionally omitted from CSV import — only populated via floor plan enrichment
    source: "csv-import",
    importedAt: new Date().toISOString(),
  };
}

// --- Utility ---

export function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isFinite(num) ? num : 0;
}

export function parseNum(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isFinite(num) ? num : 0;
}

export function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("closed") || s.includes("sold")) return "Closed";
  if (s.includes("pending")) return "Pending";
  if (s.includes("active under contract")) return "Active Under Contract";
  if (s.includes("active")) return "Active";
  if (s.includes("withdrawn")) return "Withdrawn";
  if (s.includes("hold")) return "Hold";
  if (s.includes("expired")) return "Expired";
  if (s.includes("canceled") || s.includes("cancelled")) return "Canceled";
  if (s.includes("delete")) return "Deleted";
  return raw || "Unknown";
}
