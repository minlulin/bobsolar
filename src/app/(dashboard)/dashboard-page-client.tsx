'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, type Variants } from 'framer-motion';
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
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
      type: 'spring',
      stiffness: 120,
      damping: 22,
    },
  },
} satisfies Variants;

const item = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 180, damping: 24 },
  },
} satisfies Variants;

const statMeta = [
  {
    title: 'Total Revenue',
    tone: 'from-amber-300 via-orange-400 to-emerald-300',
  },
  {
    title: 'Active Projects',
    tone: 'from-emerald-300 via-teal-400 to-cyan-300',
  },
  {
    title: 'Pending Quotations',
    tone: 'from-indigo-300 via-violet-400 to-sky-300',
  },
  {
    title: 'Accepted This Month',
    tone: 'from-lime-300 via-emerald-400 to-teal-300',
  },
  {
    title: 'Total Customers',
    tone: 'from-sky-300 via-cyan-400 to-emerald-300',
  },
  {
    title: 'Overdue Alerts',
    tone: 'from-rose-300 via-orange-400 to-amber-300',
  },
] as const;

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
    <motion.div
      className="space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.13),rgba(16,185,129,0.08)_42%,rgba(99,102,241,0.10))] p-5 shadow-[0_24px_80px_-48px_rgba(245,158,11,0.75)] backdrop-blur-xl sm:p-6"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <motion.div
          aria-hidden="true"
          className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl"
          animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.08, 0.92] }}
          transition={{
            duration: 7,
            ease: [0.33, 1, 0.68, 1],
            repeat: Infinity,
          }}
        />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-amber-300/90 uppercase">
              Command Center
            </p>
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">
              {getGreeting()}, {stats?.userName ?? 'User'}.
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              Live operating snapshot for revenue, projects, customers, and
              warranty signals.
            </p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
            <span>Conversion {stats?.quotationConversionRate ?? 0}%</span>
          </div>
        </div>
      </motion.div>

      <motion.section
        variants={item}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard
          title={statMeta[0].title}
          value={formatMMK(stats?.totalRevenue ?? 0)}
          hint={`MoM ${stats?.revenueTrendPercent ?? 0}%`}
          loading={statsQuery.isLoading}
          tone={statMeta[0].tone}
        />
        <StatCard
          title={statMeta[1].title}
          value={String(stats?.activeProjectsCount ?? 0)}
          hint="Planning + In progress + On hold"
          loading={statsQuery.isLoading}
          tone={statMeta[1].tone}
        />
        <StatCard
          title={statMeta[2].title}
          value={String(stats?.pendingQuotationsCount ?? 0)}
          hint="Draft + Sent"
          loading={statsQuery.isLoading}
          tone={statMeta[2].tone}
        />
        <StatCard
          title={statMeta[3].title}
          value={String(stats?.acceptedThisMonth ?? 0)}
          hint="Current month"
          loading={statsQuery.isLoading}
          tone={statMeta[3].tone}
        />
        <StatCard
          title={statMeta[4].title}
          value={String(stats?.totalCustomers ?? 0)}
          hint="Active records"
          loading={statsQuery.isLoading}
          tone={statMeta[4].tone}
        />
        <StatCard
          title={statMeta[5].title}
          value={String(stats?.overdueAlertsCount ?? 0)}
          hint={`Conversion ${stats?.quotationConversionRate ?? 0}%`}
          loading={statsQuery.isLoading}
          tone={statMeta[5].tone}
        />
      </motion.section>

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

      <motion.section
        variants={item}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <Card title="Quick Actions">
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
        </Card>
        <Card title="Upcoming Alerts">
          <div className="space-y-3">
            {alertsQuery.isLoading && (
              <p className="text-muted-foreground text-sm">Loading alerts...</p>
            )}
            {!alertsQuery.isLoading && alerts.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No upcoming alerts.
              </p>
            )}
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              >
                <Link
                  href="/warranty"
                  className="group flex items-start justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={cn(
                        'mt-0.5 h-4 w-4',
                        alert.isOverdue ? 'text-red-400' : 'text-amber-400',
                      )}
                    />
                    {alert.isOverdue ? (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
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
                  <p className="text-xs text-white/60">
                    {formatDistanceToNow(new Date(alert.dueDate), {
                      addSuffix: true,
                    })}
                  </p>
                </Link>
              </motion.div>
            ))}
            <Link
              href="/warranty"
              className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </motion.section>

      <motion.section variants={item}>
        <Card title="Recent Activity">
          <ActivityStream
            items={activities}
            isLoading={activityQuery.isLoading}
          />
          <div className="mt-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
            >
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
    <motion.div
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_22px_70px_-52px_rgba(245,158,11,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-5"
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-white/90">
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

function StatCard({
  title,
  value,
  hint,
  loading,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  loading: boolean;
  tone: string;
}) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/55 p-4 shadow-[0_18px_55px_-46px_rgba(245,158,11,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
      whileHover={{ y: -4, scale: 1.012 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80',
          tone,
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition-opacity duration-500 group-hover:opacity-35',
          tone,
        )}
      />
      <p className="relative text-xs font-semibold tracking-wide text-white/60 uppercase">
        {title}
      </p>
      <p className="relative mt-2 text-2xl font-bold">
        {loading ? (
          <span className="inline-block h-8 w-24 animate-pulse rounded-lg bg-white/10" />
        ) : (
          value
        )}
      </p>
      <p className="relative mt-1 text-xs text-white/50">{hint}</p>
    </motion.div>
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
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.025 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <Link
        href={href}
        className="group relative flex min-h-20 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 to-zinc-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-400/12 to-emerald-400/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-amber-300/10 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
        <div className="relative mt-auto flex items-center gap-2 text-sm font-medium text-amber-100">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-amber-200">
            {icon}
          </span>
          {label}
        </div>
      </Link>
    </motion.div>
  );
}
