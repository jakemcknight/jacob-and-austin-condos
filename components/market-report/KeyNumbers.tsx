"use client";

interface KeyNumberItem {
  value: string;
  delta: string;
  direction: "up" | "down" | "neutral";
  label: string;
}

function parseData(data: string | KeyNumberItem[]): KeyNumberItem[] {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return data;
}

const directionColors = {
  up: "#2c5f4a",
  down: "#b44a3f",
  neutral: "#7a7a72",
};

const arrows = {
  up: "\u2191",
  down: "\u2193",
  neutral: "\u2014",
};

export default function KeyNumbers({ data }: { data: string | KeyNumberItem[] }) {
  const items = parseData(data);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        gap: 1,
        background: "#e2e0da",
        border: "1px solid #e2e0da",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 44,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            background: "white",
            padding: "24px 20px",
            textAlign: "center",
          }}
        >
          {/* Label on top */}
          <div
            style={{
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              fontSize: 12,
              color: "#7a7a72",
              letterSpacing: 0.3,
              marginBottom: 8,
            }}
          >
            {item.label}
          </div>
          {/* Value */}
          <div
            style={{
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            {item.value}
          </div>
          {/* Delta at bottom */}
          <div
            style={{
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: directionColors[item.direction],
            }}
          >
            {arrows[item.direction]} {item.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
