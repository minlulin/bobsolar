"use client";

import { BarChart3, Download, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type {
  ProjectProfitabilityReport,
  ProjectProfitabilityRow,
} from "@/actions/project-profitability-actions";
import { BackButton } from "@/components/shared/back-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMMK } from "@/lib/utils";

interface ProjectProfitabilityClientProps {
  initialReport: ProjectProfitabilityReport | null;
}

export function ProjectProfitabilityClient({
  initialReport,
}: ProjectProfitabilityClientProps): React.JSX.Element {
  const [report, setReport] = useState<ProjectProfitabilityReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = async () => {
    setIsLoading(true);
    try {
      const { getProjectProfitabilityReport } = await import(
        "@/actions/project-profitability-actions"
      );
      const result = await getProjectProfitabilityReport({});
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
      ["Project Profitability Report", ""],
      [],
      ["Summary", ""],
      ["Total Revenue", report.summary.totalRevenue.toString()],
      ["Total COGS", report.summary.totalCogs.toString()],
      ["Total Expenses", report.summary.totalExpenses.toString()],
      ["Total Net Profit", report.summary.totalNetProfit.toString()],
      ["Average Margin", `${report.summary.averageMargin}%`],
      ["Project Count", report.summary.projectCount.toString()],
      [],
      ["Project Details", ""],
      [
        "Project",
        "Customer",
        "Status",
        "Quoted",
        "Revenue",
        "COGS",
        "Expenses",
        "Gross Profit",
        "Net Profit",
        "Gross %",
        "Net %",
        "Paid",
        "Outstanding",
      ],
      ...report.projects.map((p) => [
        p.projectNumber,
        p.customerName,
        p.status,
        p.quotedTotal.toString(),
        p.totalRevenue.toString(),
        p.totalCogs.toString(),
        p.totalExpenses.toString(),
        p.grossProfit.toString(),
        p.netProfit.toString(),
        `${p.grossMargin}%`,
        `${p.netMargin}%`,
        p.paidAmount.toString(),
        p.outstanding.toString(),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-profitability.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Project Profitability
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Per-project revenue, costs, and margin analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFetch}
            disabled={isLoading}
            className="solar-cta inline-flex items-center gap-2 disabled:opacity-50"
          >
            <BarChart3 className="h-4 w-4" />
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryStat
          label="Total Revenue"
          value={formatMMK(report?.summary.totalRevenue ?? 0)}
          isLoading={isLoading}
        />
        <SummaryStat
          label="Total COGS"
          value={formatMMK(report?.summary.totalCogs ?? 0)}
          isLoading={isLoading}
        />
        <SummaryStat
          label="Total Expenses"
          value={formatMMK(report?.summary.totalExpenses ?? 0)}
          isLoading={isLoading}
        />
        <SummaryStat
          label="Net Profit"
          value={formatMMK(report?.summary.totalNetProfit ?? 0)}
          isLoading={isLoading}
          color={(report?.summary.totalNetProfit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <SummaryStat
          label="Avg Margin"
          value={`${report?.summary.averageMargin ?? 0}%`}
          isLoading={isLoading}
          color={(report?.summary.averageMargin ?? 0) >= 10 ? "text-emerald-600" : "text-amber-600"}
        />
        <SummaryStat
          label="Projects"
          value={`${report?.summary.projectCount ?? 0}`}
          isLoading={isLoading}
        />
      </div>

      {/* Project Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="text-muted-foreground h-4 w-4" />
            Project Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : report && report.projects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Project</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Customer</th>
                    <th className="pb-2 text-right font-medium text-foreground">Revenue</th>
                    <th className="pb-2 text-right font-medium text-foreground">COGS</th>
                    <th className="pb-2 text-right font-medium text-foreground">Expenses</th>
                    <th className="pb-2 text-right font-medium text-foreground">Net Profit</th>
                    <th className="pb-2 text-right font-medium text-emerald-700">Margin</th>
                    <th className="pb-2 text-right font-medium text-foreground">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {report.projects.map((project) => (
                    <ProjectRow key={project.projectId} project={project} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No projects found. Create projects with journal entries to see profitability data.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectRow({ project }: { project: ProjectProfitabilityRow }): React.JSX.Element {
  const isProfit = project.netProfit >= 0;

  return (
    <tr className="border-border border-b last:border-0">
      <td className="py-2.5 font-medium text-foreground">{project.projectNumber}</td>
      <td className="py-2.5 text-foreground">
        {project.customerName}
        <Badge variant="outline" className="ml-2 text-[10px]">
          {project.status}
        </Badge>
      </td>
      <td className="py-2.5 text-right tabular-nums">{formatMMK(project.totalRevenue)}</td>
      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
        {formatMMK(project.totalCogs)}
      </td>
      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
        {formatMMK(project.totalExpenses)}
      </td>
      <td
        className={`py-2.5 text-right font-semibold tabular-nums ${isProfit ? "text-emerald-600" : "text-rose-600"}`}
      >
        {isProfit ? "+" : ""}
        {formatMMK(project.netProfit)}
      </td>
      <td className="py-2.5 text-right tabular-nums">
        <span
          className={`inline-flex items-center gap-1 ${project.netMargin >= 10 ? "text-emerald-600" : project.netMargin >= 0 ? "text-amber-600" : "text-rose-600"}`}
        >
          {project.netMargin >= 10 ? (
            <TrendingUp className="h-3 w-3" />
          ) : project.netMargin < 0 ? (
            <TrendingDown className="h-3 w-3" />
          ) : null}
          {project.netMargin}%
        </span>
      </td>
      <td className="py-2.5 text-right tabular-nums">
        {project.outstanding > 0 ? (
          <span className="text-rose-600">{formatMMK(project.outstanding)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  );
}

function SummaryStat({
  label,
  value,
  isLoading,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  isLoading: boolean;
  color?: string;
}): React.JSX.Element {
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
            <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
