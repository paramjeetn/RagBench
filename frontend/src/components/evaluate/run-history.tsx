"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { EvalRunResponse } from "@/lib/types";
import { runLabel, formatScore } from "@/lib/utils";

interface RunHistoryProps {
  runs: EvalRunResponse[];
  onViewRun: (run: EvalRunResponse) => void;
}

export function RunHistory({ runs, onViewRun }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No evaluation runs yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead>Dataset</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Pass Rate</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const avgScore =
            run.metrics && Object.keys(run.metrics).length > 0
              ? Object.values(run.metrics).reduce((a, b) => a + b, 0) /
                Object.values(run.metrics).length
              : null;

          return (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{runLabel(run)}</TableCell>
              <TableCell>{run.dataset_name ?? run.dataset_id}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    run.status === "completed"
                      ? "default"
                      : run.status === "running"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell>
                {avgScore != null ? formatScore(avgScore) : "-"}
              </TableCell>
              <TableCell>
                {run.question_count
                  ? `${run.pass_count ?? 0}/${run.question_count}`
                  : "-"}
              </TableCell>
              <TableCell>
                {new Date(run.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewRun(run)}
                  disabled={run.status !== "completed"}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
