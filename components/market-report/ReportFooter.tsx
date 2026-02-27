export default function ReportFooter({
  month,
  priorMonth,
}: {
  month: string;
  priorMonth: string;
}) {
  return (
    <div
      style={{
        paddingTop: 24,
        borderTop: "1px solid #e2e0da",
        fontSize: 13,
        color: "#7a7a72",
        lineHeight: 1.6,
      }}
    >
      <p>
        <strong style={{ color: "#1a1a1a" }}>Jacob Hannusch</strong> · Downtown
        Austin Condo Specialist
        <br />
        Data sourced from Unlock MLS (formerly ACTRIS). All figures based on condos
        in downtown Austin. Rolling 12-month averages compare the trailing 12
        months ending {month} vs. the trailing 12 months ending {priorMonth}.
        <br />
        <br />
        <a
          href="https://jacobinaustin.com/join-newsletter"
          style={{ color: "#2c5f4a", textDecoration: "none", fontWeight: 500 }}
        >
          Subscribe to get this report monthly
        </a>{" "}
        ·{" "}
        <a
          href="https://jacobinaustin.com/insights"
          style={{ color: "#2c5f4a", textDecoration: "none", fontWeight: 500 }}
        >
          View past reports
        </a>
      </p>
    </div>
  );
}
