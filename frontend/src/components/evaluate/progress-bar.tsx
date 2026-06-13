interface ProgressBarProps {
  completed: number;
  total: number;
}

export function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>Evaluating…</span>
        <span>
          {completed}/{total} questions
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/60 border border-border/50 shadow-sm">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 shadow-sm"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
