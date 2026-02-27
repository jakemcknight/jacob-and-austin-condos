"use client";

import React from "react";

export default function MarketReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <article
      className="market-report"
      style={{
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
        background: "#fafaf7",
        color: "#1a1a1a",
        lineHeight: 1.65,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        {children}
      </div>
    </article>
  );
}
