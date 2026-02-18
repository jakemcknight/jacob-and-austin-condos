"use client";

import { useState, useRef, useCallback } from "react";

interface ImportResult {
  success: boolean;
  totalRows?: number;
  totalImported?: number;
  matched?: number;
  unmatched?: number;
  added?: number;
  updated?: number;
  buildingsAffected?: number;
  dateRange?: { start: string | null; end: string | null };
  detectedColumns?: Record<string, string>;
  errors?: string[];
  duration?: string;
  error?: string;
  details?: string;
}

interface EnrichmentImportResult {
  success: boolean;
  totalEntries?: number;
  buildingsMatched?: number;
  unmatchedBuildingNames?: string[];
  added?: number;
  updated?: number;
  enrichmentStats?: {
    buildingsMapped: number;
    totalUnits: number;
    buildingDetails: Array<{ slug: string; unitCount: number }>;
  };
  error?: string;
}

interface EnrichmentApplyResult {
  success: boolean;
  totalProcessed?: number;
  totalEnriched?: number;
  buildingsUpdated?: number;
  duration?: string;
  message?: string;
  error?: string;
}

interface EnrichmentStats {
  buildingsMapped: number;
  totalUnits: number;
  buildingDetails: Array<{ slug: string; unitCount: number }>;
}

interface FileProgress {
  fileName: string;
  totalRows: number;
  processedRows: number;
  batchesSent: number;
  totalBatches: number;
  status: "pending" | "stripping" | "uploading" | "done" | "error";
  error?: string;
  result?: ImportResult;
}

interface ServerImportResult {
  success: boolean;
  filesProcessed?: number;
  fileResults?: Array<{
    fileName: string;
    totalRows: number;
    parsed: number;
    errors: number;
  }>;
  totalRows?: number;
  totalImported?: number;
  matched?: number;
  unmatched?: number;
  added?: number;
  updated?: number;
  buildingsAffected?: number;
  dateRange?: { start: string | null; end: string | null };
  errors?: string[];
  duration?: string;
  error?: string;
  details?: string;
}

// Columns the import endpoint needs — we strip the CSV to only these
const RELEVANT_COLUMNS = new Set([
  "Listing ID", "ListingId", "ListingID", "MLS ID", "MLS #", "MlsNumber",
  "Address", "StreetAddress", "Street Address", "Full Address",
  "Unit Number", "UnitNumber", "Unit", "Unit #", "UnitNorm",
  "Building Name", "BuildingName", "SubdivisionName", "Subdivision",
  "BedroomsTotal", "Bedrooms", "Beds", "BR", "# Beds",
  "BathroomsTotalInteger", "Bathrooms", "Baths", "BA", "# Baths",
  "LivingArea", "Living Area", "Sqft", "SqFt", "Square Feet", "SF", "Living Area Srch Sq Ft",
  "ListPrice", "List Price",
  "OriginalListPrice", "Original List Price", "Orig List Price",
  "ClosePrice", "Close Price", "Closed Price", "SoldPrice", "Sold Price",
  "CloseDate", "Close Date", "Closed Date", "Sold Date",
  "MlsStatus", "StandardStatus", "Standard Status", "Status", "Listing Status",
  "DaysOnMarket", "Days On Market", "DOM", "Days on Market",
  "CumulativeDaysOnMarket", "Cumulative Days On Market", "CDOM",
  "ListingContractDate", "Listing Contract Date", "List Date",
  "PendingTimestamp", "Pending Timestamp", "Pending Date",
  "StatusChangeTimestamp", "Status Change Timestamp",
  "PriceChangeTimestamp", "Price Change Timestamp",
  "BackOnMarketDate", "Back On Market Date",
  "OffMarketDate", "Off Market Date",
  "TempOffMarketDate", "Temp Off Market Date",
  "PurchaseContractDate", "Purchase Contract Date", "Contract Date",
  "StatusContractualSearchDate",
  "PreviousListPrice", "Previous List Price",
  "CurrentPrice", "Current Price", "Price",
  "HOA Fee", "AssociationFee", "Association Fee", "HOA",
  "AssociationFeeFrequency", "HOA Fee Frequency",
  "PropertyType", "Property Type",
  "PropertySubType", "Property Sub Type",
  "YearBuilt", "Year Built",
  "Listing Agent", "ListAgentFullName", "List Agent", "List Agent Full Name",
  "Buyer Agent", "BuyerAgentFullName", "Buyer's Agent", "Buyer Agent Full Name",
  "ListOfficeName", "List Office", "List Office Name",
  "BuyerFinancing", "Buyer Financing", "Financing",
  "Closed $/SF", "Closed Price/Sqft", "Close$/SqFt",
  "Closed Price/List Price", "CP/LP", "CP$/LP$ %",
  "Closed Price/Original List Price", "Close Price/Original List Price", "CP/OLP", "CP$/OLP$ %",
  "Parking Features", "ParkingFeatures",
  "Public Remarks", "PublicRemarks",
  "Private Remarks", "PrivateRemarks",
  "Hold Date", "HoldDate",
  "Withdrawn Date", "WithdrawnDate",
  "Cancellation Date", "CancellationDate",
  "Contingent Date", "ContingentDate",
  "Floor Plan Name/Number", "FloorPlanName", "Floor Plan",
  "Direction Faces", "DirectionFaces",
]);

