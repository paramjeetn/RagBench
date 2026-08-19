"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { formatDelta } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  name: string;
  value: number;
  delta: number;
}

function useCountUp(target: number, duration = 1000) {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    startTime.current = null;
    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const elapsed = ts - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(eased * target);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return current;
}

// Rotating color scheme per card (Bauhaus 3 colors cycling)
const BAUHAUS_SCHEMES = [
  { accent: "#E63946", bg: "#E63946", label: "white" },
  { accent: "#F4C542", bg: "#F4C542", label: "black" },
  { accent: "#2563EB", bg: "#2563EB", label: "white" },
  { accent: "#E63946", bg: "#E63946", label: "white" },
];

let cardIndex = 0;
const getScheme = () => BAUHAUS_SCHEMES[cardIndex++ % BAUHAUS_SCHEMES.length];

export function MetricCard({ name, value, delta }: MetricCardProps) {
  const scheme = useRef(getScheme()).current;
  const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const animated = useCountUp(value);
  const displayPct = Math.round(animated * 100);

  const isLight = scheme.label === "black";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, rotate: 1, scale: 1.03 }}
      className="relative overflow-hidden"
      style={{
        background: scheme.bg,
        border: "3px solid oklch(0.10 0.01 240)",
        boxShadow: "6px 6px 0 oklch(0.10 0.01 240)",
        borderRadius: 0,
      }}
    >
      {/* Bauhaus geometric decoration — circle in top-right */}
      <div
        className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-20"
        style={{ background: isLight ? "oklch(0.10 0.01 240)" : "white" }}
      />
      {/* Bottom-left square decoration */}
      <div
        className="absolute bottom-2 right-2 h-4 w-4 opacity-30"
        style={{ background: isLight ? "oklch(0.10 0.01 240)" : "white" }}
      />

      <div className="relative p-5">
        {/* Label */}
        <p
          className="text-xs font-black uppercase tracking-[0.15em] leading-none"
          style={{ color: isLight ? "oklch(0.10 0.01 240)" : "rgba(255,255,255,0.8)" }}
        >
          {label}
        </p>

        {/* Animated number */}
        <div
          className="mt-3 font-black leading-none tabular-nums"
          style={{ color: isLight ? "oklch(0.10 0.01 240)" : "white" }}
        >
          <span className="text-5xl">{displayPct}</span>
          <span className="text-2xl ml-0.5 opacity-60">%</span>
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 h-1.5 w-full overflow-hidden"
          style={{ background: isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.25)" }}
        >
          <motion.div
            className="h-full"
            style={{ background: isLight ? "oklch(0.10 0.01 240)" : "white" }}
            initial={{ width: 0 }}
            animate={{ width: `${value * 100}%` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>

        {/* Delta badge */}
        <div
          className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-black uppercase tracking-wider"
          style={{
            background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.2)",
            color: isLight ? "oklch(0.10 0.01 240)" : "white",
            border: `2px solid ${isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)"}`,
          }}
        >
          <TrendIcon className="h-3 w-3" />
          <span>{formatDelta(delta)}</span>
        </div>
      </div>
    </motion.div>
  );
}