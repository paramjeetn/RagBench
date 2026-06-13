import { formatScore, formatDelta } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  name: string;
  value: number;
  delta: number;
}

function scoreColor(value: number) {
  if (value >= 0.85) return "text-emerald-600";
  if (value >= 0.70) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(value: number) {
  if (value >= 0.85) return "bg-emerald-50 border-emerald-100";
  if (value >= 0.70) return "bg-amber-50 border-amber-100";
  return "bg-red-50 border-red-100";
}

export function MetricCard({ name, value, delta }: MetricCardProps) {
  const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div className={cn("rounded-lg border border-border/50 p-5 transition-all duration-200 hover:shadow-md", scoreBg(value))}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-3 text-4xl font-bold tabular-nums", scoreColor(value))}>
        {formatScore(value)}
      </p>
      <div
        className={cn(
          "mt-3 flex items-center gap-1.5 text-xs font-medium",
          delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-muted-foreground"
        )}
      >
        <TrendIcon className="h-3.5 w-3.5" />
        <span>{formatDelta(delta)} vs prev</span>
      </div>
    </div>
  );
}
