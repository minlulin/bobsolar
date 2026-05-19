"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from "lucide-react";
import { useState } from "react";
import type { RecoveryReport } from "@/actions/recovery-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RecoveryClientProps {
  initialReport: RecoveryReport | null;
}

export function RecoveryClient({ initialReport }: RecoveryClientProps): React.JSX.Element {
  const [report, setReport] = useState<RecoveryReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const { getRecoveryReport } = await import("@/actions/recovery-actions");
      const result = await getRecoveryReport();
      if (result.success) {
        setReport(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepairPayment = async (paymentId: string) => {
    setRepairing(paymentId);
    try {
      const { repairOrphanPayment } = await import("@/actions/recovery-actions");
      const result = await repairOrphanPayment(paymentId);
      if (result.success) {
        await handleRefresh();
      }
    } finally {
      setRepairing(null);
    }
  };

  const handleRepairCost = async (costId: string) => {
    setRepairing(costId);
    try {
      const { repairOrphanCost } = await import("@/actions/recovery-actions");
      const result = await repairOrphanCost(costId);
      if (result.success) {
        await handleRefresh();
      }
    } finally {
      setRepairing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Recovery Playbook
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Detect and repair orphaned records missing journal entries.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-deep-navy)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-deep-navy)]/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className={`border-border ${report && report.totalOrphanPayments > 0 ? "border-rose-200 bg-rose-50/30" : ""}`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Orphan Payments</p>
                <p
                  className={`text-2xl font-bold tabular-nums ${report && report.totalOrphanPayments > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {report?.totalOrphanPayments ?? 0}
                </p>
              </div>
              <div
                className={`rounded-lg p-2 ${report && report.totalOrphanPayments > 0 ? "bg-rose-100" : "bg-emerald-50"}`}
              >
                <AlertTriangle
                  className={`h-4 w-4 ${report && report.totalOrphanPayments > 0 ? "text-rose-600" : "text-emerald-600"}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border ${report && report.totalOrphanCosts > 0 ? "border-rose-200 bg-rose-50/30" : ""}`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Orphan Costs</p>
                <p
                  className={`text-2xl font-bold tabular-nums ${report && report.totalOrphanCosts > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {report?.totalOrphanCosts ?? 0}
                </p>
              </div>
              <div
                className={`rounded-lg p-2 ${report && report.totalOrphanCosts > 0 ? "bg-rose-100" : "bg-emerald-50"}`}
              >
                <AlertTriangle
                  className={`h-4 w-4 ${report && report.totalOrphanCosts > 0 ? "text-rose-600" : "text-emerald-600"}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orphan Payments Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wrench className="text-muted-foreground h-4 w-4" />
            Orphan Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-10 w-full" />
              ))}
            </div>
          ) : report && report.orphanPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Payment ID</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Project</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orphanPayments.map((payment) => (
                    <tr key={payment.paymentId} className="border-border border-b last:border-0">
                      <td className="py-2.5 font-mono text-xs text-foreground">
                        {payment.paymentId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 text-foreground">{payment.projectId.slice(0, 8)}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium">
                        {payment.amount.toLocaleString()} MMK
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRepairPayment(payment.paymentId)}
                          disabled={repairing === payment.paymentId}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {repairing === payment.paymentId ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          Repair
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="text-emerald-500 mb-2 h-8 w-8" />
              <p className="text-foreground text-sm font-medium">
                All payments have journal entries
              </p>
              <p className="text-muted-foreground text-xs">No orphan records detected.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orphan Costs Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Wrench className="text-muted-foreground h-4 w-4" />
            Orphan Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map(() => (
                <Skeleton key={crypto.randomUUID()} className="h-10 w-full" />
              ))}
            </div>
          ) : report && report.orphanCosts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Cost ID</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Project</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Type</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orphanCosts.map((cost) => (
                    <tr key={cost.costId} className="border-border border-b last:border-0">
                      <td className="py-2.5 font-mono text-xs text-foreground">
                        {cost.costId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 text-foreground">{cost.projectId.slice(0, 8)}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium">
                        {cost.amount.toLocaleString()} MMK
                      </td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">
                          {cost.costType}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRepairCost(cost.costId)}
                          disabled={repairing === cost.costId}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {repairing === cost.costId ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          Repair
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="text-emerald-500 mb-2 h-8 w-8" />
              <p className="text-foreground text-sm font-medium">All costs have journal entries</p>
              <p className="text-muted-foreground text-xs">No orphan records detected.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
