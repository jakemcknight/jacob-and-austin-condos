"use client";

import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
  ComposedChart,
  Line,
} from "recharts";

// Brand colors from tailwind.config.ts
const BRAND = {
  zilker: "#324A32", // primary chart line
  denim: "#93B9BC", // secondary chart line (prior year)
  midnight: "#191919", // tooltip bg
  moontower: "#E1DDD1", // grid/borders
  whiskey: "#886752", // axis text
} as const;

interface RollingData {
  months: string[];
  current: number[];
  prior: number[];
  transactions?: number[];
  priorTransactions?: number[];
}

function parseData(data: string | RollingData): RollingData | null {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
}

export default function RollingPsfChart({
  data,
  caption,
}: {
  data: string | RollingData;
  caption?: string;
}) {
  const parsed = parseData(data);
  if (!parsed || parsed.months.length === 0) return null;

  const hasTransactions = parsed.transactions && parsed.transactions.length > 0;
  const hasPriorTransactions = parsed.priorTransactions && parsed.priorTransactions.length > 0;
  const hasAnyBars = hasTransactions || hasPriorTransactions;

  const chartData = parsed.months.map((month, i) => ({
    month,
    current: parsed.current[i],
    prior: parsed.prior[i],
    ...(hasTransactions && { transactions: parsed.transactions![i] }),
    ...(hasPriorTransactions && { priorTransactions: parsed.priorTransactions![i] }),
  }));

  // Auto-scale left Y axis ($/SF): find min/max across both datasets, add padding
  const allValues = [...parsed.current, ...parsed.prior].filter((v) => v > 0);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = Math.max(Math.round((maxVal - minVal) * 0.15), 10);
  const yMin = Math.floor((minVal - padding) / 10) * 10;
  const yMax = Math.ceil((maxVal + padding) / 10) * 10;

  return (
    <div style={{ marginBottom: 44 }}>
      <h2
        style={{
          fontFamily: "var(--font-playfair), 'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 600,
          marginBottom: 20,
          paddingBottom: 10,
          borderBottom: `1px solid ${BRAND.moontower}`,
        }}
      >
        Downtown Austin — Rolling 12-Month Median $/SF
      </h2>
      <div
        style={{
          background: "white",
          border: `1px solid ${BRAND.moontower}`,
          borderRadius: 8,
          padding: "24px 20px 16px",
        }}
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: hasAnyBars ? 10 : 10, left: 15, bottom: 5 }}>
            <CartesianGrid stroke={BRAND.moontower} strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: BRAND.whiskey, fillOpacity: 0.7, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              axisLine={{ stroke: BRAND.moontower }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              domain={[yMin, yMax]}
              tick={{ fontSize: 12, fill: BRAND.whiskey, fillOpacity: 0.7, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
              label={{
                value: "$/SF",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                style: { fontSize: 11, fill: BRAND.whiskey, fillOpacity: 0.5, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" },
              }}
            />
            {hasAnyBars && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: BRAND.whiskey, fillOpacity: 0.4, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={50}
                label={{
                  value: "Transactions",
                  angle: 90,
                  position: "insideRight",
                  offset: 0,
                  style: { fontSize: 11, fill: BRAND.whiskey, fillOpacity: 0.5, fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" },
                }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: BRAND.midnight,
                border: "none",
                borderRadius: 6,
                color: "white",
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                fontSize: 13,
                padding: 12,
              }}
              itemStyle={{ color: "white" }}
              labelStyle={{ color: "white", marginBottom: 4 }}
              formatter={(value: number, name: string) => {
                if (name === "transactions") return [String(value), "12-Mo Rolling Sales"];
                if (name === "priorTransactions") return [String(value), "Prior Year 12-Mo Sales"];
                return [
                  `$${value}/sf`,
                  name === "current" ? "Current 12-Mo Rolling" : "Prior Year 12-Mo Rolling",
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                paddingTop: 16,
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                fontSize: 12,
              }}
              formatter={(value: string) => {
                if (value === "transactions") return "12-Mo Rolling Sales";
                if (value === "priorTransactions") return "Prior Year 12-Mo Sales";
                return value === "current" ? "Current 12-Mo Rolling" : "Prior Year 12-Mo Rolling";
              }}
            />
            {/* Prior year transaction bars (lighter, behind current) */}
            {hasPriorTransactions && (
              <Bar
                yAxisId="right"
                dataKey="priorTransactions"
                fill={BRAND.denim}
                fillOpacity={0.15}
                stroke={BRAND.denim}
                strokeOpacity={0.35}
                radius={[2, 2, 0, 0]}
                barSize={16}
              />
            )}
            {/* Current year transaction bars */}
            {hasTransactions && (
              <Bar
                yAxisId="right"
                dataKey="transactions"
                fill={BRAND.moontower}
                fillOpacity={0.45}
                radius={[2, 2, 0, 0]}
                barSize={16}
              />
            )}
            {/* Prior year: dashed line with dots */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="prior"
              stroke={BRAND.denim}
              strokeWidth={1.5}
              strokeOpacity={0.6}
              strokeDasharray="5 4"
              dot={{ r: 2.5, fill: BRAND.denim, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: BRAND.denim, strokeWidth: 0 }}
            />
            {/* Current year: solid line with dots */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="current"
              stroke={BRAND.zilker}
              strokeWidth={2.5}
              dot={{ r: 3, fill: BRAND.zilker, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: BRAND.zilker, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {caption && (
        <div
          style={{
            fontSize: 13,
            color: BRAND.whiskey,
            marginTop: 12,
            fontStyle: "italic",
            opacity: 0.8,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
