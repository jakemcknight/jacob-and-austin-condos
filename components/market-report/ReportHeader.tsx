export default function ReportHeader({
  month,
  publishDate,
}: {
  month: string;
  publishDate: string;
}) {
  return (
    <header style={{ marginBottom: 40 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color: "#2c5f4a",
          marginBottom: 12,
        }}
      >
        Downtown Austin Condo Market Update
      </div>
      <h1
        style={{
          fontFamily: "var(--font-playfair), 'Playfair Display', serif",
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "#1a1a1a",
          marginBottom: 8,
        }}
      >
        {month} Market Report
      </h1>
      <div style={{ fontSize: 15, color: "#7a7a72" }}>
        Published by Jacob Hannusch on {publishDate} · Data sourced from Unlock MLS (formerly ACTRIS)
      </div>
    </header>
  );
}
