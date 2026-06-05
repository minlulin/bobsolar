"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, DollarSign } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { type CashFlowStatement, getCashFlowStatement } from "@/actions/cash-flow-actions";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type CashFlowFilter, reportKeys } from "@/lib/query-keys";
import { formatMMK } from "@/lib/utils";

interface CashFlowClientProps {
  initialData: CashFlowStatement | null;
}

export function CashFlowClient({ initialData }: CashFlowClientProps): React.JSX.Element {
  const [periodFilter, setPeriodFilter] = useState<CashFlowFilter>({});

  const { data, isLoading } = useQuery({
    queryKey: reportKeys.cashFlow(periodFilter),
    queryFn: async () => {
      const result = await getCashFlowStatement(periodFilter);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    initialData: initialData ?? undefined,
    staleTime: 30 * 1000,
  });

  const handlePeriodChange = useCallback((value: string) => {
    const now = new Date();
    let dateFrom: Date;

    switch (value) {
      case "30d":
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "90d":
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case "1y":
        dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
    }

    setPeriodFilter({
      dateFrom: format(dateFrom, "yyyy-MM-dd"),
      dateTo: format(now, "yyyy-MM-dd"),
    });
  }, []);

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Cash Flow Statement
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cash inflows and outflows classified by operating, investing, and financing activities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Reports
            </Link>
          </Button>
          <Select defaultValue="1y" onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <DollarSign className="text-muted-foreground/50 mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Unable to load cash flow data.</p>
        </div>
      ) : (
        <>
          {/* Net Cash Change Summary */}
          <Card className="border-border bg-slate-50">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-xs">Beginning Cash</p>
                  <p className="text-foreground text-lg font-bold tabular-nums">
                    {formatMMK(data.beginningCash)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Net Change</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      data.netCashChange >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {data.netCashChange >= 0 ? "+" : ""}
                    {formatMMK(data.netCashChange)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ending Cash</p>
                  <p className="text-foreground text-lg font-bold tabular-nums">
                    {formatMMK(data.endingCash)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Period</p>
                  <p className="text-foreground text-sm">
                    {format(new Date(data.dateFrom), "MMM d")} –{" "}
                    {format(new Date(data.dateTo), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Sections */}
          <div className="space-y-6">
            <CashFlowSection data={data.operating} />
            <CashFlowSection data={data.investing} />
            <CashFlowSection data={data.financing} />
          </div>

          {/* Summary */}
          <Card className="border-border">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Cash from Operating</span>
                  <span
                    className={`font-medium tabular-nums ${
                      data.netCashFromOperating >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatMMK(data.netCashFromOperating)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Cash from Investing</span>
                  <span
                    className={`font-medium tabular-nums ${
                      data.netCashFromInvesting >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatMMK(data.netCashFromInvesting)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Cash from Financing</span>
                  <span
                    className={`font-medium tabular-nums ${
                      data.netCashFromFinancing >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatMMK(data.netCashFromFinancing)}
                  </span>
                </div>
                <div className="border-border border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-bold">Net Change in Cash</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        data.netCashChange >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {data.netCashChange >= 0 ? "+" : ""}
                      {formatMMK(data.netCashChange)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function CashFlowSection({
  data,
}: {
  data: {
    label: string;
    lines: { label: string; inflows: number; outflows: number; net: number }[];
    totalInflows: number;
    totalOutflows: number;
    net: number;
  };
}): React.JSX.Element {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <span>{data.label}</span>
          <span
            className={`text-sm tabular-nums ${
              data.net >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {data.net >= 0 ? "+" : ""}
            {formatMMK(data.net)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.lines.length > 0 ? (
          <div className="space-y-2">
            {data.lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{line.label}</span>
                <div className="flex items-center gap-4">
                  {line.inflows > 0 && (
                    <span className="text-emerald-600 tabular-nums">
                      +{formatMMK(line.inflows)}
                    </span>
                  )}
                  {line.outflows > 0 && (
                    <span className="text-rose-600 tabular-nums">-{formatMMK(line.outflows)}</span>
                  )}
                  <span
                    className={`w-24 text-right font-medium tabular-nums ${
                      line.net >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {line.net >= 0 ? "+" : ""}
                    {formatMMK(line.net)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No activity in this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
