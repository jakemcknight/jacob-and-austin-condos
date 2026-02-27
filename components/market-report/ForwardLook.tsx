export default function ForwardLook({
  month,
  children,
}: {
  month: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderLeft: "3px solid #2c5f4a",
        paddingLeft: 20,
        marginBottom: 44,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase" as const,
          color: "#2c5f4a",
          marginBottom: 6,
        }}
      >
        What I&apos;m Watching in {month}
      </div>
      <div style={{ fontSize: 16, color: "#2a2a2a" }}>{children}</div>
    </div>
  );
}
