"use client";

export type TabId = "sold" | "snapshot" | "pending" | "pricing";

interface Tab {
  id: TabId;
  label: string;
  count?: number;
}

interface AnalyticsTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  counts?: {
    closed?: number;
    active?: number;
    pending?: number;
  };
}

export default function AnalyticsTabs({
  activeTab,
  onTabChange,
  counts,
}: AnalyticsTabsProps) {
  const tabs: Tab[] = [
    { id: "sold", label: "Sold", count: counts?.closed },
    { id: "snapshot", label: "Market Snapshot" },
    { id: "pending", label: "Pending", count: counts?.pending },
    { id: "pricing", label: "Pricing Tool" },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-accent text-accent"
              : "text-secondary hover:text-primary"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === tab.id
                  ? "bg-accent/10 text-accent"
                  : "bg-gray-100 text-secondary"
              }`}
            >
              {tab.count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
