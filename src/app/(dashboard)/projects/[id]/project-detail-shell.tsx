'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  Trash2,
  Plus,
  ClipboardCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatMMK } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { ProjectDetail } from '@/actions/project-actions';
import { ProjectTimeline } from '@/components/project/project-timeline';
import {
  useProject,
  useUpdateProject,
  useAddProjectCost,
  useDeleteProjectCost,
  useAddProjectRemark,
  useMarkProjectCompleted,
  useDeleteProjectRemark,
  useCreateProjectWarrantyAlert,
} from '@/hooks/use-projects';
import {
  resolveWarrantyAlert as resolveWarrantyAlertAction,
  reopenWarrantyAlert as reopenWarrantyAlertAction,
} from '@/actions/warranty-actions';
import { toast } from 'sonner';
import {
  permittedNextStatuses,
  isProjectStatus,
  type ProjectStatus,
  addProjectCostSchema,
  createWarrantyAlertSchema,
} from '@/lib/validators/project';
import {
  type CostType,
  type RemarkType,
  type AlertType,
  COST_FILTERS,
  REMARK_TYPE_ICONS,
} from '@/lib/domain/enums';

function statusBadgeTone(status: ProjectStatus): string {
  switch (status) {
    case 'planning':
      return 'border-indigo-500/35 bg-indigo-500/10 text-indigo-200';
    case 'in_progress':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200';
    case 'on_hold':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    case 'completed':
      return 'border-border/70 bg-emerald-500/15 text-emerald-200';
    case 'cancelled':
      return 'border-red-400/35 bg-red-600/25 text-red-100';
    default:
      return '';
  }
}

function aggregateCosts(project: ProjectDetail): {
  buckets: Record<CostType, number>;
  total: number;
} {
  const buckets: Record<CostType, number> = {
    material: 0,
    labor: 0,
    transport: 0,
    misc: 0,
  };

  project.costs.forEach((cost) => {
    const costType = cost.costType;
    const slot = buckets[costType];
    buckets[costType] = slot + Number(cost.amount);
  });

  const total = Object.values(buckets).reduce((a, v) => a + v, 0);
  return { buckets, total };
}

async function persistWarrantyCheckbox(
  alertId: string,
  resolved: boolean,
): Promise<boolean> {
  const res = resolved
    ? await resolveWarrantyAlertAction(alertId)
    : await reopenWarrantyAlertAction(alertId);

  if (!res.success) {
    toast.error(res.error);
    return false;
  }
  return true;
}

interface ProjectDetailShellProps {
  id: string;
  isAdmin: boolean;
  userId: string;
}

