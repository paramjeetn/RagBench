import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScore, formatDelta } from "@/lib/utils";

interface MetricCardProps {
  name: string;
  value: number;
  delta: number;
}

export function MetricCard({ name, value, delta }: MetricCardProps) {
  const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatScore(value)}</div>
        <p
          className={`text-xs font-medium ${
            delta > 0
              ? "text-green-600"
              : delta < 0
              ? "text-red-600"
              : "text-muted-foreground"
          }`}
        >
          {formatDelta(delta)} from previous
        </p>
      </CardContent>
    </Card>
  );
}
