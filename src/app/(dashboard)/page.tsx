'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Plus, UserPlus, Wrench } from 'lucide-react';
import { EnergyFlow } from '@/components/dashboard/energy-flow';
import { SunGauge } from '@/components/dashboard/sun-gauge';
import { ActivityStream } from '@/components/dashboard/activity-stream';
import {
  useDashboardPipeline,
  useDashboardStats,
  useRecentActivity,
  useUpcomingAlerts,
} from '@/hooks/use-dashboard';
import { cn } from '@/lib/utils';

function formatMMK(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} MMK`;
}

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
    transition: { staggerChildren: 0.08, duration: 0.35 },
  },
};

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const statsQuery = useDashboardStats();
  const pipelineQuery = useDashboardPipeline();
  const activityQuery = useRecentActivity();
  const alertsQuery = useUpcomingAlerts();

  const stats = statsQuery.data;
  const pipeline = pipelineQuery.data?.stages ?? [];
  const activities = activityQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {getGreeting()}, {stats?.userName ?? 'User'}.
        </p>
      </motion.div>

      <motion.section variants={item} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Revenue" value={formatMMK(stats?.totalRevenue ?? 0)} hint={`MoM ${stats?.revenueTrendPercent ?? 0}%`} loading={statsQuery.isLoading} />
        <StatCard title="Active Projects" value={String(stats?.activeProjectsCount ?? 0)} hint="Planning + In progress + On hold" loading={statsQuery.isLoading} />
        <StatCard title="Pending Quotations" value={String(stats?.pendingQuotationsCount ?? 0)} hint="Draft + Sent" loading={statsQuery.isLoading} />
        <StatCard title="Accepted This Month" value={String(stats?.acceptedThisMonth ?? 0)} hint="Current month" loading={statsQuery.isLoading} />
        <StatCard title="Total Customers" value={String(stats?.totalCustomers ?? 0)} hint="Active records" loading={statsQuery.isLoading} />
        <StatCard title="Overdue Alerts" value={String(stats?.overdueAlertsCount ?? 0)} hint={`Conversion ${stats?.quotationConversionRate ?? 0}%`} loading={statsQuery.isLoading} />
      </motion.section>

      <motion.section variants={item} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SunGauge
          revenue={stats?.totalRevenue ?? 0}
          activeProjects={stats?.activeProjectsCount ?? 0}
          pendingQuotes={stats?.pendingQuotationsCount ?? 0}
          overdueAlerts={stats?.overdueAlertsCount ?? 0}
        />
        <EnergyFlow stages={pipeline} />
      </motion.section>

      <motion.section variants={item} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Quick Actions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickAction href="/quotations/new" label="New Quote" icon={<Plus className="h-4 w-4" />} />
            <QuickAction href="/customers" label="Add Customer" icon={<UserPlus className="h-4 w-4" />} />
            <QuickAction href="/inventory" label="Update Inventory" icon={<Wrench className="h-4 w-4" />} />
          </div>
        </Card>
        <Card title="Upcoming Alerts">
          <div className="space-y-3">
            {alertsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading alerts...</p>}
            {!alertsQuery.isLoading && alerts.length === 0 && <p className="text-muted-foreground text-sm">No upcoming alerts.</p>}
            {alerts.map((alert) => (
              <Link key={alert.id} href="/warranty" className="hover:bg-white/5 flex items-start justify-between rounded-xl border border-white/10 px-4 py-3 transition-colors">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn('mt-0.5 h-4 w-4', alert.isOverdue ? 'text-red-400' : 'text-amber-400')} />
                  {alert.isOverdue ? <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" /> : null}
                  <div>
                    <p className="text-sm font-medium">{alert.projectNumber}</p>
                    <p className="text-muted-foreground text-xs">{alert.description}</p>
                  </div>
                </div>
                <p className="text-xs text-white/60">{formatDistanceToNow(new Date(alert.dueDate), { addSuffix: true })}</p>
              </Link>
            ))}
            <Link href="/warranty" className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </motion.section>

      <motion.section variants={item}>
        <Card title="Recent Activity">
          <ActivityStream items={activities} isLoading={activityQuery.isLoading} />
          <div className="mt-3">
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </motion.section>
    </motion.div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-white/90">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      <p className="text-xs tracking-wide text-white/60 uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold">{loading ? '...' : value}</p>
      <p className="mt-1 text-xs text-white/50">{hint}</p>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 py-3 transition-transform hover:scale-[1.02]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400/10 to-emerald-400/0 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-2 text-sm font-medium text-amber-100">
        {icon}
        {label}
      </div>
    </Link>
  );
}
