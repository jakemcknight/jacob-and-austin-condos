"use client";

interface StatCard {
  label: string;
  value: string;
  subvalue?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  tooltip?: string;
}

interface SummaryCardsProps {
  cards: StatCard[];
}

export default function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">
            {card.label}
            {card.tooltip && (
              <span className="group relative ml-1 inline-block align-middle">
                <svg className="inline h-3 w-3 cursor-help text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-normal normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {card.tooltip}
                </span>
              </span>
            )}
          </p>
          <p className="mt-1 text-xl font-bold text-primary">{card.value}</p>
          {card.trendLabel && (
            <p
              className={`mt-0.5 text-xs font-medium ${
                card.trend === "up"
                  ? "text-green-600"
                  : card.trend === "down"
                    ? "text-red-600"
                    : "text-secondary"
              }`}
            >
              {card.trendLabel}
            </p>
          )}
          {card.subvalue && (
            <p className="mt-0.5 text-xs text-secondary">
              {card.subvalue}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
