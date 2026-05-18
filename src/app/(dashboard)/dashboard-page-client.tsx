"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Plus, UserPlus, Wrench } from "lucide-react";
import { motion, type Variants } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { dashboardStatMeta } from "@/app/(dashboard)/dashboard-stat-meta";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDashboardPipeline,
  useDashboardStats,
  useRecentActivity,
  useUpcomingAlerts,
} from "@/hooks/use-dashboard";
import { cn, formatMMK } from "@/lib/utils";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const container = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
      duration: 0.2,
      ease: "easeOut",
    },
  },
} satisfies Variants;

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
} satisfies Variants;

const SunGauge = dynamic(() => import("@/components/dashboard/sun-gauge").then((m) => m.SunGauge), {
  ssr: false,
});
const EnergyFlow = dynamic(
  () => import("@/components/dashboard/energy-flow").then((m) => m.EnergyFlow),
  { ssr: false },
);
const ActivityStream = dynamic(
  () => import("@/components/dashboard/activity-stream").then((m) => m.ActivityStream),
  { ssr: false },
);
const FinanceSummary = dynamic(
  () => import("@/components/dashboard/finance-summary").then((m) => m.FinanceSummary),
  { ssr: false },
);

export default function DashboardPage(): React.JSX.Element {
  const statsQuery = useDashboardStats();
  const pipelineQuery = useDashboardPipeline();
  const activityQuery = useRecentActivity();
  const alertsQuery = useUpcomingAlerts();

  const stats = statsQuery.data;
  const pipeline = pipelineQuery.data?.stages ?? [];
  const activities = activityQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <motion.div
      className="grid grid-cols-1 gap-6 sm:grid-cols-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Hero Header — Full Width */}
      <motion.div
        variants={item}
        className="border-border bg-card col-span-12 flex flex-col justify-between gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center"
      >
        <div className="space-y-1">
          <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
            System Snapshot
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {getGreeting()}, <span className="text-primary">{stats?.userName ?? "User"}</span>.
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Your solar operations are running optimally. Here is your immersive command center
            overview for today.
          </p>
        </div>
        <div className="bg-secondary/50 border-border flex items-center gap-3 self-start rounded-full border px-4 py-2 text-xs font-medium sm:self-center">
          <div className="bg-accent h-2 w-2 animate-pulse rounded-full" />
          <span>Conversion {stats?.quotationConversionRate ?? 0}%</span>
        </div>
      </motion.div>

      {/* Primary Stats — Bento Mix */}
      <motion.div variants={item} className="col-span-12 sm:col-span-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            title={dashboardStatMeta[0].title}
            value={formatMMK(stats?.totalRevenue ?? 0)}
            hint={`MoM ${stats?.revenueTrendPercent ?? 0}%`}
            isPending={statsQuery.isPending}
            tone="bg-blue-500"
            description={dashboardStatMeta[0].description}
          />
          <StatCard
            title={dashboardStatMeta[1].title}
            value={String(stats?.activeProjectsCount ?? 0)}
            hint="Planning + In progress"
            isPending={statsQuery.isPending}
            tone="bg-emerald-500"
            description={dashboardStatMeta[1].description}
          />
          <StatCard
            title={dashboardStatMeta[2].title}
            value={String(stats?.pendingQuotationsCount ?? 0)}
            hint="Draft + Sent"
            isPending={statsQuery.isPending}
            tone="bg-amber-500"
            description={dashboardStatMeta[2].description}
          />
          <StatCard
            title={dashboardStatMeta[3].title}
            value={String(stats?.acceptedThisMonth ?? 0)}
            hint="Current month"
            isPending={statsQuery.isPending}
            tone="bg-indigo-500"
            description={dashboardStatMeta[3].description}
          />
        </div>
      </motion.div>

      {/* Quick Actions — Bento Sidebar style */}
      <motion.div variants={item} className="col-span-12 sm:col-span-4">
        <SectionCard title="Quick Commands">
          <div className="flex flex-col gap-3">
            <QuickAction
              href="/quotations/new"
              label="Create New Quote"
              icon={<Plus className="h-4 w-4" />}
              primary
            />
            <QuickAction
              href="/customers"
              label="Register Customer"
              icon={<UserPlus className="h-4 w-4" />}
            />
            <QuickAction
              href="/inventory"
              label="Manage Inventory"
              icon={<Wrench className="h-4 w-4" />}
            />
          </div>
        </SectionCard>
      </motion.div>

      {/* Visualizations — Immersive Bento Row */}
      <motion.div variants={item} className="col-span-12 lg:col-span-7">
        <SectionCard title="Energy Flow Dynamics">
          <EnergyFlow stages={pipeline} />
        </SectionCard>
      </motion.div>

      <motion.div variants={item} className="col-span-12 lg:col-span-5">
        <SectionCard title="Revenue Distribution">
          <SunGauge
            revenue={stats?.totalRevenue ?? 0}
            activeProjects={stats?.activeProjectsCount ?? 0}
            pendingQuotes={stats?.pendingQuotationsCount ?? 0}
            overdueAlerts={stats?.overdueAlertsCount ?? 0}
          />
        </SectionCard>
      </motion.div>

      {/* Activity & Alerts — Bottom Bento Row */}
      <motion.div variants={item} className="col-span-12 lg:col-span-8">
        <SectionCard title="Live Activity Stream">
          <ActivityStream items={activities} isPending={activityQuery.isPending} />
          <div className="mt-6 flex justify-center">
            <Link
              href="/projects"
              className="bg-secondary/50 hover:bg-secondary border-border inline-flex items-center gap-2 rounded-full border px-6 py-2 text-xs font-medium transition-all"
            >
              View Full Audit Log <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={item} className="col-span-12 lg:col-span-4">
        <SectionCard title="Priority Signals">
          <div className="space-y-3">
            {alertsQuery.isPending && (
              <div className="space-y-3">
                <div className="bg-muted h-16 w-full animate-pulse rounded-xl" />
                <div className="bg-muted h-16 w-full animate-pulse rounded-xl" />
              </div>
            )}
            {!alertsQuery.isPending && alerts.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center text-center">
                <p className="text-muted-foreground text-sm">All clear. No urgent signals.</p>
              </div>
            )}
            {alerts.slice(0, 4).map((alert) => (
              <Link
                key={alert.id}
                href="/warranty"
                className="bg-muted/20 hover:bg-muted/40 border-border/50 group flex items-start justify-between rounded-xl border p-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-1 flex h-2 w-2 shrink-0 rounded-full",
                      alert.isOverdue
                        ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        : "bg-amber-500",
                    )}
                  />
                  <div>
                    <p className="text-sm font-bold tracking-tight">{alert.projectNumber}</p>
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {alert.description}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-[10px] whitespace-nowrap">
                  {formatDistanceToNow(new Date(alert.dueDate), {
                    addSuffix: true,
                  })}
                </p>
              </Link>
            ))}
            <Link
              href="/warranty"
              className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs transition-colors"
            >
              See all signals <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </SectionCard>
      </motion.div>

      <motion.div variants={item} className="col-span-12 lg:col-span-4">
        <FinanceSummary />
      </motion.div>
    </motion.div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-border bg-card flex h-full flex-col rounded-2xl border p-6 shadow-sm">
      <h2 className="text-muted-foreground mb-6 text-xs font-bold tracking-widest uppercase">
        {title}
      </h2>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  isPending,
  tone,
  description,
}: {
  title: string;
  value: string;
  hint: string;
  isPending: boolean;
  tone: string;
  description: string;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="border-border bg-card group hover:border-primary/30 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 shadow-sm transition-all">
          <div
            className={cn(
              "absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 rounded-full opacity-10 blur-3xl",
              tone,
            )}
          />
          <div>
            <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {isPending ? (
                <span className="bg-muted inline-block h-9 w-32 animate-pulse rounded-lg" />
              ) : (
                value
              )}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
            <p className="text-muted-foreground text-xs font-medium">{hint}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-[200px]">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function QuickAction({
  href,
  label,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
}): React.JSX.Element {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={cn(
        "h-12 w-full justify-start gap-3 rounded-xl px-4 font-bold transition-all",
        !primary && "bg-muted/30 hover:bg-muted/50 border-border border shadow-none",
      )}
    >
      <Link href={href}>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            primary ? "bg-white/20" : "bg-muted shadow-inner",
          )}
        >
          {icon}
        </span>
        <span className="text-sm">{label}</span>
      </Link>
    </Button>
  );
}
