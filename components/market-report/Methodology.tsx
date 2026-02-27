"use client";

export default function Methodology({ children }: { children: React.ReactNode }) {
  return (
    <details
      className="market-report-methodology"
      style={{
        background: "#f5f4f0",
        border: "1px solid #e2e0da",
        borderRadius: 8,
        marginBottom: 44,
      }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          cursor: "pointer",
          listStyle: "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase" as const,
            color: "#7a7a72",
          }}
        >
          How to Read This Report
        </span>
        <span
          className="methodology-toggle"
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: "#7a7a72",
            lineHeight: 1,
            transition: "transform 0.2s ease",
          }}
        >
          +
        </span>
      </summary>
      <div style={{ padding: "0 24px 20px" }}>
        {children}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .market-report-methodology summary::-webkit-details-marker {
              display: none;
            }
            .market-report-methodology[open] .methodology-toggle {
              transform: rotate(45deg);
            }
            .market-report-methodology p {
              font-size: 14px;
              line-height: 1.65;
              margin-bottom: 10px;
              color: #4a4a45;
            }
            .market-report-methodology p:last-of-type {
              margin-bottom: 0;
            }
            .market-report-methodology strong {
              color: #2a2a2a;
              font-weight: 600;
            }
          `,
        }}
      />
    </details>
  );
}
