import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, TrendingUp, AlertTriangle, RefreshCcw, DollarSign, PieChart } from "lucide-react";

const reports = [
  {
    title: "Recovery Report & Repair",
    description: "Detect and repair orphaned financial data, fix broken accounting links, and recover from data inconsistencies.",
    icon: RefreshCcw,
    href: "/finance/reports/recovery",
    color: "text-orange-500",
    bgColor: "bg-orange-50"
  },
  {
    title: "Profit & Loss Report",
    description: "View your business profitability with detailed income and expense breakdowns over specific periods.",
    icon: TrendingUp,
    href: "/finance/reports/profit-loss",
    color: "text-green-500",
    bgColor: "bg-green-50"
  },
  {
    title: "Receivable Aging",
    description: "Track outstanding customer invoices and identify overdue payments with aging analysis.",
    icon: FileText,
    href: "/finance/reports/receivable-aging",
    color: "text-blue-500",
    bgColor: "bg-blue-50"
  },
  {
    title: "Cash Movement",
    description: "Monitor cash flow movements across all accounts with detailed transaction tracking.",
    icon: DollarSign,
    href: "/finance/reports/cash-movement",
    color: "text-emerald-500",
    bgColor: "bg-emerald-50"
  },
  {
    title: "Month End Close",
    description: "Complete month-end closing procedures with comprehensive financial reconciliation.",
    icon: PieChart,
    href: "/finance/reports/month-end-close",
    color: "text-purple-500",
    bgColor: "bg-purple-50"
  },
  {
    title: "Monitoring Dashboard",
    description: "Real-time monitoring of key financial metrics and system health indicators.",
    icon: AlertTriangle,
    href: "/finance/reports/monitoring",
    color: "text-red-500",
    bgColor: "bg-red-50"
  }
];

export default function ReportsLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground mt-2">
          Access comprehensive financial reporting tools to analyze your business performance and maintain data integrity.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.href} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${report.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 ${report.color}`} />
                </div>
                <CardTitle>{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">{report.description}</CardDescription>
                <Button asChild className="w-full">
                  <Link href={report.href}>Open Report</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
