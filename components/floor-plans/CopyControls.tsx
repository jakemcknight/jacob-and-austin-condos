import { useState } from "react";
import type { AgentFloorPlan, ColumnKey } from "@/lib/agent-floor-plans/types";
import { BUILDING_NAME_TO_SLUG } from "@/lib/agent-floor-plans/building-name-map";

interface CopyControlsProps {
  columns: Record<ColumnKey, boolean>;
  onColumnsChange: (columns: Record<ColumnKey, boolean>) => void;
  filteredPlans: AgentFloorPlan[];
}

const COLUMN_LABELS: Record<ColumnKey, string> = {
  floorPlan: "Floor Plan",
  bedrooms: "Bed",
  bathrooms: "Bath",
  hasStudy: "Study",
  sqft: "SF",
  orientation: "Orientation",
  unitNumbers: "Unit Numbers",
  quantity: "Qty",
};

function formatSqft(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://jacobinaustin.com";
}

function buildPlainText(
  plans: AgentFloorPlan[],
  columns: Record<ColumnKey, boolean>,
  buildingName?: string
): string {
  const groups = groupByBuilding(plans, buildingName);
  const lines: string[] = [];

  for (const [building, bPlans] of groups) {
    const slug = BUILDING_NAME_TO_SLUG[building] || "";
    lines.push(`${building.toUpperCase()}`);
    lines.push("");

    // Header row
    const headers: string[] = [];
    if (columns.floorPlan) headers.push("Floor Plan");
    if (columns.bedrooms) headers.push("Bed");
    if (columns.bathrooms) headers.push("Bath");
    if (columns.hasStudy) headers.push("Study");
    if (columns.sqft) headers.push("SF");
    if (columns.orientation) headers.push("Orientation");
    if (columns.unitNumbers) headers.push("Unit Numbers");
    if (columns.quantity) headers.push("Qty");
    lines.push(headers.join("\t"));

    for (const p of bPlans) {
      const row: string[] = [];
      if (columns.floorPlan) row.push(p.floorPlan);
      if (columns.bedrooms) row.push(p.bedrooms === 0 ? "Studio" : String(p.bedrooms));
      if (columns.bathrooms) row.push(String(p.bathrooms));
      if (columns.hasStudy) row.push(p.hasStudy ? "Yes" : "");
      if (columns.sqft) row.push(formatSqft(p.sqft));
      if (columns.orientation) row.push(p.orientation);
      if (columns.unitNumbers) row.push(p.unitNumbers);
      if (columns.quantity) row.push(String(p.quantity));
      lines.push(row.join("\t"));
    }

    lines.push("");
    lines.push(
      `View floor plans: ${getBaseUrl()}/downtown-condos/${slug}`
    );
    lines.push("");
  }

  return lines.join("\n");
}

