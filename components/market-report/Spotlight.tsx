export default function Spotlight({
  building,
  title,
  children,
}: {
  building: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e0da",
        borderRadius: 8,
        padding: "28px 24px",
        marginBottom: 44,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color: "#2c5f4a",
          marginBottom: 10,
        }}
      >
        Building Spotlight
      </div>
      <div
        style={{
          fontFamily: "var(--font-playfair), 'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {building} — {title}
      </div>
      <div style={{ fontSize: 15, color: "#2a2a2a", lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
