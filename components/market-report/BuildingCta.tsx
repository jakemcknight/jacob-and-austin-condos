export default function BuildingCta() {
  return (
    <div
      style={{
        marginBottom: 44,
        padding: "20px 24px",
        background: "#e8f0ec",
        borderRadius: 8,
        fontSize: 15,
        color: "#2c5f4a",
      }}
    >
      Want a deeper dive? Explore a breakdown by building, area, bed count,
      view orientation, floor plan, and more.{" "}
      <a
        href="https://jacobinaustin.com/contact"
        style={{
          color: "#2c5f4a",
          fontWeight: 700,
          textDecoration: "none",
          borderBottom: "1.5px solid #2c5f4a",
        }}
      >
        Reach out directly
      </a>{" "}
      and I&apos;ll send you a full building breakdown.
    </div>
  );
}
