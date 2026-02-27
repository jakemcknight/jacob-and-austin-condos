"use client";

export default function Narrative({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="market-report-narrative"
      style={{ marginBottom: 44 }}
    >
      <style>{`
        .market-report-narrative p {
          font-size: 16px;
          line-height: 1.7;
          margin-bottom: 16px;
          color: #2a2a2a;
        }
        .market-report-narrative p:last-child {
          margin-bottom: 0;
        }
      `}</style>
      {children}
    </div>
  );
}
