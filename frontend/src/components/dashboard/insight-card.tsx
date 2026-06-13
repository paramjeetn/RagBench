import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  insight: string;
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200/50 bg-amber-50/40 px-4 py-3 shadow-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 flex-none text-amber-600" />
      <p className="text-sm leading-relaxed text-foreground/75">{insight}</p>
    </div>
  );
}
