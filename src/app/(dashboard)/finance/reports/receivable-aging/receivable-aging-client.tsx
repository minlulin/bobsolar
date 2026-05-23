"use client";

import { AlertTriangle, Calendar, Download } from "lucide-react";
import { useState } from "react";
import type { ReceivableAgingReport } from "@/actions/receivable-aging-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMMK } from "@/lib/utils";

interface ReceivableAgingReportClientProps {
  initialReport: ReceivableAgingReport | null;
}

export function ReceivableAgingReportClient({
  initialReport,
}: ReceivableAgingReportClientProps): React.JSX.Element {
  const [report, setReport] = useState<ReceivableAgingReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const { getReceivableAgingReport } = await import("@/actions/receivable-aging-actions");
      const result = await getReceivableAgingReport();
      if (result.success) {
        setReport(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;

    const rows = [
      ["Receivable Aging Report", ""],
      [`As of: ${report.asOfDate}`, ""],
      [],
      ["Summary", ""],
      ["Total Outstanding", report.summary.totalOutstanding.toString()],
      ["Current (0-30 days)", report.summary.current.toString()],
      ["31-60 days", report.summary.days31to60.toString()],
      ["61-90 days", report.summary.days61to90.toString()],
      ["91-120 days", report.summary.days91to120.toString()],
      ["120+ days", report.summary.days120Plus.toString()],
      [],
      ["Project Details", ""],
      [
        "Project",
        "Customer",
        "Outstanding",
        "Current",
        "31-60",
        "61-90",
        "91-120",
        "120+",
        "Completion Date",
      ],
      ...report.buckets.map((b) => [
        b.projectNumber,
        b.customerName,
        b.outstanding.toString(),
        b.current.toString(),
        b.days31to60.toString(),
        b.days61to90.toString(),
        b.days91to120.toString(),
        b.days120Plus.toString(),
        b.completionDate ?? "N/A",
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receivable-aging-${report.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Receivable Aging Report
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Outstanding receivables bucketed by days overdue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-deep-navy)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-deep-navy)]/90 disabled:opacity-50"
          >
            <Calendar className="h-4 w-4" />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!report}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <AgingMetric
          label="Current (0-30d)"
          value={report?.summary.current ?? 0}
          color="text-emerald-600"
          isLoading={isLoading}
        />
        <AgingMetric
          label="31-60 days"
          value={report?.summary.days31to60 ?? 0}
          color="text-amber-600"
          isLoading={isLoading}
        />
        <AgingMetric
          label="61-90 days"
          value={report?.summary.days61to90 ?? 0}
          color="text-orange-600"
          isLoading={isLoading}
        />
        <AgingMetric
          label="91-120 days"
          value={report?.summary.days91to120 ?? 0}
          color="text-rose-600"
          isLoading={isLoading}
        />
        <AgingMetric
          label="120+ days"
          value={report?.summary.days120Plus ?? 0}
          color="text-red-700"
          isLoading={isLoading}
        />
      </div>

      {/* Total Outstanding */}
      <Card className="border-border bg-slate-50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Outstanding</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatMMK(report?.summary.totalOutstanding ?? 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-sm">
                {report?.summary.projectCount ?? 0} projects
              </p>
              <p className="text-muted-foreground text-xs">as of {report?.asOfDate ?? "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aging Buckets Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="text-amber-500 h-4 w-4" />
            Project Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-8 w-full" />
              ))}
            </div>
          ) : report && report.buckets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Project</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="pb-2 text-right font-medium text-foreground">Outstanding</th>
                    <th className="pb-2 text-right font-medium text-emerald-700">Current</th>
                    <th className="pb-2 text-right font-medium text-amber-700">31-60</th>
                    <th className="pb-2 text-right font-medium text-orange-700">61-90</th>
                    <th className="pb-2 text-right font-medium text-rose-700">91-120</th>
                    <th className="pb-2 text-right font-medium text-red-700">120+</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {report.buckets.map((bucket) => (
                    <tr key={bucket.projectId} className="border-border border-b last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{bucket.projectNumber}</td>
                      <td className="py-2.5 text-foreground">{bucket.customerName}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">
                        {formatMMK(bucket.outstanding)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-emerald-700">
                        {bucket.current > 0 ? formatMMK(bucket.current) : "-"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-amber-700">
                        {bucket.days31to60 > 0 ? formatMMK(bucket.days31to60) : "-"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-orange-700">
                        {bucket.days61to90 > 0 ? formatMMK(bucket.days61to90) : "-"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-rose-700">
                        {bucket.days91to120 > 0 ? formatMMK(bucket.days91to120) : "-"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-red-700">
                        {bucket.days120Plus > 0 ? formatMMK(bucket.days120Plus) : "-"}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {bucket.completionDate ? (
                          <Badge variant="outline" className="text-xs">
                            {bucket.completionDate}
                          </Badge>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No outstanding receivables found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AgingMetricProps {
  label: string;
  value: number;
  color: string;
  isLoading: boolean;
}

function AgingMetric({ label, value, color, isLoading }: AgingMetricProps): React.JSX.Element {
  return (
    <Card className="border-border transition-shadow hover:shadow-sm">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={`text-base font-bold tabular-nums ${color}`}>{formatMMK(value)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