// Case-insensitive lookup set for column matching
const RELEVANT_COLUMNS_LOWER = new Set(
  Array.from(RELEVANT_COLUMNS).map((c) => c.toLowerCase())
);

const BATCH_SIZE = 500;

export default function ImportPage() {
  // Transaction import state
  const [txFiles, setTxFiles] = useState<File[]>([]);
  const [txFileProgress, setTxFileProgress] = useState<FileProgress[]>([]);
  const [txImporting, setTxImporting] = useState(false);
  const [txAggregateResult, setTxAggregateResult] = useState<ImportResult | null>(null);
  const [txDetectedHeaders, setTxDetectedHeaders] = useState<string[]>([]);
  const [txKeptHeaders, setTxKeptHeaders] = useState<string[]>([]);
  const [txStrippedCount, setTxStrippedCount] = useState(0);
  const txFileRef = useRef<HTMLInputElement>(null);

  // Server-side import state
  const [serverImporting, setServerImporting] = useState(false);
  const [serverResult, setServerResult] = useState<ServerImportResult | null>(null);

  // Enrichment import state
  const [enFile, setEnFile] = useState<File | null>(null);
  const [enPreview, setEnPreview] = useState<string[][]>([]);
  const [enHeaders, setEnHeaders] = useState<string[]>([]);
  const [enImporting, setEnImporting] = useState(false);
  const [enResult, setEnResult] = useState<EnrichmentImportResult | null>(null);
  const enFileRef = useRef<HTMLInputElement>(null);

  // Re-enrichment state
  const [reEnriching, setReEnriching] = useState(false);
  const [reEnrichResult, setReEnrichResult] =
    useState<EnrichmentApplyResult | null>(null);

  // Enrichment stats
  const [enrichStats, setEnrichStats] = useState<EnrichmentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load enrichment stats
  const loadEnrichStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/downtown-condos/api/mls/enrichment-import");
      if (res.ok) {
        setEnrichStats(await res.json());
      }
    } catch {
      // ignore
    }
    setStatsLoading(false);
  };

  // --- Server-Side Import (reads from data/imports/) ---

  const handleServerImport = async () => {
    setServerImporting(true);
    setServerResult(null);

    try {
      const res = await fetch("/downtown-condos/api/mls/analytics-import-files", {
        method: "POST",
      });
      const result: ServerImportResult = await res.json();
      setServerResult(result);
    } catch (err) {
      setServerResult({
        success: false,
        error: err instanceof Error ? err.message : "Server import failed",
      });
    }

    setServerImporting(false);
  };

  // --- Transaction CSV Handling (multi-file, column strip, batch) ---

  const handleTxFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setTxFiles(fileList);
    setTxAggregateResult(null);
    setTxFileProgress([]);

    // Read first file headers to show column detection
    const firstFile = fileList[0];
    const text = await firstFile.text();
    const firstLine = text.split("\n")[0];
    const headers = parseCsvLine(firstLine);

    setTxDetectedHeaders(headers);

    // Determine which columns will be kept vs stripped
    const kept: string[] = [];
    let stripped = 0;
    for (const h of headers) {
      if (RELEVANT_COLUMNS_LOWER.has(h.trim().toLowerCase())) {
        kept.push(h);
      } else {
        stripped++;
      }
    }
    setTxKeptHeaders(kept);
    setTxStrippedCount(stripped);
  };

  const stripCsvColumns = useCallback(
    (text: string): { headers: string[]; rows: string[][]; keepIndices: number[] } => {
      const lines = text.split("\n");
      if (lines.length < 2) return { headers: [], rows: [], keepIndices: [] };

      const allHeaders = parseCsvLine(lines[0]);

      // Find indices of columns to keep
      const keepIndices: number[] = [];
      const keptHeaders: string[] = [];
      for (let i = 0; i < allHeaders.length; i++) {
        if (RELEVANT_COLUMNS_LOWER.has(allHeaders[i].trim().toLowerCase())) {
          keepIndices.push(i);
          keptHeaders.push(allHeaders[i]);
        }
      }

      // Parse and filter each data row
      const rows: string[][] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCsvLine(line);
        const filtered = keepIndices.map((idx) => values[idx] || "");
        rows.push(filtered);
      }

      return { headers: keptHeaders, rows, keepIndices };
    },
    []
  );

  const buildCsvText = (headers: string[], rows: string[][]): string => {
    const escapeCell = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const headerLine = headers.map(escapeCell).join(",");
    const dataLines = rows.map((row) => row.map(escapeCell).join(","));
    return [headerLine, ...dataLines].join("\n");
  };

  const handleTxImport = async () => {
    if (txFiles.length === 0) return;
    setTxImporting(true);
    setTxAggregateResult(null);

    const allProgress: FileProgress[] = txFiles.map((f) => ({
      fileName: f.name,
      totalRows: 0,
      processedRows: 0,
      batchesSent: 0,
      totalBatches: 0,
      status: "pending" as const,
    }));
    setTxFileProgress([...allProgress]);

    // Aggregate result accumulators
    let aggTotalRows = 0;
    let aggTotalImported = 0;
    let aggMatched = 0;
    let aggUnmatched = 0;
    let aggAdded = 0;
    let aggUpdated = 0;
    const aggErrors: string[] = [];
    let aggDateStart: string | null = null;
    let aggDateEnd: string | null = null;
    const aggBuildingSlugs = new Set<string>();
    let lastDetectedColumns: Record<string, string> = {};
    const startTime = Date.now();

    for (let fi = 0; fi < txFiles.length; fi++) {
      const file = txFiles[fi];
      allProgress[fi].status = "stripping";
      setTxFileProgress([...allProgress]);

      try {
        const text = await file.text();

        // Strip columns
        const { headers, rows } = stripCsvColumns(text);
        allProgress[fi].totalRows = rows.length;

        // Batch the rows
        const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
        allProgress[fi].totalBatches = totalBatches;
        allProgress[fi].status = "uploading";
        setTxFileProgress([...allProgress]);

        for (let b = 0; b < totalBatches; b++) {
          const batchRows = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
          const csvText = buildCsvText(headers, batchRows);

          const res = await fetch("/downtown-condos/api/mls/analytics-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csvText }),
          });

          const result: ImportResult = await res.json();

          if (result.success) {
            aggTotalRows += result.totalRows || 0;
            aggTotalImported += result.totalImported || 0;
            aggMatched += result.matched || 0;
            aggUnmatched += result.unmatched || 0;
            aggAdded += result.added || 0;
            aggUpdated += result.updated || 0;
            if (result.detectedColumns) {
              lastDetectedColumns = result.detectedColumns;
            }
            if (result.errors) {
              aggErrors.push(
                ...result.errors.map((e) => `[${file.name} batch ${b + 1}] ${e}`)
              );
            }
            // Track date range
            if (result.dateRange) {
              if (result.dateRange.start) {
                if (!aggDateStart || result.dateRange.start < aggDateStart)
                  aggDateStart = result.dateRange.start;
              }
              if (result.dateRange.end) {
                if (!aggDateEnd || result.dateRange.end > aggDateEnd)
                  aggDateEnd = result.dateRange.end;
              }
            }
          } else {
            aggErrors.push(
              `[${file.name} batch ${b + 1}] ${result.error || "Unknown error"}`
            );
          }

          allProgress[fi].batchesSent = b + 1;
          allProgress[fi].processedRows = Math.min(
            (b + 1) * BATCH_SIZE,
            rows.length
          );
          setTxFileProgress([...allProgress]);
        }

        allProgress[fi].status = "done";
        setTxFileProgress([...allProgress]);
      } catch (err) {
        allProgress[fi].status = "error";
        allProgress[fi].error =
          err instanceof Error ? err.message : "Upload failed";
        setTxFileProgress([...allProgress]);
        aggErrors.push(
          `[${file.name}] ${err instanceof Error ? err.message : "Upload failed"}`
        );
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

    setTxAggregateResult({
      success: aggErrors.filter((e) => e.includes("Unknown error")).length === 0,
      totalRows: aggTotalRows,
      totalImported: aggTotalImported,
      matched: aggMatched,
      unmatched: aggUnmatched,
      added: aggAdded,
      updated: aggUpdated,
      buildingsAffected: aggBuildingSlugs.size || undefined,
      dateRange: { start: aggDateStart, end: aggDateEnd },
      detectedColumns: lastDetectedColumns,
      errors: aggErrors.slice(0, 50),
      duration: `${totalDuration}s`,
    });

    setTxImporting(false);
  };

  // --- Enrichment CSV Handling ---

  const handleEnFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnFile(file);
    setEnResult(null);

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    const headers = parseCsvLine(lines[0]);
    setEnHeaders(headers);

    const preview: string[][] = [];
    for (let i = 1; i < Math.min(6, lines.length); i++) {
      preview.push(parseCsvLine(lines[i]));
    }
    setEnPreview(preview);

    // Also load current stats
    loadEnrichStats();
  };

  const handleEnImport = async () => {
    if (!enFile) return;
    setEnImporting(true);
    setEnResult(null);

    try {
      const csvText = await enFile.text();
      const res = await fetch("/downtown-condos/api/mls/enrichment-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const result = await res.json();
      setEnResult(result);
      if (result.enrichmentStats) {
        setEnrichStats(result.enrichmentStats);
      }
    } catch (err) {
      setEnResult({
        success: false,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }

    setEnImporting(false);
  };

  // --- Re-enrichment ---

  const handleReEnrich = async () => {
    setReEnriching(true);
    setReEnrichResult(null);

    try {
      const res = await fetch("/downtown-condos/api/mls/enrichment-apply", {
        method: "POST",
      });
      const result = await res.json();
      setReEnrichResult(result);
    } catch (err) {
      setReEnrichResult({
        success: false,
        error: err instanceof Error ? err.message : "Re-enrichment failed",
      });
    }

    setReEnriching(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold tracking-wide text-primary">
        Data Import
      </h1>
      <p className="mb-10 text-sm text-secondary">
        Import transaction data and floor plan mappings for market analytics.
      </p>

      {/* Section 1: Transaction Import */}
      <section className="mb-12 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-bold uppercase tracking-wider text-primary">
          Transaction Data
        </h2>
        <p className="mb-6 text-sm text-secondary">
          Import transaction data from CSV files. Use the server import to
          process files already in the project, or upload files from your computer.
        </p>

        {/* Server-side import from data/imports/ */}
        <div className="mb-6 rounded border border-denim/20 bg-denim/5 p-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-primary">
            Import from Server Files
          </h3>
          <p className="mb-3 text-xs text-secondary">
            Reads all CSV files from <code className="rounded bg-gray-100 px-1">data/imports/</code> and
            imports them directly. No upload needed.
          </p>
          <button
            onClick={handleServerImport}
            disabled={serverImporting}
            className="rounded bg-accent px-6 py-2 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {serverImporting ? "Importing... (this may take a few minutes)" : "Import Server Files"}
          </button>

          {serverResult && (
            <div
              className={`mt-4 rounded border p-4 text-sm ${
                serverResult.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              {serverResult.success ? (
                <>
                  <p className="font-medium text-green-800">
                    Import complete ({serverResult.duration})
                  </p>
                  <ul className="mt-2 space-y-0.5 text-green-700">
                    <li>Files processed: {serverResult.filesProcessed}</li>
                    <li>Total rows: {serverResult.totalRows?.toLocaleString()}</li>
                    <li>Imported: {serverResult.totalImported?.toLocaleString()}</li>
                    <li>
                      Matched to buildings: {serverResult.matched?.toLocaleString()} |
                      Unmatched: {serverResult.unmatched?.toLocaleString()}
                    </li>
                    <li>
                      Added: {serverResult.added?.toLocaleString()} |
                      Updated: {serverResult.updated?.toLocaleString()}
                    </li>
                    <li>Buildings affected: {serverResult.buildingsAffected}</li>
                    {serverResult.dateRange && (
                      <li>
                        Date range: {serverResult.dateRange.start} to{" "}
                        {serverResult.dateRange.end}
                      </li>
                    )}
                  </ul>
                  {serverResult.fileResults && serverResult.fileResults.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-green-700">
                        Per-file breakdown
                      </summary>
                      <div className="mt-1 space-y-0.5">
                        {serverResult.fileResults.map((f, i) => (
                          <p key={i} className="text-xs text-green-600">
                            {f.fileName}: {f.parsed.toLocaleString()} parsed / {f.totalRows.toLocaleString()} rows
                            {f.errors > 0 && ` (${f.errors} errors)`}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                  {serverResult.errors && serverResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-yellow-700">
                        Warnings ({serverResult.errors.length})
                      </summary>
                      <div className="mt-1 space-y-0.5">
                        {serverResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-yellow-600">
                            {err}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-red-700">
                  Error: {serverResult.error}
                  {serverResult.details && ` — ${serverResult.details}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            Or upload from your computer
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mb-4">
          <input
            ref={txFileRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleTxFileSelect}
            className="block w-full text-sm text-secondary file:mr-4 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:px-4 file:py-2 file:text-sm file:text-primary hover:file:bg-gray-100"
          />
        </div>

        {/* File list */}
        {txFiles.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Selected Files ({txFiles.length})
            </h3>
            <div className="space-y-1">
              {txFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded bg-gray-50 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium text-primary">{f.name}</span>
                  <span className="text-xs text-secondary">
                    ({(f.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Column detection info */}
        {txDetectedHeaders.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Column Detection
            </h3>
            <div className="rounded border border-denim/20 bg-denim/5 p-3">
              <p className="text-sm text-primary">
                <span className="font-medium">{txDetectedHeaders.length}</span> total columns detected
                {" | "}
                <span className="font-medium text-green-700">{txKeptHeaders.length}</span> relevant columns kept
                {" | "}
                <span className="font-medium text-yellow-700">{txStrippedCount}</span> stripped for upload
              </p>
              <p className="mt-1 text-xs text-secondary">
                Stripping reduces upload size by ~{txDetectedHeaders.length > 0 ? Math.round((1 - txKeptHeaders.length / txDetectedHeaders.length) * 100) : 0}%
              </p>
            </div>

            {/* Show kept columns */}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-secondary hover:text-primary">
                Show kept columns ({txKeptHeaders.length})
              </summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {txKeptHeaders.map((h) => (
                  <span
                    key={h}
                    className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Import button */}
        {txFiles.length > 0 && (
          <button
            onClick={handleTxImport}
            disabled={txImporting}
            className="rounded bg-accent px-6 py-2 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {txImporting
              ? "Importing..."
              : `Import ${txFiles.length} File${txFiles.length > 1 ? "s" : ""}`}
          </button>
        )}

        {/* Per-file progress */}
        {txFileProgress.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
              Import Progress
            </h3>
            {txFileProgress.map((fp, i) => (
              <div key={i} className="rounded border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {fp.fileName}
                  </span>
                  <span
                    className={`text-xs font-medium uppercase ${
                      fp.status === "done"
                        ? "text-green-600"
                        : fp.status === "error"
                        ? "text-red-600"
                        : fp.status === "uploading"
                        ? "text-accent"
                        : fp.status === "stripping"
                        ? "text-yellow-600"
                        : "text-secondary"
                    }`}
                  >
                    {fp.status === "pending" && "Waiting..."}
                    {fp.status === "stripping" && "Preprocessing..."}
                    {fp.status === "uploading" &&
                      `Batch ${fp.batchesSent}/${fp.totalBatches}`}
                    {fp.status === "done" && "Complete"}
                    {fp.status === "error" && "Error"}
                  </span>
                </div>

                {/* Progress bar */}
                {(fp.status === "uploading" || fp.status === "done") && fp.totalBatches > 0 && (
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          fp.status === "done" ? "bg-green-500" : "bg-accent"
                        }`}
                        style={{
                          width: `${(fp.batchesSent / fp.totalBatches) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      {fp.processedRows.toLocaleString()} / {fp.totalRows.toLocaleString()} rows
                    </p>
                  </div>
                )}

                {fp.error && (
                  <p className="mt-1 text-xs text-red-600">{fp.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Aggregate result */}
        {txAggregateResult && (
          <div
            className={`mt-4 rounded border p-4 text-sm ${
              txAggregateResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {txAggregateResult.success ? (
              <>
                <p className="font-medium text-green-800">
                  Import complete ({txAggregateResult.duration})
                </p>
                <ul className="mt-2 space-y-0.5 text-green-700">
                  <li>Total rows processed: {txAggregateResult.totalRows?.toLocaleString()}</li>
                  <li>Imported: {txAggregateResult.totalImported?.toLocaleString()}</li>
                  <li>
                    Matched to buildings: {txAggregateResult.matched?.toLocaleString()} | Unmatched:{" "}
                    {txAggregateResult.unmatched?.toLocaleString()}
                  </li>
                  <li>
                    Added: {txAggregateResult.added?.toLocaleString()} | Updated:{" "}
                    {txAggregateResult.updated?.toLocaleString()}
                  </li>
                  {txAggregateResult.dateRange && (
                    <li>
                      Date range: {txAggregateResult.dateRange.start} to{" "}
                      {txAggregateResult.dateRange.end}
                    </li>
                  )}
                </ul>
                {txAggregateResult.errors && txAggregateResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-yellow-700">
                      Warnings ({txAggregateResult.errors.length})
                    </summary>
                    <div className="mt-1 space-y-0.5">
                      {txAggregateResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-yellow-600">
                          {err}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <>
                <p className="font-medium text-red-700">
                  Import completed with errors ({txAggregateResult.duration})
                </p>
                {txAggregateResult.totalImported &&
                  txAggregateResult.totalImported > 0 && (
                    <p className="mt-1 text-sm text-red-600">
                      Partially imported: {txAggregateResult.totalImported.toLocaleString()} rows
                    </p>
                  )}
                {txAggregateResult.errors && txAggregateResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {txAggregateResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-xs text-red-600">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Floor Plan Enrichment */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-bold uppercase tracking-wider text-primary">
          Floor Plan Enrichment
        </h2>
        <p className="mb-4 text-sm text-secondary">
          Upload a CSV mapping units to floor plans and orientations. Expected
          columns: Building, Unit, Floor Plan, Orientation.
        </p>

        {/* Current coverage stats */}
        {enrichStats && (
          <div className="mb-4 rounded border border-denim/20 bg-denim/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Current Coverage
            </p>
            <p className="text-sm text-secondary">
              {enrichStats.buildingsMapped} buildings mapped |{" "}
              {enrichStats.totalUnits} total units
            </p>
            {enrichStats.buildingDetails.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {enrichStats.buildingDetails.map((b) => (
                  <span
                    key={b.slug}
                    className="rounded bg-denim/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {b.slug}: {b.unitCount}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <input
            ref={enFileRef}
            type="file"
            accept=".csv"
            onChange={handleEnFileSelect}
            className="block w-full text-sm text-secondary file:mr-4 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:px-4 file:py-2 file:text-sm file:text-primary hover:file:bg-gray-100"
          />
        </div>

        {enHeaders.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Detected Columns
            </h3>
            <div className="flex flex-wrap gap-1">
              {enHeaders.map((h) => (
                <span
                  key={h}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-secondary"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {enPreview.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-secondary">
              Preview
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {enHeaders.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-1 text-left font-medium text-secondary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enPreview.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-2 py-1 text-secondary">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3">
          {enFile && (
            <button
              onClick={handleEnImport}
              disabled={enImporting}
              className="rounded bg-accent px-6 py-2 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {enImporting ? "Importing..." : "Upload Floor Plans"}
            </button>
          )}

          <button
            onClick={handleReEnrich}
            disabled={reEnriching}
            className="rounded border border-accent px-6 py-2 text-sm font-medium uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
          >
            {reEnriching
              ? "Re-enriching..."
              : "Re-enrich All Transactions"}
          </button>
        </div>

        {enResult && (
          <div
            className={`mt-4 rounded border p-4 text-sm ${
              enResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {enResult.success ? (
              <>
                <p className="font-medium text-green-800">
                  Floor plan data imported
                </p>
                <ul className="mt-2 space-y-0.5 text-green-700">
                  <li>Entries: {enResult.totalEntries}</li>
                  <li>Buildings matched: {enResult.buildingsMatched}</li>
                  <li>
                    Added: {enResult.added} | Updated: {enResult.updated}
                  </li>
                </ul>
                {enResult.unmatchedBuildingNames &&
                  enResult.unmatchedBuildingNames.length > 0 && (
                    <p className="mt-1 text-xs text-yellow-600">
                      Unmatched buildings:{" "}
                      {enResult.unmatchedBuildingNames.join(", ")}
                    </p>
                  )}
              </>
            ) : (
              <p className="text-red-700">Error: {enResult.error}</p>
            )}
          </div>
        )}

        {reEnrichResult && (
          <div
            className={`mt-4 rounded border p-4 text-sm ${
              reEnrichResult.success
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            {reEnrichResult.success ? (
              <>
                <p className="font-medium text-green-800">
                  Re-enrichment complete ({reEnrichResult.duration})
                </p>
                <ul className="mt-2 space-y-0.5 text-green-700">
                  <li>Transactions processed: {reEnrichResult.totalProcessed}</li>
                  <li>Newly enriched: {reEnrichResult.totalEnriched}</li>
                  <li>Buildings updated: {reEnrichResult.buildingsUpdated}</li>
                </ul>
                {reEnrichResult.message && (
                  <p className="mt-1 text-sm text-yellow-600">
                    {reEnrichResult.message}
                  </p>
                )}
              </>
            ) : (
              <p className="text-red-700">Error: {reEnrichResult.error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// Simple CSV line parser
function parseCsvLine(line: string): string[] {
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
