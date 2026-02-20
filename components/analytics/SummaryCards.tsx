"use client";

interface StatCard {
  label: string;
  value: string;
  subvalue?: string;
  trend?: "up" | "down" | "neutral";
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
          </p>
          <p className="mt-1 text-xl font-bold text-primary">{card.value}</p>
          {card.subvalue && (
            <p
              className={`mt-0.5 text-xs ${
                card.trend === "up"
                  ? "text-green-600"
                  : card.trend === "down"
                    ? "text-red-600"
                    : "text-secondary"
              }`}
            >
              {card.subvalue}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
