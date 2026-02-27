"use client";

interface BuildingData {
  name: string;
  slug: string;
  rolling12AvgPsf: number;
  psfYoyChange: number;
  active: number;
  pending: number;
  closed: number;
  monthsOfSupply: number;
  rolling12MedianDom: number;
}

function parseData(data: string | BuildingData[]): BuildingData[] {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return data;
}

function BuildingParagraph({
  b,
  month,
  isLast,
}: {
  b: BuildingData;
  month: string;
  isLast: boolean;
}) {
  const yoyAbs = Math.abs(b.psfYoyChange);
  const yoyStr =
    b.psfYoyChange > 0.05
      ? `\u2191 ${yoyAbs.toFixed(1)}% YoY`
      : b.psfYoyChange < -0.05
      ? `\u2193 ${yoyAbs.toFixed(1)}% YoY`
      : "flat YoY";
  const yoyColor =
    b.psfYoyChange > 0.05
      ? "#2c5f4a"
      : b.psfYoyChange < -0.05
      ? "#b44a3f"
      : "#7a7a72";

  const supplyLabel =
    b.monthsOfSupply > 0
      ? b.monthsOfSupply <= 6
        ? "a tight market"
        : b.monthsOfSupply <= 8
        ? "a balanced market"
        : "a buyer\u2019s market"
      : null;

  return (
    <div
      style={{
        padding: "18px 0",
        borderBottom: isLast ? "none" : "1px solid #e2e0da",
      }}
    >
      <a
        href={`/downtown-condos/${b.slug}#active-listings`}
        style={{
          fontWeight: 700,
          fontSize: 15,
          color: "#1a1a1a",
          textDecoration: "none",
        }}
      >
        {b.name}
      </a>
      <span style={{ fontSize: 15, color: "#2a2a2a", lineHeight: 1.7 }}>
        {" "}&mdash; As of {month}, {b.name} has{" "}
        {b.active} active {b.active === 1 ? "listing" : "listings"}
        {b.pending > 0 && (
          <> and {b.pending} pending {b.pending === 1 ? "contract" : "contracts"}</>
        )}
        , with a rolling 12-month median of ${b.rolling12AvgPsf}/SF (
        <span style={{ color: yoyColor, fontWeight: 500 }}>{yoyStr}</span>).
        {b.rolling12MedianDom > 0 && (
          <> Units are selling at a median of {b.rolling12MedianDom} days on market</>
        )}
        {b.monthsOfSupply > 0 && (
          <> with {b.monthsOfSupply} months of supply{supplyLabel ? ` \u2014 ${supplyLabel}` : ""}</>
        )}
        .{" "}
        {b.closed > 0 && (
          <>{b.closed} {b.closed === 1 ? "sale closed" : "sales closed"} this month. </>
        )}
        <a
          href={`/downtown-condos/${b.slug}#active-listings`}
          style={{
            color: "#2c5f4a",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            borderBottom: "1px solid #2c5f4a",
          }}
        >
          View active listings &rarr;
        </a>
      </span>
    </div>
  );
}

export default function BuildingByBuilding({
  data,
  month,
}: {
  data: string | BuildingData[];
  month: string;
}) {
  const buildings = parseData(data);
  if (buildings.length === 0) return null;

  // Sort by most active: pending + closed first
  const sorted = [...buildings].sort(
    (a, b) => (b.pending + b.closed) - (a.pending + a.closed)
  );

  const top5 = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  return (
    <div style={{ marginBottom: 44 }}>
      <h2
        style={{
          fontFamily: "var(--font-playfair), 'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 20,
          paddingBottom: 10,
          borderBottom: "1px solid #e2e0da",
        }}
      >
        Building by Building
      </h2>

      {/* Top 5 — always visible */}
      {top5.map((b, i) => (
        <BuildingParagraph
          key={b.slug}
          b={b}
          month={month}
          isLast={rest.length === 0 && i === top5.length - 1}
        />
      ))}

      {/* Remaining buildings — expandable */}
      {rest.length > 0 && (
        <details>
          <summary
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "14px 0",
              fontSize: 14,
              fontWeight: 600,
              color: "#2c5f4a",
              cursor: "pointer",
              borderBottom: "1px solid #e2e0da",
              listStyle: "none",
              userSelect: "none",
            }}
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `
              details > summary::-webkit-details-marker { display: none; }
              details > summary::marker { display: none; content: ""; }
              details[open] > summary .arrow-down { transform: rotate(180deg); }
            `,
              }}
            />
            See all buildings.
            <span
              className="arrow-down"
              style={{
                display: "inline-block",
                transition: "transform 0.2s ease",
                fontSize: 12,
              }}
            >
              &#9660;
            </span>
          </summary>
          {rest.map((b, i) => (
            <BuildingParagraph
              key={b.slug}
              b={b}
              month={month}
              isLast={i === rest.length - 1}
            />
          ))}
        </details>
      )}
    </div>
  );
}