function buildHtml(
  plans: AgentFloorPlan[],
  columns: Record<ColumnKey, boolean>,
  buildingName?: string
): string {
  const groups = groupByBuilding(plans, buildingName);
  const parts: string[] = [];

  for (const [building, bPlans] of groups) {
    const slug = BUILDING_NAME_TO_SLUG[building] || "";
    const baseUrl = getBaseUrl();

    parts.push(
      `<div style="font-family:Arial,sans-serif;font-size:14px;margin-bottom:24px;">`
    );
    parts.push(
      `<h3 style="background:#E1DDD1;color:#191919;margin:0 0 8px;padding:8px 12px;font-size:16px;border-radius:4px;">${building.toUpperCase()}</h3>`
    );
    parts.push(
      `<table style="border-collapse:collapse;width:100%;font-size:13px;">`
    );

    // Header
    parts.push(
      `<thead><tr style="background:#f5f5f5;border-bottom:2px solid #ddd;">`
    );
    const th = (label: string, align = "left") =>
      `<th style="padding:6px 10px;text-align:${align};font-weight:600;">${label}</th>`;
    if (columns.floorPlan) parts.push(th("Floor Plan"));
    if (columns.bedrooms) parts.push(th("Bed", "center"));
    if (columns.bathrooms) parts.push(th("Bath", "center"));
    if (columns.hasStudy) parts.push(th("Study", "center"));
    if (columns.sqft) parts.push(th("SF", "right"));
    if (columns.orientation) parts.push(th("Orientation"));
    if (columns.unitNumbers) parts.push(th("Unit Numbers"));
    if (columns.quantity) parts.push(th("Qty", "center"));
    parts.push(`</tr></thead>`);

    // Body
    parts.push(`<tbody>`);
    for (const p of bPlans) {
      parts.push(`<tr style="border-bottom:1px solid #eee;">`);
      const td = (content: string, align = "left") =>
        `<td style="padding:5px 10px;text-align:${align};">${content}</td>`;

      if (columns.floorPlan) {
        const url = `${baseUrl}/downtown-condos/${slug}/${p.floorPlanSlug}`;
        parts.push(
          `<td style="padding:5px 10px;"><a href="${url}" style="color:#2563eb;text-decoration:none;">${p.floorPlan}</a></td>`
        );
      }
      if (columns.bedrooms)
        parts.push(td(p.bedrooms === 0 ? "Studio" : String(p.bedrooms), "center"));
      if (columns.bathrooms) parts.push(td(String(p.bathrooms), "center"));
      if (columns.hasStudy) parts.push(td(p.hasStudy ? "Yes" : "", "center"));
      if (columns.sqft) parts.push(td(formatSqft(p.sqft), "right"));
      if (columns.orientation) parts.push(td(p.orientation));
      if (columns.unitNumbers) parts.push(td(p.unitNumbers));
      if (columns.quantity) parts.push(td(String(p.quantity), "center"));
      parts.push(`</tr>`);
    }
    parts.push(`</tbody></table>`);

    parts.push(
      `<p style="margin-top:12px;font-size:12px;color:#666;">View all floor plans: <a href="${baseUrl}/downtown-condos/${slug}" style="color:#2563eb;">${baseUrl}/downtown-condos/${slug}</a></p>`
    );
    parts.push(`</div>`);
  }

  return parts.join("");
}

function groupByBuilding(
  plans: AgentFloorPlan[],
  singleBuilding?: string
): [string, AgentFloorPlan[]][] {
  if (singleBuilding) {
    return [[singleBuilding, plans]];
  }
  const map = new Map<string, AgentFloorPlan[]>();
  for (const p of plans) {
    if (!map.has(p.building)) map.set(p.building, []);
    map.get(p.building)!.push(p);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function CopyControls({
  columns,
  onColumnsChange,
  filteredPlans,
}: CopyControlsProps) {
  const [copied, setCopied] = useState(false);

  const toggle = (key: ColumnKey) => {
    onColumnsChange({ ...columns, [key]: !columns[key] });
  };

  const handleCopy = async (buildingName?: string) => {
    const plans = buildingName
      ? filteredPlans.filter((p) => p.building === buildingName)
      : filteredPlans;

    const plainText = buildPlainText(plans, columns, buildingName);
    const html = buildHtml(plans, columns, buildingName);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } catch {
      try {
        await navigator.clipboard.writeText(plainText);
      } catch {
        // Clipboard not available (e.g. non-secure context)
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Copy columns:
        </span>
        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
          <label
            key={key}
            className="flex items-center gap-1.5 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={columns[key]}
              onChange={() => toggle(key)}
              className="rounded border-gray-300 text-accent focus:ring-accent"
            />
            {COLUMN_LABELS[key]}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleCopy()}
          className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          {copied ? "Copied!" : "Copy All Filtered"}
        </button>
      </div>
    </div>
  );
}

// Export for use by FloorPlanTable per-building copy buttons
export { buildPlainText, buildHtml };
