import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  insight: string;
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
        <p className="text-sm">{insight}</p>
      </CardContent>
    </Card>
  );
}
