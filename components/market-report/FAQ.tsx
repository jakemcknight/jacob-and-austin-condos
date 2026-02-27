"use client";

interface FAQItem {
  question: string;
  answer: string;
}

function parseData(data: string | FAQItem[]): FAQItem[] {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return data;
}

export default function FAQ({ data }: { data: string | FAQItem[] }) {
  const items = parseData(data);
  if (items.length === 0) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div style={{ marginBottom: 44 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
        Frequently Asked Questions
      </h2>

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "16px 0",
            borderBottom: i < items.length - 1 ? "1px solid #e2e0da" : "none",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 6,
              color: "#1a1a1a",
            }}
          >
            {item.question}
          </div>
          <div style={{ fontSize: 15, color: "#2a2a2a" }}>{item.answer}</div>
        </div>
      ))}
    </div>
  );
}
