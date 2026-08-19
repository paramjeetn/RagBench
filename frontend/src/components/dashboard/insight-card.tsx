"use client";

import { motion } from "motion/react";
import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  insight: string;
  index?: number;
}

export function InsightCard({ insight, index = 0 }: InsightCardProps) {
  const colors = ["#E63946", "#F4C542", "#2563EB"];
  const color = colors[index % 3];
  const isYellow = color === "#F4C542";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 6 }}
      className="relative flex items-start gap-4 overflow-hidden p-4"
      style={{
        background: color,
        border: "3px solid oklch(0.10 0.01 240)",
        boxShadow: "4px 4px 0 oklch(0.10 0.01 240)",
        borderRadius: 0,
      }}
    >
      {/* Geometric decoration */}
      <div
        className="absolute top-0 right-0 h-10 w-10 opacity-20"
        style={{
          background: isYellow ? "oklch(0.10 0.01 240)" : "white",
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
        }}
      />

      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center"
        style={{
          background: isYellow ? "oklch(0.10 0.01 240)" : "white",
          borderRadius: "50%",
        }}
      >
        <Lightbulb
          className="h-4 w-4"
          style={{ color: isYellow ? "white" : color }}
        />
      </div>
      <p
        className="text-sm font-bold leading-relaxed"
        style={{ color: isYellow ? "oklch(0.10 0.01 240)" : "white" }}
      >
        {insight}
      </p>
    </motion.div>
  );
}