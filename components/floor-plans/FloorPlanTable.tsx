import { useState, useCallback } from "react";
import type { AgentFloorPlan, ColumnKey } from "@/lib/agent-floor-plans/types";
import { buildPlainText, buildHtml } from "./CopyControls";

interface FloorPlanTableProps {
  plans: AgentFloorPlan[];
  columns: Record<ColumnKey, boolean>;
  selectedPlanKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  planKeyFn: (plan: AgentFloorPlan) => string;
}

type SortKey = ColumnKey | "building";
type SortDir = "asc" | "desc";

function formatSqft(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getSortValue(plan: AgentFloorPlan, key: SortKey): string | number {
  switch (key) {
    case "building":
      return plan.building;
    case "floorPlan":
      return plan.floorPlan;
    case "bedrooms":
      return plan.bedrooms;
    case "bathrooms":
      return plan.bathrooms;
    case "hasStudy":
      return plan.hasStudy ? 1 : 0;
    case "sqft":
      return plan.sqft;
    case "orientation":
      return plan.orientation;
    case "unitNumbers":
      return plan.unitNumbers;
    case "quantity":
      return plan.quantity;
  }
}

export default function FloorPlanTable({
  plans,
  columns,
  selectedPlanKeys,
  onSelectionChange,
  planKeyFn,
}: FloorPlanTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("building");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [copiedBuilding, setCopiedBuilding] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const togglePlan = useCallback(
    (key: string) => {
      const next = new Set(selectedPlanKeys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onSelectionChange(next);
    },
    [selectedPlanKeys, onSelectionChange]
  );

  const toggleBuilding = useCallback(
    (buildingPlans: AgentFloorPlan[]) => {
      const keys = buildingPlans.map(planKeyFn);
      const allSelected = keys.every((k) => selectedPlanKeys.has(k));
      const next = new Set(selectedPlanKeys);
      if (allSelected) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      onSelectionChange(next);
    },
    [selectedPlanKeys, onSelectionChange, planKeyFn]
  );

  const handleCopyBuilding = async (
    buildingName: string,
    buildingPlans: AgentFloorPlan[]
  ) => {
    // If any plans in this building are hand-selected, copy only those
    const selected = buildingPlans.filter((p) =>
      selectedPlanKeys.has(planKeyFn(p))
    );
    const toCopy = selected.length > 0 ? selected : buildingPlans;

    const plainText = buildPlainText(toCopy, columns, buildingName);
    const html = buildHtml(toCopy, columns, buildingName);

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
        // Clipboard not available
      }
    }

    setCopiedBuilding(buildingName);
    setTimeout(() => setCopiedBuilding(null), 2000);
  };

  // Sort plans
  const sorted = [...plans].sort((a, b) => {
    const bldgCompare = a.building.localeCompare(b.building);
    if (sortKey === "building") {
      return sortDir === "asc" ? bldgCompare : -bldgCompare;
    }
    if (bldgCompare !== 0) return bldgCompare;
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    const cmp =
      typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Group by building
  const groups: [string, AgentFloorPlan[]][] = [];
  let currentBuilding = "";
  for (const plan of sorted) {
    if (plan.building !== currentBuilding) {
      currentBuilding = plan.building;
      groups.push([currentBuilding, []]);
    }
    groups[groups.length - 1][1].push(plan);
  }

  const SortHeader = ({
    label,
    sortKeyProp,
    align = "left",
    shrink = false,
  }: {
    label: string;
    sortKeyProp: SortKey;
    align?: string;
    shrink?: boolean;
  }) => (
    <th
      onClick={() => handleSort(sortKeyProp)}
      className={`cursor-pointer select-none whitespace-nowrap px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 text-${align}${shrink ? " w-px" : ""}`}
    >
      {label}
      {sortKey === sortKeyProp && (
        <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
      )}
    </th>
  );

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
        No floor plans match your filters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([building, bPlans]) => {
        const selectedInBuilding = bPlans.filter((p) =>
          selectedPlanKeys.has(planKeyFn(p))
        ).length;
        const allSelectedInBuilding =
          selectedInBuilding === bPlans.length && bPlans.length > 0;
        const someSelectedInBuilding =
          selectedInBuilding > 0 && selectedInBuilding < bPlans.length;

        return (
          <div
            key={building}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            {/* Building header */}
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allSelectedInBuilding}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelectedInBuilding;
                  }}
                  onChange={() => toggleBuilding(bPlans)}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  {building}{" "}
                  <span className="font-normal text-gray-400">
                    ({bPlans.length} plan{bPlans.length !== 1 ? "s" : ""})
                  </span>
                </h3>
              </div>
              <button
                onClick={() => handleCopyBuilding(building, bPlans)}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                {copiedBuilding === building
                  ? "Copied!"
                  : selectedInBuilding > 0
                    ? `Copy ${selectedInBuilding} Selected`
                    : "Copy"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="w-px px-2 py-1.5" />
                    {columns.floorPlan && (
                      <SortHeader
                        label="Floor Plan"
                        sortKeyProp="floorPlan"
                        shrink
                      />
                    )}
                    {columns.bedrooms && (
                      <SortHeader
                        label="Bed"
                        sortKeyProp="bedrooms"
                        align="center"
                        shrink
                      />
                    )}
                    {columns.bathrooms && (
                      <SortHeader
                        label="Bath"
                        sortKeyProp="bathrooms"
                        align="center"
                        shrink
                      />
                    )}
                    {columns.hasStudy && (
                      <SortHeader
                        label="Study"
                        sortKeyProp="hasStudy"
                        align="center"
                        shrink
                      />
                    )}
                    {columns.sqft && (
                      <SortHeader
                        label="SF"
                        sortKeyProp="sqft"
                        align="right"
                        shrink
                      />
                    )}
                    {columns.orientation && (
                      <SortHeader
                        label="Orientation"
                        sortKeyProp="orientation"
                        shrink
                      />
                    )}
                    {columns.unitNumbers && (
                      <SortHeader
                        label="Unit Numbers"
                        sortKeyProp="unitNumbers"
                      />
                    )}
                    {columns.quantity && (
                      <SortHeader
                        label="Qty"
                        sortKeyProp="quantity"
                        align="center"
                        shrink
                      />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {bPlans.map((plan, idx) => {
                    const key = planKeyFn(plan);
                    const isSelected = selectedPlanKeys.has(key);
                    return (
                      <tr
                        key={`${plan.buildingSlug}-${plan.floorPlan}-${idx}`}
                        className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                          isSelected ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePlan(key)}
                            className="rounded border-gray-300 text-accent focus:ring-accent"
                          />
                        </td>
                        {columns.floorPlan && (
                          <td className="px-2 py-1.5">
                            <a
                              href={plan.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {plan.floorPlan}
                            </a>
                          </td>
                        )}
                        {columns.bedrooms && (
                          <td className="px-2 py-1.5 text-center">
                            {plan.bedrooms === 0 ? "Studio" : plan.bedrooms}
                          </td>
                        )}
                        {columns.bathrooms && (
                          <td className="px-2 py-1.5 text-center">
                            {plan.bathrooms}
                          </td>
                        )}
                        {columns.hasStudy && (
                          <td className="px-2 py-1.5 text-center">
                            {plan.hasStudy ? (
                              <span
                                className="text-green-600"
                                title="Has study"
                              >
                                &#10003;
                              </span>
                            ) : (
                              ""
                            )}
                          </td>
                        )}
                        {columns.sqft && (
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatSqft(plan.sqft)}
                          </td>
                        )}
                        {columns.orientation && (
                          <td className="px-2 py-1.5 text-gray-700">
                            {plan.orientation}
                          </td>
                        )}
                        {columns.unitNumbers && (
                          <td
                            className="max-w-xs truncate px-2 py-1.5 text-gray-600"
                            title={plan.unitNumbers}
                          >
                            {plan.unitNumbers}
                          </td>
                        )}
                        {columns.quantity && (
                          <td className="px-2 py-1.5 text-center tabular-nums">
                            {plan.quantity}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
