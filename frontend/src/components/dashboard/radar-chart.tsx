"use client";

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarChartProps {
  metricsA: Record<string, number>;
  metricsB: Record<string, number>;
  labelA: string;
  labelB: string;
}

export function RadarChart({ metricsA, metricsB, labelA, labelB }: RadarChartProps) {
  const allKeys = new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]);
  const data = Array.from(allKeys).map((key) => ({
    metric: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    [labelA]: metricsA[key] ?? 0,
    [labelB]: metricsB[key] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsRadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fontSize: 10 }} />
        <Radar
          name={labelA}
          dataKey={labelA}
          stroke="hsl(221, 83%, 53%)"
          fill="hsl(221, 83%, 53%)"
          fillOpacity={0.15}
        />
        <Radar
          name={labelB}
          dataKey={labelB}
          stroke="hsl(142, 71%, 45%)"
          fill="hsl(142, 71%, 45%)"
          fillOpacity={0.15}
        />
        <Tooltip formatter={(v) => (Number(v) * 100).toFixed(1) + "%"} />
        <Legend />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
