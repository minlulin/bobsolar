'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, type Variants } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  Plus,
  TrendingUp,
  UserPlus,
  Wrench,
} from 'lucide-react';
import {
  useDashboardPipeline,
  useDashboardStats,
  useRecentActivity,
  useUpcomingAlerts,
} from '@/hooks/use-dashboard';
import { cn, formatMMK } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { dashboardStatMeta } from '@/app/(dashboard)/dashboard-stat-meta';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
      ease: 'easeOut',
    },
  },
} satisfies Variants;

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
} satisfies Variants;

const SunGauge = dynamic(
  () => import('@/components/dashboard/sun-gauge').then((m) => m.SunGauge),
  { ssr: false },
);
const EnergyFlow = dynamic(
  () => import('@/components/dashboard/energy-flow').then((m) => m.EnergyFlow),
  { ssr: false },
);
const ActivityStream = dynamic(
  () =>
    import('@/components/dashboard/activity-stream').then(
      (m) => m.ActivityStream,
    ),
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
      className="space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Hero Header */}
      <motion.div
        variants={item}
        className="border-border bg-card rounded-xl border p-6"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
              Command Center
            </p>
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">
              {getGreeting()}, {stats?.userName ?? 'User'}.
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Live operating snapshot for revenue, projects, customers, and
              warranty signals.
            </p>
          </div>
          <div className="bg-muted flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            <span>Conversion {stats?.quotationConversionRate ?? 0}%</span>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.section
        variants={item}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard
          title={dashboardStatMeta[0].title}
          value={formatMMK(stats?.totalRevenue ?? 0)}
          hint={`MoM ${stats?.revenueTrendPercent ?? 0}%`}
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[0].tone}
          description={dashboardStatMeta[0].description}
        />
        <StatCard
          title={dashboardStatMeta[1].title}
          value={String(stats?.activeProjectsCount ?? 0)}
          hint="Planning + In progress + On hold"
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[1].tone}
          description={dashboardStatMeta[1].description}
        />
        <StatCard
          title={dashboardStatMeta[2].title}
          value={String(stats?.pendingQuotationsCount ?? 0)}
          hint="Draft + Sent"
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[2].tone}
          description={dashboardStatMeta[2].description}
        />
        <StatCard
          title={dashboardStatMeta[3].title}
          value={String(stats?.acceptedThisMonth ?? 0)}
          hint="Current month"
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[3].tone}
          description={dashboardStatMeta[3].description}
        />
        <StatCard
          title={dashboardStatMeta[4].title}
          value={String(stats?.totalCustomers ?? 0)}
          hint="Active records"
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[4].tone}
          description={dashboardStatMeta[4].description}
        />
        <StatCard
          title={dashboardStatMeta[5].title}
          value={String(stats?.overdueAlertsCount ?? 0)}
          hint={`Conversion ${stats?.quotationConversionRate ?? 0}%`}
          loading={statsQuery.isLoading}
          tone={dashboardStatMeta[5].tone}
          description={dashboardStatMeta[5].description}
        />
      </motion.section>

      {/* Pipeline Viz */}
      <motion.section
        variants={item}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <SunGauge
          revenue={stats?.totalRevenue ?? 0}
          activeProjects={stats?.activeProjectsCount ?? 0}
          pendingQuotes={stats?.pendingQuotationsCount ?? 0}
          overdueAlerts={stats?.overdueAlertsCount ?? 0}
        />
        <EnergyFlow stages={pipeline} />
      </motion.section>

      {/* Quick Actions & Alerts */}
      <motion.section
        variants={item}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <SectionCard title="Quick Actions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickAction
              href="/quotations/new"
              label="New Quote"
              icon={<Plus className="h-4 w-4" />}
            />
            <QuickAction
              href="/customers"
              label="Add Customer"
              icon={<UserPlus className="h-4 w-4" />}
            />
            <QuickAction
              href="/inventory"
              label="Update Inventory"
              icon={<Wrench className="h-4 w-4" />}
            />
          </div>
        </SectionCard>
        <SectionCard title="Upcoming Alerts">
          <div className="space-y-3">
            {alertsQuery.isLoading && (
              <p className="text-muted-foreground text-sm">Loading alerts...</p>
            )}
            {!alertsQuery.isLoading && alerts.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No upcoming alerts.
              </p>
            )}
            {alerts.map(
              (alert: {
                id: string;
                projectNumber: string;
                description: string;
                dueDate: string | Date;
                isOverdue: boolean;
              }) => (
                <div key={alert.id}>
                  <Link
                    href="/warranty"
                    className="bg-muted/35 hover:bg-muted/55 flex items-start justify-between rounded-lg px-4 py-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={cn(
                          'mt-0.5 h-4 w-4',
                          alert.isOverdue
                            ? 'text-destructive'
                            : 'text-amber-500',
                        )}
                      />
                      {alert.isOverdue ? (
                        <span className="bg-destructive inline-block h-2 w-2 rounded-full" />
                      ) : null}
                      <div>
                        <p className="text-sm font-medium">
                          {alert.projectNumber}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(alert.dueDate), {
                        addSuffix: true,
                      })}
                    </p>
                  </Link>
                </div>
              ),
            )}
            <Link
              href="/warranty"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </SectionCard>
      </motion.section>

      {/* Activity */}
      <motion.section variants={item}>
        <SectionCard title="Recent Activity">
          <ActivityStream
            items={activities}
            isLoading={activityQuery.isLoading}
          />
          <div className="mt-3">
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </SectionCard>
      </motion.section>
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
    <div className="border-border bg-card rounded-xl border p-5">
      <h2 className="text-foreground mb-4 text-sm font-semibold tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  loading,
  tone,
  description,
}: {
  title: string;
  value: string;
  hint: string;
  loading: boolean;
  tone: string;
  description: string;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="border-border bg-card group hover:bg-muted/30 relative rounded-xl border p-4 transition-colors">
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-0.5 rounded-t-xl opacity-80',
              tone,
            )}
          />
          <p className="text-muted-foreground relative text-xs font-semibold tracking-wide uppercase">
            {title}
          </p>
          <p className="relative mt-1.5 text-2xl font-bold">
            {loading ? (
              <span className="bg-muted inline-block h-8 w-24 animate-pulse rounded-lg" />
            ) : (
              value
            )}
          </p>
          <p className="text-muted-foreground relative mt-1 text-xs">{hint}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{description}</TooltipContent>
    </Tooltip>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="border-border bg-muted/25 hover:bg-muted/45 group relative flex min-h-20 items-end rounded-xl border px-4 py-3 transition-colors"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="bg-muted grid h-8 w-8 place-items-center rounded-full">
          {icon}
        </span>
        {label}
      </div>
    </Link>
  );
}
