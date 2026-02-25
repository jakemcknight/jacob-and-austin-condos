"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
} from "recharts";

// Color palette matches existing site design (MarketChart.tsx)
const COLORS = {
  primary: "#324A32", // Zilker green
  secondary: "#886752", // Barton Creek brown
  accent: "#93B9BC", // Denim
  dark: "#191919",
  light: "#E1DDD1", // Moontower
};

function formatPrice(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

interface ChartProps {
  type: "price-trend" | "inventory-velocity" | "building-comparison" | "bedroom-breakdown";
  data: Record<string, unknown>[];
}

function PriceTrendChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E1DDD1" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#666" }}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          tickFormatter={formatPrice}
          tick={{ fontSize: 11, fill: "#666" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#666" }}
        />
        <Tooltip
          formatter={((value: number, name: string) => {
            if (name === "medianPriceSf") return [`$${Math.round(value)}/SF`, "Median $/SF"];
            if (name === "medianPrice") return [formatPrice(value), "Median Price"];
            if (name === "closedCount") return [value, "Closed Sales"];
            return [value, name];
          }) as never}
        />
        <Legend
          formatter={(value: string) => {
            if (value === "medianPriceSf") return "Median $/SF";
            if (value === "closedCount") return "Closed Sales";
            return value;
          }}
        />
        <Bar
          yAxisId="right"
          dataKey="closedCount"
          fill={COLORS.light}
          radius={[2, 2, 0, 0]}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="medianPriceSf"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: COLORS.primary }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function InventoryVelocityChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E1DDD1" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#666" }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: "#666" }} />
        <Tooltip />
        <Legend
          formatter={(value: string) => {
            if (value === "closedCount") return "Closed Sales";
            if (value === "pendingCount") return "Pending";
            if (value === "activeCount") return "Active Listings";
            return value;
          }}
        />
        <Bar dataKey="closedCount" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
        <Bar dataKey="pendingCount" fill={COLORS.accent} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BuildingComparisonChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 10, bottom: 0, left: 120 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E1DDD1" />
        <XAxis
          type="number"
          tickFormatter={formatPrice}
          tick={{ fontSize: 11, fill: "#666" }}
        />
        <YAxis
          type="category"
          dataKey="building"
          tick={{ fontSize: 11, fill: "#666" }}
          width={110}
        />
        <Tooltip
          formatter={((value: number, name: string) => {
            if (name === "medianPriceSf") return [`$${Math.round(value)}/SF`, "Median $/SF"];
            if (name === "closedCount") return [value, "Closed Sales"];
            return [value, name];
          }) as never}
        />
        <Legend
          formatter={(value: string) => {
            if (value === "medianPriceSf") return "Median $/SF";
            return value;
          }}
        />
        <Bar dataKey="medianPriceSf" fill={COLORS.primary} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BedroomBreakdownChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E1DDD1" />
        <XAxis dataKey="bedrooms" tick={{ fontSize: 11, fill: "#666" }} />
        <YAxis tick={{ fontSize: 11, fill: "#666" }} />
        <Tooltip
          formatter={((value: number, name: string) => {
            if (name === "closedCount") return [value, "Closed Sales"];
            if (name === "medianPriceSf") return [`$${Math.round(value)}/SF`, "Median $/SF"];
            return [value, name];
          }) as never}
        />
        <Legend
          formatter={(value: string) => {
            if (value === "closedCount") return "Closed Sales";
            if (value === "medianPriceSf") return "Median $/SF";
            return value;
          }}
        />
        <Bar dataKey="closedCount" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
        <Bar dataKey="medianPriceSf" fill={COLORS.accent} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function MarketReportChart({ type, data }: ChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="my-8 rounded-lg border border-gray-100 bg-gray-50 p-4">
      {type === "price-trend" && <PriceTrendChart data={data} />}
      {type === "inventory-velocity" && <InventoryVelocityChart data={data} />}
      {type === "building-comparison" && <BuildingComparisonChart data={data} />}
      {type === "bedroom-breakdown" && <BedroomBreakdownChart data={data} />}
    </div>
  );
}
