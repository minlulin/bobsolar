"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ProjectDetail } from "@/actions/project-actions";
import {
  reopenWarrantyAlert as reopenWarrantyAlertAction,
  resolveWarrantyAlert as resolveWarrantyAlertAction,
} from "@/actions/warranty-actions";
import { ProjectStateRail } from "@/components/project/project-state-rail";

const ProjectTimeline = dynamic(
  () => import("@/components/project/project-timeline").then((mod) => mod.ProjectTimeline),
  { loading: () => <Loader2 className="animate-spin" /> },
);
const ProjectOperationalNotes = dynamic(
  () => import("./components/project-operational-notes").then((mod) => mod.ProjectOperationalNotes),
  { loading: () => <div className="h-[250px] animate-pulse bg-muted rounded-4xl" /> },
);
const CompletedProjectVouchers = dynamic(
  () => import("./components/completed-vouchers").then((mod) => mod.CompletedProjectVouchers),
  { loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-2xl" /> },
);

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ProjectTab = "overview" | "costs" | "remarks" | "warranty";

import { useInventoryItems } from "@/hooks/use-inventory";
import { usePaymentMethods, useProjectPayments, useRecordPayment } from "@/hooks/use-payments";
import {
  useAddProjectCost,
  useAddProjectRemark,
  useCheckProjectCompletionOutstanding,
  useConsumeProjectInventory,
  useCreateProjectWarrantyAlert,
  useDeleteProjectCost,
  useDeleteProjectRemark,
  useMarkProjectCompleted,
  useProject,
  useUpdateProject,
} from "@/hooks/use-projects";
import type { AlertType, CostType, ProjectStatus, RemarkType } from "@/lib/db/schema";
import { COST_FILTERS } from "@/lib/domain/cost-types";
import type { PaymentType } from "@/lib/domain/payment";
import { isProjectStatus } from "@/lib/domain/project";
import { REMARK_TYPE_ICONS } from "@/lib/domain/remark-types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn, formatMMK } from "@/lib/utils";
import {
  addProjectCostSchema,
  consumeProjectInventorySchema,
  createWarrantyAlertSchema,
} from "@/lib/validators/project";

function statusBadgeTone(status: ProjectStatus): string {
  switch (status) {
    case "planning":
      return "border-indigo-500/35 bg-indigo-500/10 text-indigo-200";
    case "in_progress":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "on_hold":
      return "border-amber-500/35 bg-amber-500/10 text-amber-300";
    case "installation_completed":
      return "border-cyan-500/35 bg-cyan-500/10 text-cyan-200";
    case "completed":
      return "border-border/70 bg-emerald-500/15 text-emerald-200";
    case "cancelled":
      return "border-red-400/35 bg-red-600/25 text-red-100";
    default:
      return "";
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
    general: 0,
  };

  project.costs.forEach((cost) => {
    if (cost.isReversed) return;
    const costType = cost.costType;
    const slot = buckets[costType];
    buckets[costType] = slot + Number(cost.amount);
  });

  const total = Object.values(buckets).reduce((a, v) => a + v, 0);
  return { buckets, total };
}

async function persistWarrantyCheckbox(alertId: string, resolved: boolean): Promise<boolean> {
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
  const consumeInventoryMutation = useConsumeProjectInventory();
  const { data: paymentMethodsData } = usePaymentMethods();
  const paymentMethods = paymentMethodsData ?? [];
  const { data: paymentRows = [] } = useProjectPayments(id);
  const recordPaymentMutation = useRecordPayment();
  const { data: inventoryList } = useInventoryItems({ isActive: true });
  const inventoryOptions = React.useMemo(
    () =>
      (
        inventoryList as
          | { items?: Array<{ id: string; name: string; stockQty: number }> }
          | undefined
      )?.items ?? [],
    [inventoryList],
  );
  const firstPaymentMethodId = paymentMethods[0]?.id ?? "";
  const deleteCostMutation = useDeleteProjectCost();
  const addRemarkMutation = useAddProjectRemark();
  const deleteRemarkMutation = useDeleteProjectRemark();
  const markCompleteMutation = useMarkProjectCompleted();
  const checkOutstandingMutation = useCheckProjectCompletionOutstanding();
  const alertMutation = useCreateProjectWarrantyAlert();

  const [completionDialogOpen, setCompletionDialogOpen] = React.useState(false);
  const [completionOutstanding, setCompletionOutstanding] = React.useState(0);

  const [activeProjectTab, setActiveProjectTab] = React.useState<ProjectTab>("overview");
  const [costOpen, setCostOpen] = React.useState(false);
  const [costFilter, setCostFilter] = React.useState<(typeof COST_FILTERS)[number]>("all");
  const [consumeOpen, setConsumeOpen] = React.useState(false);

  const [costForm, setCostForm] = React.useState<{
    paymentMethodId: string;
    description: string;
    amount: string;
    costType: CostType;
    incurredDate: string;
  }>({
    paymentMethodId: "",
    description: "",
    amount: "",
    costType: "material",
    incurredDate: format(new Date(), "yyyy-MM-dd"),
  });

  const [consumeForm, setConsumeForm] = React.useState<{
    inventoryItemId: string;
    quantity: string;
    description: string;
    incurredDate: string;
  }>({
    inventoryItemId: "",
    quantity: "1",
    description: "",
    incurredDate: format(new Date(), "yyyy-MM-dd"),
  });

  const [remarkBody, setRemarkBody] = React.useState("");
  const [remarkType, setRemarkType] = React.useState<RemarkType>("note");

  const [alertForm, setAlertForm] = React.useState<{
    alertType: AlertType;
    description: string;
    dueDate: string;
  }>({
    alertType: "warranty_expiry",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
  });

  const [busyAlertId, setBusyAlertId] = React.useState<string | null>(null);
  const [paymentForm, setPaymentForm] = React.useState<{
    paymentType: "advance" | "final";
    amount: string;
    paymentMethodId: string;
    paymentDate: string;
    reference: string;
    notes: string;
  }>({
    paymentType: "advance",
    amount: "",
    paymentMethodId: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    reference: "",
    notes: "",
  });

  React.useEffect(() => {
    if (costForm.paymentMethodId.length > 0) return;
    if (!firstPaymentMethodId) return;
    setCostForm((prev) => ({ ...prev, paymentMethodId: firstPaymentMethodId }));
  }, [costForm.paymentMethodId, firstPaymentMethodId]);

  React.useEffect(() => {
    const firstInventoryId = inventoryOptions[0]?.id;
    if (!firstInventoryId) return;
    setConsumeForm((prev) =>
      prev.inventoryItemId ? prev : { ...prev, inventoryItemId: firstInventoryId },
    );
  }, [inventoryOptions]);

  React.useEffect(() => {
    if (!firstPaymentMethodId) return;
    setPaymentForm((prev) => ({
      ...prev,
      paymentMethodId: prev.paymentMethodId || firstPaymentMethodId,
    }));
  }, [firstPaymentMethodId]);

  const canEditOperational =
    proj?.status !== "installation_completed" &&
    proj?.status !== "completed" &&
    proj?.status !== "cancelled";

  const filteredCosts = React.useMemo(() => {
    if (!proj) return [];
    if (costFilter === "all") return proj.costs;
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

  async function persistAlertToggle(alertId: string, resolved: boolean): Promise<void> {
    const ok = await persistWarrantyCheckbox(alertId, resolved);
    if (ok) {
      toast.success(resolved ? "Alert resolved" : "Alert reopened");
      void refetch();
    }
  }

  function handleSubmitCost(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    const validated = addProjectCostSchema.safeParse({
      projectId: p.id,
      paymentMethodId: costForm.paymentMethodId,
      description: costForm.description.trim(),
      amount: Math.round(Number(costForm.amount.replace(/,/g, ""))),
      costType: costForm.costType,
      incurredDate: new Date(costForm.incurredDate),
    });
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message ?? "Check cost fields");
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
          paymentMethodId: paymentMethods[0]?.id ?? "",
          description: "",
          amount: "",
          costType: "material",
          incurredDate: format(new Date(), "yyyy-MM-dd"),
        });
      },
    });
  }

  function handleSubmitConsume(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    const validated = consumeProjectInventorySchema.safeParse({
      projectId: p.id,
      inventoryItemId: consumeForm.inventoryItemId,
      quantity: Math.round(Number(consumeForm.quantity)),
      description: consumeForm.description.trim(),
      incurredDate: new Date(consumeForm.incurredDate),
    });
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message ?? "Check consume fields");
      return;
    }

    consumeInventoryMutation.mutate(validated.data, {
      onSuccess: (res) => {
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        setConsumeOpen(false);
        setConsumeForm((prev) => ({
          ...prev,
          quantity: "1",
          description: "",
          incurredDate: format(new Date(), "yyyy-MM-dd"),
        }));
      },
    });
  }

  function handleSubmitPayment(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    const amount = Math.round(Number(paymentForm.amount.replace(/,/g, "")));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }

    if (paymentForm.paymentMethodId.length === 0) {
      toast.error("Select a payment method.");
      return;
    }

    recordPaymentMutation.mutate(
      {
        projectId: p.id,
        paymentType: paymentForm.paymentType,
        amount,
        paymentMethodId: paymentForm.paymentMethodId,
        paymentDate: new Date(paymentForm.paymentDate),
        reference: paymentForm.reference.trim() || null,
        notes: paymentForm.notes.trim() || null,
      },
      {
        onSuccess: (res) => {
          if (!res.success) {
            toast.error(res.error);
            return;
          }
          setPaymentForm((prev) => ({
            ...prev,
            amount: "",
            reference: "",
            notes: "",
            paymentDate: format(new Date(), "yyyy-MM-dd"),
          }));
          void refetch();
        },
      },
    );
  }

  function normalizeCostAmountInput(value: string): string {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned.length === 0) return "";
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return "";
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
          else setRemarkBody("");
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
      toast.error(parsed.error.issues[0]?.message ?? "Invalid alert payload");
      return;
    }

    alertMutation.mutate(parsed.data, {
      onSuccess: (res) => {
        if (!res.success) toast.error(res.error);
      },
      onError: () => toast.error("Failed to publish alert"),
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
              router.push("/projects");
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
                "border text-[10px] uppercase",
                isProjectStatus(proj.status)
                  ? statusBadgeTone(proj.status)
                  : "border-gray-500/35 bg-gray-500/10 text-gray-200",
              )}
            >
              {proj.status.replace("_", " ")}
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
              Linked quote{" "}
              <Link
                href={`/quotations/${proj.quotation.id}`}
                className="text-solar hover:underline"
              >
                {proj.quotation.quoteNumber}
              </Link>
            </p>
          ) : null}
        </div>

        <ProjectStateRail
          currentStatus={proj.status}
          isAdmin={isAdmin}
          isPending={updateProjectMutation.isPending || markCompleteMutation.isPending}
          onTransition={(status: ProjectStatus) => {
            updateProjectMutation.mutate({ id, status });
          }}
          onMarkCompleted={() => {
            checkOutstandingMutation.mutate(id, {
              onSuccess: (res) => {
                if (res.success && res.data.willWarn) {
                  setCompletionOutstanding(res.data.outstanding);
                  setCompletionDialogOpen(true);
                } else {
                  markCompleteMutation.mutate(id);
                }
              },
              onError: () => {
                markCompleteMutation.mutate(id);
              },
            });
          }}
        />
      </div>

      {proj.status === "completed" ? <CompletedProjectVouchers projectId={proj.id} /> : null}

      <ProjectTimeline project={proj} />

      <div className="space-y-6">
        <div className="bg-muted/50 border-border/70 flex h-auto flex-wrap gap-3 rounded-4xl border p-3">
          {(["overview", "costs", "remarks", "warranty"] as ProjectTab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveProjectTab(item)}
              className={[
                "rounded-full px-5 py-3 text-[10px] font-bold uppercase transition-colors",
                activeProjectTab === item
                  ? "border border-amber-500/65 bg-amber-500/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </div>

        {activeProjectTab === "overview" && (
          <div className="space-y-6">
            {proj.hasMissingInventoryConsumption ? (
              <div className="bg-amber-500/15 border-amber-500/50 text-amber-200 mb-6 flex items-center gap-3 rounded-4xl border px-6 py-4 text-sm font-semibold">
                <span className="text-xl">⚠️</span>
                Warning: This project has quoted materials (e.g. panels, inverters) but no inventory
                has been consumed yet. Profitability may be overstated.
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-card border-border rounded-3xl border px-7 py-6">
                <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase">
                  Quoted total
                </p>
                <p className="font-mono text-3xl tracking-tighter">
                  {formatMMK(proj.profitability.quotedRevenue)}
                </p>
              </div>
              <div className="bg-card border-border rounded-3xl border px-7 py-6">
                <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase">
                  Invoiced revenue
                </p>
                <p className="font-mono text-3xl tracking-tighter text-emerald-300">
                  {formatMMK(proj.profitability.invoicedRevenue)}
                </p>
              </div>
              <div className="bg-card border-border rounded-3xl border px-7 py-6">
                <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase">
                  Collected amount
                </p>
                <p className="font-mono text-3xl tracking-tighter">
                  {formatMMK(proj.profitability.receivedPayment)}
                </p>
              </div>
              <div className="bg-card border-border rounded-3xl border px-7 py-6">
                <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase">
                  Open AR
                </p>
                <p
                  className={cn(
                    "font-mono text-3xl tracking-tighter",
                    proj.profitability.outstandingReceivable > 0 ? "text-amber-300" : "",
                  )}
                >
                  {formatMMK(proj.profitability.outstandingReceivable)}
                </p>
              </div>
            </div>

            <div className="bg-card border-border rounded-3xl border p-7 mt-6">
              <p className="text-muted-foreground mb-5 text-[10px] font-bold uppercase">
                Project profitability
              </p>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Invoiced Revenue</p>
                  <p className="font-mono text-base text-emerald-300">
                    {formatMMK(proj.profitability.invoicedRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Inventory used</p>
                  <p className="font-mono text-base text-rose-400">
                    −{formatMMK(proj.profitability.inventoryConsumedCost)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Other costs</p>
                  <p className="font-mono text-base text-amber-300">
                    −{formatMMK(proj.profitability.additionalCosts)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Net profit</p>
                  <p
                    className={cn(
                      "font-mono text-base font-bold",
                      proj.profitability.netProfit !== null && proj.profitability.netProfit >= 0
                        ? "text-emerald-300"
                        : "text-rose-400",
                    )}
                  >
                    {proj.profitability.netProfit !== null
                      ? formatMMK(proj.profitability.netProfit)
                      : "—"}
                    <span className="text-muted-foreground ml-2 text-[10px] font-normal">
                      (
                      {proj.profitability.netMarginPercent !== null
                        ? `${proj.profitability.netMarginPercent}%`
                        : "—"}
                      )
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border-border rounded-3xl border p-7">
              <p className="text-muted-foreground mb-5 text-[10px] font-bold uppercase">
                Payment receive
              </p>
              <div className="mb-5 grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Quoted</p>
                  <p className="font-mono text-base">
                    {formatMMK(proj.profitability.quotedRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Received</p>
                  <p className="font-mono text-base">
                    {formatMMK(proj.profitability.receivedPayment)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Outstanding</p>
                  <p className="font-mono text-base text-amber-300">
                    {formatMMK(proj.profitability.outstandingReceivable)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase">Records</p>
                  <p className="font-mono text-base">{paymentRows.length}</p>
                </div>
              </div>
              <form className="grid gap-3 md:grid-cols-6" onSubmit={handleSubmitPayment}>
                <Select
                  value={paymentForm.paymentType}
                  onValueChange={(v: PaymentType) => {
                    setPaymentForm((prev) => ({ ...prev, paymentType: v }));
                  }}
                >
                  <SelectTrigger className="md:col-span-1">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="md:col-span-1"
                  placeholder="Amount (MMK)"
                  value={paymentForm.amount}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: normalizeCostAmountInput(e.target.value),
                    }));
                  }}
                />
                <Select
                  value={paymentForm.paymentMethodId}
                  onValueChange={(v) => {
                    setPaymentForm((prev) => ({ ...prev, paymentMethodId: v }));
                  }}
                >
                  <SelectTrigger className="md:col-span-1">
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="md:col-span-1"
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }));
                  }}
                />
                <Input
                  className="md:col-span-1"
                  placeholder="Reference"
                  value={paymentForm.reference}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, reference: e.target.value }));
                  }}
                />
                <Button
                  className="md:col-span-1"
                  type="submit"
                  disabled={recordPaymentMutation.isPending || proj.status === "cancelled"}
                >
                  {recordPaymentMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Receive
                </Button>
                <Textarea
                  className="md:col-span-6"
                  placeholder="Payment note"
                  value={paymentForm.notes}
                  onChange={(e) => {
                    setPaymentForm((prev) => ({ ...prev, notes: e.target.value }));
                  }}
                />
              </form>
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              <motion.div variants={staggerContainer} animate="animate">
                <div className="bg-card border-border space-y-5 rounded-4xl border p-6">
                  <h3 className="text-muted-foreground text-[10px] font-bold uppercase">
                    Site briefing
                  </h3>
                  <p className="text-foreground text-sm leading-relaxed">{proj.siteAddress}</p>
                  <p className="text-muted-foreground text-[11px]">
                    Started ·{" "}
                    {proj.startDate ? format(new Date(proj.startDate), "MMM dd, yyyy") : "TBD"} ·
                    Planned wrap{" "}
                    {proj.targetCompletion
                      ? format(new Date(proj.targetCompletion), "MMM dd yyyy")
                      : "floating"}
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
          </div>
        )}

        {activeProjectTab === "costs" && (
          <div className="space-y-8">
            {canEditOperational ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-3">
                  {COST_FILTERS.map((chip) => (
                    <Button
                      key={chip}
                      variant={costFilter === chip ? "secondary" : "outline"}
                      className={cn(
                        "rounded-full text-[11px] tracking-wide uppercase",
                        costFilter === chip && "border-amber-500/50 bg-amber-500/10",
                      )}
                      onClick={() => {
                        setCostFilter(chip);
                      }}
                    >
                      {chip}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setConsumeOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Consume inventory
                  </Button>
                  <Button
                    className="rounded-full"
                    onClick={() => {
                      setCostOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add cost
                  </Button>
                </div>
                <Sheet open={consumeOpen} onOpenChange={setConsumeOpen}>
                  <SheetContent className="sm:max-w-md">
                    <form onSubmit={handleSubmitConsume} className="space-y-8">
                      <SheetHeader>
                        <SheetTitle>Consume inventory to project</SheetTitle>
                      </SheetHeader>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label>Inventory item</Label>
                          <Select
                            value={consumeForm.inventoryItemId}
                            onValueChange={(v: string) => {
                              setConsumeForm((s) => ({ ...s, inventoryItemId: v }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select inventory item" />
                            </SelectTrigger>
                            <SelectContent>
                              {inventoryOptions.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} · Stock {item.stockQty}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            required
                            value={consumeForm.quantity}
                            onChange={(e) => {
                              setConsumeForm((s) => ({ ...s, quantity: e.target.value }));
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            required
                            value={consumeForm.description}
                            onChange={(e) => {
                              setConsumeForm((s) => ({ ...s, description: e.target.value }));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Incurred date</Label>
                          <Input
                            type="date"
                            required
                            value={consumeForm.incurredDate}
                            onChange={(e) => {
                              setConsumeForm((s) => ({ ...s, incurredDate: e.target.value }));
                            }}
                          />
                        </div>
                      </div>
                      <SheetFooter>
                        <Button
                          type="submit"
                          className="w-full rounded-2xl"
                          disabled={consumeInventoryMutation.isPending}
                        >
                          {consumeInventoryMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Consume inventory
                        </Button>
                      </SheetFooter>
                    </form>
                  </SheetContent>
                </Sheet>
                <Sheet open={costOpen} onOpenChange={setCostOpen}>
                  <SheetContent className="sm:max-w-md">
                    <form onSubmit={handleSubmitCost} className="space-y-8">
                      <SheetHeader>
                        <SheetTitle>Register site spend</SheetTitle>
                      </SheetHeader>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label>Paid via</Label>
                          <Select
                            value={costForm.paymentMethodId}
                            onValueChange={(v: string) => {
                              setCostForm((s) => ({
                                ...s,
                                paymentMethodId: v,
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="payment source" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method.id} value={method.id}>
                                  {method.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                              <SelectItem value="misc">Everything else</SelectItem>
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

            <div className="bg-card border-border rounded-4xl border p-6">
              <p className="text-muted-foreground mb-10 text-[10px] font-bold uppercase">
                Ledger composition
              </p>
              <div className="border-border/70 mb-14 flex h-7 overflow-hidden rounded-full border shadow-inner">
                {(Object.entries(costBuckets) as [keyof typeof costBuckets, number][]).map(
                  ([key, value]) =>
                    costSumAgg > 0 ? (
                      <div
                        key={key}
                        style={{
                          width: `${(value / Math.max(costSumAgg, 1)) * 100}%`,
                        }}
                        className={cn(
                          "transition-[width] duration-700",
                          key === "material" && "bg-amber-400/95",
                          key === "labor" && "bg-emerald-400/95",
                          key === "transport" && "bg-indigo-500/85",
                          key === "misc" && "bg-zinc-500/95",
                          key === "general" && "bg-cyan-500/85",
                        )}
                      />
                    ) : null,
                )}
              </div>

              <div className="space-y-3">
                {filteredCosts.map((cost) => {
                  const isReversed = cost.isReversed;
                  return (
                    <motion.div key={cost.id} variants={staggerItem}>
                      <div
                        className={cn(
                          "bg-muted/35 border-border/70 flex gap-5 rounded-[1.75rem] border px-6 py-4 text-sm hover:border-emerald-300/65",
                          isReversed && "opacity-50 grayscale",
                        )}
                      >
                        <div className="flex-1 space-y-1">
                          <p
                            className={cn(
                              "text-base font-semibold",
                              isReversed && "line-through text-muted-foreground",
                            )}
                          >
                            {cost.description}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Recorded {format(new Date(cost.incurredDate), "MMM dd yyyy · HH:mm")}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className="h-fit text-[11px]" variant="outline">
                            {cost.costType}
                          </Badge>
                          {isReversed && (
                            <Badge
                              className="h-fit text-[10px] border-rose-500/50 text-rose-300 bg-rose-500/10"
                              variant="outline"
                            >
                              Reversed
                            </Badge>
                          )}
                        </div>
                        <p
                          className={cn(
                            "font-mono text-lg",
                            isReversed && "line-through text-muted-foreground",
                          )}
                        >
                          {formatMMK(Number(cost.amount))}
                        </p>
                        {canEditOperational && !isReversed ? (
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
                  );
                })}
                {filteredCosts.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    Quiet ledger — tap “Add cost” for your first disbursement entry.
                  </p>
                ) : null}
              </div>
              <div className="text-muted-foreground mt-10 grid gap-4 text-[11px] uppercase md:grid-cols-3">
                <div>
                  Quoted{" "}
                  <div className="font-mono text-base text-emerald-200">{formatMMK(quoted)}</div>
                </div>
                <div>
                  Actual{" "}
                  <div className="font-mono text-base text-emerald-200">
                    {formatMMK(proj.actualTotalComputed)}
                  </div>
                </div>
                <div>
                  Delta{" "}
                  <div
                    className={cn(
                      "font-mono text-base",
                      proj.actualTotalComputed <= quoted ? "text-emerald-200" : "text-rose-400",
                    )}
                  >
                    {formatMMK(proj.actualTotalComputed - quoted)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeProjectTab === "remarks" && (
          <div className="space-y-6">
            {canEditOperational ? (
              <form
                className="bg-card border-border space-y-6 rounded-4xl border p-6"
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
              <p className="text-muted-foreground text-sm">Conversation thread is archived.</p>
            )}

            <ScrollArea className="bg-card border-border h-[520px] rounded-4xl border p-6">
              <div className="space-y-4 pr-6">
                {proj.remarks.map((remark, idx) => (
                  <motion.div
                    key={remark.id}
                    variants={staggerItem}
                    custom={idx}
                    className="bg-muted/35 border-border/70 rounded-3xl border p-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="mb-3 flex justify-between gap-3 text-[11px] uppercase">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{REMARK_TYPE_ICONS[remark.remarkType]}</span>
                        <Badge variant="secondary" className="text-[9px] uppercase">
                          {remark.remarkType}
                        </Badge>
                        <span className="text-muted-foreground font-semibold">
                          {remark.author?.name ?? "Team member"}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(remark.createdAt), "MMM d yyyy · hh:mm")}
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
          </div>
        )}

        {activeProjectTab === "warranty" && (
          <div className="space-y-6">
            <div className="bg-card border-border flex flex-wrap items-center justify-between gap-4 rounded-4xl border px-8 py-6">
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
                        <SelectItem value="warranty_expiry">Warranty expiry</SelectItem>
                        <SelectItem value="maintenance_due">Preventive upkeep</SelectItem>
                        <SelectItem value="follow_up">Client follow-through</SelectItem>
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
                    "bg-card rounded-[1.75rem] border p-6",
                    alert.isResolved
                      ? "border-border/50 opacity-65"
                      : new Date(alert.dueDate) < new Date()
                        ? "border-red-400/65"
                        : "border-amber-500/65",
                  )}
                >
                  <div className="mb-4 flex justify-between gap-3">
                    <Badge variant="outline" className="text-[11px]">
                      {alert.alertType.replace("_", " ")}
                    </Badge>
                    <Checkbox
                      id={`resolved-${alert.id}`}
                      checked={alert.isResolved}
                      disabled={busyAlertId === alert.id}
                      onCheckedChange={(val) => {
                        if (val === "indeterminate") return;
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

                  <p className="text-foreground text-sm font-medium">{alert.description}</p>
                  <p className="text-muted-foreground mt-6 text-[12px]">
                    {!alert.isResolved ? (
                      <span className="font-semibold text-amber-200">
                        Pulse ·{" "}
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
          </div>
        )}

        {/* Completion Confirmation Dialog */}
        <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Project with Outstanding Balance?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-muted-foreground text-sm">
                This project has an outstanding balance of{" "}
                <span className="text-foreground font-semibold">
                  {formatMMK(completionOutstanding)}
                </span>{" "}
                in Accounts Receivable.
              </p>
              <p className="text-muted-foreground text-sm">
                You can still record payments after completion. The receivable aging clock will
                start from the completion date.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCompletionDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                className="solar-cta"
                disabled={markCompleteMutation.isPending}
                onClick={() => {
                  setCompletionDialogOpen(false);
                  markCompleteMutation.mutate(id);
                }}
              >
                {markCompleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Complete Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