export function ProjectDetailShell({
  id,
  isAdmin,
  userId,
}: ProjectDetailShellProps): React.JSX.Element {
  const router = useRouter();
  const { data: proj, error, isLoading, refetch } = useProject(id);

  const updateProjectMutation = useUpdateProject();
  const addCostMutation = useAddProjectCost();
  const deleteCostMutation = useDeleteProjectCost();
  const addRemarkMutation = useAddProjectRemark();
  const deleteRemarkMutation = useDeleteProjectRemark();
  const markCompleteMutation = useMarkProjectCompleted();
  const alertMutation = useCreateProjectWarrantyAlert();

  const [costOpen, setCostOpen] = React.useState(false);
  const [costFilter, setCostFilter] =
    React.useState<(typeof COST_FILTERS)[number]>('all');

  const [costForm, setCostForm] = React.useState<{
    description: string;
    amount: string;
    costType: CostType;
    incurredDate: string;
  }>({
    description: '',
    amount: '',
    costType: 'material',
    incurredDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [remarkBody, setRemarkBody] = React.useState('');
  const [remarkType, setRemarkType] = React.useState<RemarkType>('note');

  const [alertForm, setAlertForm] = React.useState<{
    alertType: AlertType;
    description: string;
    dueDate: string;
  }>({
    alertType: 'warranty_expiry',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [busyAlertId, setBusyAlertId] = React.useState<string | null>(null);

  // All useMemo hooks must be called before any early returns
  const statusTransitions = React.useMemo((): ProjectStatus[] => {
    if (!proj) return [];
    if (!isProjectStatus(proj.status)) return [];
    const current: ProjectStatus = proj.status;
    return [current, ...permittedNextStatuses(current)].filter(
      (status, idx, arr) => arr.indexOf(status) === idx,
    );
  }, [proj]);

  const canEditOperational =
    proj?.status !== 'completed' && proj?.status !== 'cancelled';

  const filteredCosts = React.useMemo(() => {
    if (!proj) return [];
    if (costFilter === 'all') return proj.costs;
    return proj.costs.filter((cost) => cost.costType === costFilter);
  }, [proj, costFilter]);

  const aggregate = React.useMemo(() => {
    if (!proj) return { buckets: {} as Record<CostType, number>, total: 0 };
    return aggregateCosts(proj);
  }, [proj]);
  const { buckets: costBuckets, total: costSumAgg } = aggregate;

  const quoted = React.useMemo(() => {
    if (!proj) return 0;
    return Math.round(Number(proj.quotedTotal));
  }, [proj]);

  const variancePct = React.useMemo(() => {
    if (!proj || quoted === 0) return 0;
    return ((proj.actualTotalComputed - quoted) / quoted) * 100;
  }, [quoted, proj]);

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/15 text-destructive rounded-3xl border p-16 text-center text-sm font-semibold">
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="text-solar h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (proj === undefined) {
    return (
      <div className="text-muted-foreground py-24 text-center text-sm">
        Project data is still synchronizing…
      </div>
    );
  }

  const p = proj;

  async function persistAlertToggle(
    alertId: string,
    resolved: boolean,
  ): Promise<void> {
    const ok = await persistWarrantyCheckbox(alertId, resolved);
    if (ok) {
      toast.success(resolved ? 'Alert resolved' : 'Alert reopened');
      void refetch();
    }
  }

  function handleSubmitCost(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    const validated = addProjectCostSchema.safeParse({
      projectId: p.id,
      description: costForm.description.trim(),
      amount: Math.round(Number(costForm.amount.replace(/,/g, ''))),
      costType: costForm.costType,
      incurredDate: new Date(costForm.incurredDate),
    });
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message ?? 'Check cost fields');
      return;
    }

    addCostMutation.mutate(validated.data, {
      onSuccess: (res) => {
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setCostOpen(false);
        setCostForm({
          description: '',
          amount: '',
          costType: 'material',
          incurredDate: format(new Date(), 'yyyy-MM-dd'),
        });
      },
    });
  }

  function normalizeCostAmountInput(value: string): string {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned.length === 0) return '';
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return '';
    return String(Math.round(parsed));
  }

  function handleSubmitRemark(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    if (!remarkBody.trim()) return;
    addRemarkMutation.mutate(
      {
        projectId: p.id,
        content: remarkBody.trim(),
        remarkType,
      },
      {
        onSuccess: (res) => {
          if (!res.success) toast.error(res.error);
          else setRemarkBody('');
        },
      },
    );
  }

  function submitAlert(): void {
    const parsed = createWarrantyAlertSchema.safeParse({
      projectId: p.id,
      alertType: alertForm.alertType,
      description: alertForm.description.trim(),
      dueDate: new Date(alertForm.dueDate),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid alert payload');
      return;
    }

    alertMutation.mutate(parsed.data, {
      onSuccess: (res) => {
        if (!res.success) toast.error(res.error);
      },
      onError: () => toast.error('Failed to publish alert'),
    });
  }

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              router.push('/projects');
            }}
            className="rounded-full"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Projects
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tighter">
              {proj.projectNumber}
            </h1>
            <Badge
              className={cn(
                'border text-[10px] uppercase',
                isProjectStatus(proj.status)
                  ? statusBadgeTone(proj.status)
                  : 'border-gray-500/35 bg-gray-500/10 text-gray-200',
              )}
            >
              {proj.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Capacity · {Number(proj.systemSizeKwp)} kWp
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            <Link
              href={`/customers/${proj.customerId}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {proj.customer.name}
            </Link>
          </p>
          {proj.quotation ? (
            <p className="text-muted-foreground text-xs tracking-[0.35em] uppercase">
              Linked quote{' '}
              <Link
                href={`/quotations/${proj.quotation.id}`}
                className="text-solar hover:underline"
              >
                {proj.quotation.quoteNumber}
              </Link>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {isAdmin ? (
            <Select
              value={proj.status}
              disabled={
                proj.status === 'completed' || proj.status === 'cancelled'
              }
              onValueChange={(value: ProjectStatus) => {
                if (value === 'completed') {
                  toast.warning(
                    'Use “Mark Completed” so warranty cadence runs automatically.',
                  );
                  return;
                }
                updateProjectMutation.mutate({ id, status: value });
              }}
            >
              <SelectTrigger className="w-[220px] rounded-2xl text-xs uppercase">
                <SelectValue placeholder="Advance status · admin only" />
              </SelectTrigger>
              <SelectContent>
                {statusTransitions
                  .filter((candidate) => candidate !== 'completed')
                  .map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {candidate.replace('_', ' ')}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button
            className="rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-10 text-xs font-bold uppercase shadow-[0_0_35px_-8px_rgb(110,231,183)] hover:brightness-110"
            disabled={
              !isAdmin ||
              proj.status === 'completed' ||
              proj.status === 'cancelled' ||
              markCompleteMutation.isPending
            }
            onClick={() => {
              markCompleteMutation.mutate(id);
            }}
          >
            {markCompleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="mr-2 h-4 w-4" />
            )}
            Mark completed
          </Button>
        </div>
      </div>

      <ProjectTimeline project={proj} />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 border-border/70 flex h-auto flex-wrap gap-3 rounded-[2rem] border p-3">
          {['overview', 'costs', 'remarks', 'warranty'].map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="data-[state=active]:shadow-solar rounded-full px-5 py-3 text-[10px] font-bold uppercase data-[state=active]:border data-[state=active]:border-amber-500/65"
            >
              {item}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Quoted total', value: quoted },
              { label: 'Actual spend', value: proj.actualTotalComputed },
              {
                label: 'Variance vs quote',
                value: proj.actualTotalComputed - quoted,
                accent:
                  variancePct > 15
                    ? 'text-red-400'
                    : variancePct >= 10
                      ? 'text-amber-300'
                      : 'text-emerald-300',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="surface-card rounded-3xl px-7 py-6"
              >
                <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase">
                  {card.label}
                </p>
                <p
                  className={cn(
                    'font-mono text-3xl tracking-tighter',
                    card.accent,
                  )}
                >
                  {typeof card.value === 'number'
                    ? formatMMK(card.value)
                    : card.value}
                  {card.label.includes('Variance') ? (
                    <span className="text-muted-foreground ml-4 text-[12px]">
                      ({variancePct.toFixed(1)} %)
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div variants={staggerContainer} animate="animate">
              <div className="surface-card space-y-5 rounded-[2rem] p-6">
                <h3 className="text-muted-foreground text-[10px] font-bold uppercase">
                  Site briefing
                </h3>
                <p className="text-foreground text-sm leading-relaxed">
                  {proj.siteAddress}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Started ·{' '}
                  {proj.startDate
                    ? format(new Date(proj.startDate), 'MMM dd, yyyy')
                    : 'TBD'}{' '}
                  · Planned wrap{' '}
                  {proj.targetCompletion
                    ? format(new Date(proj.targetCompletion), 'MMM dd yyyy')
                    : 'floating'}
                </p>
              </div>
            </motion.div>

            <ProjectOperationalNotes
              key={p.id}
              disabled={!canEditOperational}
              initialNotes={p.notes}
              onPersist={(draft) => {
                updateProjectMutation.mutate({ id: p.id, notes: draft });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-8">
          {canEditOperational ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {COST_FILTERS.map((chip) => (
                  <Button
                    key={chip}
                    variant={costFilter === chip ? 'secondary' : 'outline'}
                    className={cn(
                      'rounded-full text-[11px] tracking-wide uppercase',
                      costFilter === chip &&
                        'shadow-glow-solar border-transparent',
                    )}
                    onClick={() => {
                      setCostFilter(chip);
                    }}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
              <Button
                className="rounded-full"
                onClick={() => {
                  setCostOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add cost
              </Button>
              <Sheet open={costOpen} onOpenChange={setCostOpen}>
                <SheetContent className="sm:max-w-md">
                  <form onSubmit={handleSubmitCost} className="space-y-8">
                    <SheetHeader>
                      <SheetTitle>Register site spend</SheetTitle>
                    </SheetHeader>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          required
                          value={costForm.description}
                          onChange={(e) => {
                            setCostForm((s) => ({
                              ...s,
                              description: e.target.value,
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount · MMK (integer)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          required
                          value={costForm.amount}
                          onChange={(e) => {
                            setCostForm((s) => ({
                              ...s,
                              amount: e.target.value,
                            }));
                          }}
                          onBlur={(e) => {
                            setCostForm((s) => ({
                              ...s,
                              amount: normalizeCostAmountInput(e.target.value),
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bucket</Label>
                        <Select
                          value={costForm.costType}
                          onValueChange={(v: CostType) => {
                            setCostForm((s) => ({
                              ...s,
                              costType: v,
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="classification" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Materials</SelectItem>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="transport">Logistics</SelectItem>
                            <SelectItem value="misc">
                              Everything else
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Obligation date</Label>
                        <Input
                          type="date"
                          required
                          value={costForm.incurredDate}
                          onChange={(e) => {
                            setCostForm((s) => ({
                              ...s,
                              incurredDate: e.target.value,
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <SheetFooter>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={addCostMutation.isPending}
                      >
                        {addCostMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Persist entry
                      </Button>
                    </SheetFooter>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Financial ledger is immutable after archival.
            </p>
          )}

          <div className="surface-card rounded-[2rem] p-6">
            <p className="text-muted-foreground mb-10 text-[10px] font-bold uppercase">
              Ledger composition
            </p>
            <div className="border-border/70 mb-14 flex h-7 overflow-hidden rounded-full border shadow-inner">
              {(
                Object.entries(costBuckets) as [
                  keyof typeof costBuckets,
                  number,
                ][]
              ).map(([key, value]) =>
                costSumAgg > 0 ? (
                  <div
                    key={key}
                    style={{
                      width: `${(value / Math.max(costSumAgg, 1)) * 100}%`,
                    }}
                    className={cn(
                      'transition-[width] duration-700',
                      key === 'material' && 'bg-amber-400/95',
                      key === 'labor' && 'bg-emerald-400/95',
                      key === 'transport' && 'bg-indigo-500/85',
                      key === 'misc' && 'bg-zinc-500/95',
                    )}
                  />
                ) : null,
              )}
            </div>

            <div className="space-y-3">
              {filteredCosts.map((cost) => (
                <motion.div key={cost.id} variants={staggerItem}>
                  <div className="surface-subtle border-border/70 flex gap-5 rounded-[1.75rem] border px-6 py-4 text-sm hover:border-emerald-300/65">
                    <div className="flex-1 space-y-1">
                      <p className="text-base font-semibold">
                        {cost.description}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        Recorded{' '}
                        {format(
                          new Date(cost.incurredDate),
                          'MMM dd yyyy · HH:mm',
                        )}
                      </p>
                    </div>
                    <Badge className="h-fit text-[11px]" variant="outline">
                      {cost.costType}
                    </Badge>
                    <p className="font-mono text-lg">
                      {formatMMK(Number(cost.amount))}
                    </p>
                    {canEditOperational ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-400"
                        aria-label="Delete cost"
                        onClick={() => {
                          deleteCostMutation.mutate(cost.id);
                        }}
                        disabled={deleteCostMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              ))}
              {filteredCosts.length === 0 ? (
                <p className="text-muted-foreground text-center text-sm">
                  Quiet ledger — tap “Add cost” for your first disbursement
                  entry.
                </p>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-10 grid gap-4 text-[11px] uppercase md:grid-cols-3">
              <div>
                Quoted{' '}
                <div className="font-mono text-base text-emerald-200">
                  {formatMMK(quoted)}
                </div>
              </div>
              <div>
                Actual{' '}
                <div className="font-mono text-base text-emerald-200">
                  {formatMMK(proj.actualTotalComputed)}
                </div>
              </div>
              <div>
                Delta{' '}
                <div
                  className={cn(
                    'font-mono text-base',
                    proj.actualTotalComputed <= quoted
                      ? 'text-emerald-200'
                      : 'text-rose-400',
                  )}
                >
                  {formatMMK(proj.actualTotalComputed - quoted)}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="remarks" className="space-y-6">
          {canEditOperational ? (
            <form
              className="surface-card space-y-6 rounded-[2rem] p-6"
              onSubmit={handleSubmitRemark}
            >
              <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-2 md:col-span-2">
                  <Label>Signal cadence</Label>
                  <Select
                    value={remarkType}
                    onValueChange={(v: RemarkType) => {
                      setRemarkType(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Field note</SelectItem>
                      <SelectItem value="issue">Site issue</SelectItem>
                      <SelectItem value="update">Stakeholder update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                placeholder="Brief the crew — timelines, snag lists, escalation windows…"
                className="min-h-[170px]"
                value={remarkBody}
                onChange={(e) => {
                  setRemarkBody(e.target.value);
                }}
              />
              <Button
                disabled={remarkBody.trim().length === 0}
                type="submit"
                className="rounded-full uppercase"
              >
                {addRemarkMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Broadcast reminder
              </Button>
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">
              Conversation thread is archived.
            </p>
          )}

          <ScrollArea className="surface-card h-[520px] rounded-[2rem] p-6">
            <div className="space-y-4 pr-6">
              {proj.remarks.map((remark, idx) => (
                <motion.div
                  key={remark.id}
                  variants={staggerItem}
                  custom={idx}
                  className="surface-subtle border-border/70 rounded-[1.5rem] border p-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="mb-3 flex justify-between gap-3 text-[11px] uppercase">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {REMARK_TYPE_ICONS[remark.remarkType]}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[9px] uppercase"
                      >
                        {remark.remarkType}
                      </Badge>
                      <span className="text-muted-foreground font-semibold">
                        {remark.author?.name ?? 'Team member'}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {format(new Date(remark.createdAt), 'MMM d yyyy · hh:mm')}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {remark.content}
                  </p>
                  {(isAdmin || remark.authorId === userId) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 text-[11px] text-red-400"
                      onClick={() => {
                        deleteRemarkMutation.mutate(remark.id);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="warranty" className="space-y-6">
          <div className="surface-card flex flex-wrap items-center justify-between gap-4 rounded-[2rem] px-8 py-6">
            <div>
              <p className="text-foreground text-lg font-semibold tracking-[0.4em] uppercase">
                Warranty rhythm
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Convert completion packets into evergreen service loops.
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="rounded-full">Compose alert</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New warranty cue</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Label>Focus</Label>
                  <Select
                    value={alertForm.alertType}
                    onValueChange={(v: typeof alertForm.alertType) => {
                      setAlertForm((prev) => ({ ...prev, alertType: v }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cue type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warranty_expiry">
                        Warranty expiry
                      </SelectItem>
                      <SelectItem value="maintenance_due">
                        Preventive upkeep
                      </SelectItem>
                      <SelectItem value="follow_up">
                        Client follow-through
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>Description</Label>
                  <Textarea
                    value={alertForm.description}
                    onChange={(e) => {
                      setAlertForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }));
                    }}
                  />

                  <Label>Due milestone</Label>
                  <Input
                    type="date"
                    value={alertForm.dueDate}
                    onChange={(e) => {
                      setAlertForm((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }));
                    }}
                  />
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => {
                      submitAlert();
                    }}
                    disabled={alertMutation.isPending}
                    className="rounded-full uppercase"
                  >
                    {alertMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Persist alert
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <motion.div
            variants={staggerContainer}
            animate="animate"
            className="grid gap-5 lg:grid-cols-2"
          >
            {proj.warrantyAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'surface-card rounded-[1.75rem] border p-6',
                  alert.isResolved
                    ? 'border-border/50 opacity-65'
                    : new Date(alert.dueDate) < new Date()
                      ? 'border-red-400/65'
                      : 'border-amber-500/65',
                )}
              >
                <div className="mb-4 flex justify-between gap-3">
                  <Badge variant="outline" className="text-[11px]">
                    {alert.alertType.replace('_', ' ')}
                  </Badge>
                  <Checkbox
                    id={`resolved-${alert.id}`}
                    checked={alert.isResolved}
                    disabled={busyAlertId === alert.id}
                    onCheckedChange={(val) => {
                      if (val === 'indeterminate') return;
                      void (async (): Promise<void> => {
                        setBusyAlertId(alert.id);
                        try {
                          await persistAlertToggle(alert.id, val);
                        } finally {
                          setBusyAlertId(null);
                        }
                      })();
                    }}
                  />
                </div>

                <p className="text-foreground text-sm font-medium">
                  {alert.description}
                </p>
                <p className="text-muted-foreground mt-6 text-[12px]">
                  {!alert.isResolved ? (
                    <span className="font-semibold text-amber-200">
                      Pulse ·{' '}
                      {formatDistanceToNowStrict(new Date(alert.dueDate), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : (
                    <span>Resolved · audited</span>
                  )}
                </p>
              </div>
            ))}

            {proj.warrantyAlerts.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center text-sm">
                No aftermarket beats yet — add your first upkeep reminder.
              </p>
            ) : null}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectOperationalNotes({
  disabled,
  initialNotes,
  onPersist,
}: {
  disabled: boolean;
  initialNotes: string | null | undefined;
  onPersist: (draft: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(() => initialNotes ?? '');

  return (
    <div className="surface-card space-y-5 rounded-[2rem] p-6">
      <h3 className="text-muted-foreground text-[10px] font-bold uppercase">
        Operational notes
      </h3>
      <Textarea
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        className="min-h-[170px]"
      />
      <Button
        disabled={disabled}
        variant="outline"
        className="rounded-full"
        onClick={() => {
          onPersist(draft);
        }}
        type="button"
      >
        Save briefing
      </Button>
    </div>
  );
}
