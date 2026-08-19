"use client";
import { motion } from "motion/react";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RadarChartProps {
  metricsA: Record<string, number>;
  metricsB: Record<string, number>;
  labelA: string;
  labelB: string;
}

export function RadarChart({ metricsA, metricsB, labelA, labelB }: RadarChartProps) {
  const keys = Array.from(new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]));
  const data = keys.map((key) => ({
    metric: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    A: Math.round((metricsA[key] ?? 0) * 100),
    B: Math.round((metricsB[key] ?? 0) * 100),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="h-[320px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="oklch(0.10 0.01 240)" strokeWidth={1.5} strokeDasharray="0" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fontWeight: 900, fill: "oklch(0.10 0.01 240)", letterSpacing: "0.05em" }}
          />
          <Radar
            name={labelA}
            dataKey="A"
            stroke="#E63946"
            fill="#E63946"
            fillOpacity={0.25}
            strokeWidth={3}
          />
          <Radar
            name={labelB}
            dataKey="B"
            stroke="#2563EB"
            fill="#2563EB"
            fillOpacity={0.20}
            strokeWidth={3}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}