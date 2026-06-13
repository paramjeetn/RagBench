import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  insight: string;
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p className="text-sm text-foreground/80">{insight}</p>
    </div>
  );
}
