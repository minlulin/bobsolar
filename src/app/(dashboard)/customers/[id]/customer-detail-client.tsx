"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  Edit,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  Phone,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCustomer } from "@/hooks/use-customers";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn, formatMMK } from "@/lib/utils";

const CustomerDialog = dynamic(
  () => import("@/components/customers/customer-dialog").then((mod) => mod.CustomerDialog),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "overview" | "quotations" | "projects";

// ─── Tab button — matches Settings page pattern ───────────────────────────────
function TabButton({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-solar/50 bg-solar/8 text-foreground"
          : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
            active ? "bg-solar/25 text-solar" : "bg-muted/60 text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}): React.JSX.Element | null {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border/30 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-0.5">
          {label}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <p className="mt-6 mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
        {children}
      </p>
      <Separator className="mb-1 opacity-40" />
    </>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────
function Chip({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-muted/30 px-5 py-3.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
        {label}
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">{value}</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <Icon className="h-7 w-7 text-muted-foreground/30" />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted/60" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-muted/60" />
          <div className="h-3.5 w-28 rounded bg-muted/40" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["card-1", "card-2", "card-3"].map((key) => (
          <div key={key} className="h-16 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="flex gap-2">
        {["tab-1", "tab-2", "tab-3"].map((key) => (
          <div key={key} className="h-8 w-24 rounded-lg bg-muted/40" />
        ))}
      </div>
      <div className="space-y-4">
        {["row-1", "row-2", "row-3", "row-4"].map((key) => (
          <div key={key} className="h-12 rounded bg-muted/30" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function CustomerDetailClient({ id }: { id: string }): React.JSX.Element {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: customer, isLoading } = useCustomer(id);

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

  if (isLoading) return <Skeleton />;

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold">Customer not found</h2>
        <Button
          variant="link"
          onClick={() => router.push("/customers")}
          className="mt-3 text-muted-foreground"
        >
          Back to customers
        </Button>
      </div>
    );
  }

  const memberSince = format(new Date(customer.createdAt), "d MMM yyyy");
  const fullAddress = [customer.address, customer.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      {/* ── Back ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Customers
        </button>
      </motion.div>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-solar/30 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-solar/15 text-foreground font-bold text-lg">
              {initials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {customer.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {customer.phone}
              </span>
              {customer.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {customer.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditDialogOpen(true)}
          className="shrink-0 gap-1.5 border-border/60 text-muted-foreground hover:text-foreground"
        >
          <Edit className="h-3.5 w-3.5" />
          Edit
        </Button>
      </motion.div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        className="grid grid-cols-3 gap-3"
      >
        <Chip label="Member since" value={memberSince} />
        <Chip label="Quotations" value={customer.quotations.length} />
        <Chip label="Projects" value={customer.projects.length} />
      </motion.div>

      {/* ── Sub-tab bar — same pattern as Settings page ──────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex flex-wrap gap-2 rounded-xl border border-border/40 bg-muted/20 p-1.5"
      >
        <TabButton
          label="Overview"
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
        />
        <TabButton
          label="Quotations"
          active={activeTab === "quotations"}
          count={customer.quotations.length}
          onClick={() => setActiveTab("quotations")}
        />
        <TabButton
          label="Projects"
          active={activeTab === "projects"}
          count={customer.projects.length}
          onClick={() => setActiveTab("projects")}
        />
      </motion.div>

      {/* ── Tab content ───────────────────────────────────────── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="min-h-[28rem]"
      >
        {/* OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            <SectionLabel>Contact</SectionLabel>
            <Field icon={Phone} label="Phone" value={customer.phone} />
            {customer.email && <Field icon={Mail} label="Email" value={customer.email} />}
            {fullAddress && <Field icon={MapPin} label="Address" value={fullAddress} />}

            <SectionLabel>Notes</SectionLabel>
            <div className="py-4">
              {customer.notes ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {customer.notes}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground/50">No notes added.</p>
              )}
            </div>

            <SectionLabel>Quick Actions</SectionLabel>
            <div className="flex flex-col gap-2 py-4 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 gap-2 border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                onClick={() => router.push("/quotations/new")}
              >
                <Plus className="h-4 w-4" />
                New Quotation
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </div>
          </div>
        )}

        {/* QUOTATIONS ───────────────────────────────────────── */}
        {activeTab === "quotations" && (
          <div>
            {customer.quotations.length > 0 ? (
              <>
                <SectionLabel>
                  {customer.quotations.length} quotation
                  {customer.quotations.length !== 1 ? "s" : ""}
                </SectionLabel>
                {customer.quotations.map((quotation) => {
                  const config = STATUS_CONFIG[quotation.status];
                  const StatusIcon = config.icon;
                  return (
                    <Link
                      key={quotation.id}
                      href={`/quotations/${quotation.id}`}
                      className="group flex items-center gap-4 py-4 border-b border-border/30 last:border-0 -mx-2 px-2 rounded-lg transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {quotation.quoteNumber}
                          </span>
                          <Badge
                            className={cn(
                              "px-1.5 py-0 text-[10px] font-semibold border-0",
                              config.color,
                            )}
                          >
                            <StatusIcon className="mr-1 h-2.5 w-2.5" />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(quotation.createdAt), "d MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {formatMMK(parseFloat(quotation.total))}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </>
            ) : (
              <Empty
                icon={FileText}
                title="No quotations yet"
                description="Create a solar quotation for this customer to get started."
                action={
                  <Button
                    className="bg-solar text-foreground hover:bg-solar/90 gap-2"
                    onClick={() => router.push("/quotations/new")}
                  >
                    <Plus className="h-4 w-4" />
                    Create Quotation
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* PROJECTS ─────────────────────────────────────────── */}
        {activeTab === "projects" && (
          <div>
            {customer.projects.length > 0 ? (
              <>
                <SectionLabel>
                  {customer.projects.length} project{customer.projects.length !== 1 ? "s" : ""}
                </SectionLabel>
                {customer.projects.map((project) => {
                  const costTotal = project.costs.reduce(
                    (sum, c) => sum + Math.round(Number(c.amount)),
                    0,
                  );
                  const statusColorMap: Record<string, string> = {
                    planning: "bg-indigo-500/10 text-indigo-500",
                    in_progress: "bg-emerald-500/10 text-emerald-500",
                    installation_completed: "bg-teal-500/10 text-teal-500",
                    on_hold: "bg-amber-500/10 text-amber-500",
                    completed: "bg-emerald-500/10 text-emerald-600",
                    cancelled: "bg-rose-500/10 text-rose-500",
                  };
                  const statusColor =
                    statusColorMap[project.status] ?? "bg-muted/50 text-muted-foreground";

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group flex items-center gap-4 py-4 border-b border-border/30 last:border-0 -mx-2 px-2 rounded-lg transition-colors hover:bg-muted/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {project.projectNumber}
                          </span>
                          <Badge
                            className={cn(
                              "px-1.5 py-0 text-[10px] font-semibold border-0 capitalize",
                              statusColor,
                            )}
                          >
                            {project.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {Number(project.systemSizeKwp)} kWp
                          {project.quotation?.quoteNumber
                            ? ` · ${project.quotation.quoteNumber}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {costTotal > 0 && (
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatMMK(costTotal)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </>
            ) : (
              <Empty
                icon={FolderKanban}
                title="No active projects"
                description="Once a quotation is accepted, it can be converted into a project."
              />
            )}
          </div>
        )}
      </motion.div>

      {/* Edit Dialog */}
      {editDialogOpen && (
        <CustomerDialog
          customer={customer}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </div>
  );
}
