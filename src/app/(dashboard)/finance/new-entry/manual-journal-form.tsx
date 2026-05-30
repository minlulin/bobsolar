"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { LedgerAccountOption } from "@/actions/manual-journal-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateManualJournalEntry,
  useLedgerAccountOptions,
  useProjectOptions,
} from "@/hooks/use-manual-journal";
import { formatMMK } from "@/lib/utils";
import type { ManualJournalInput } from "@/lib/validators/manual-journal";

interface ManualJournalFormProps {
  initialAccounts: LedgerAccountOption[];
  initialProjects: { id: string; projectNumber: string }[];
}

interface JournalLine {
  id: string;
  accountCode: string;
  debit: string;
  credit: string;
  memo: string;
}

const SOURCE_TYPE_OPTIONS = [
  { value: "manual_adjustment", label: "Manual Adjustment" },
  { value: "opening_balance", label: "Opening Balance" },
  { value: "backfill", label: "Historical Backfill" },
];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-rose-100 text-rose-700",
  equity: "bg-purple-100 text-purple-700",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-amber-100 text-amber-700",
};

export function ManualJournalForm({
  initialAccounts,
  initialProjects,
}: ManualJournalFormProps): React.JSX.Element {
  const router = useRouter();
  const createMutation = useCreateManualJournalEntry();
  const { data: accountsData, isLoading: isLoadingAccounts } = useLedgerAccountOptions();
  const { data: projectsData, isLoading: isLoadingProjects } = useProjectOptions();

  const accounts = accountsData ?? initialAccounts;
  const projects = projectsData ?? initialProjects;

  const [entryDate, setEntryDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0] ?? "";
  });
  const [memo, setMemo] = useState<string>("");
  const [sourceType, setSourceType] = useState<string>("manual_adjustment");
  const [projectId, setProjectId] = useState<string>("none");
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), accountCode: "", debit: "", credit: "", memo: "" },
    { id: crypto.randomUUID(), accountCode: "", debit: "", credit: "", memo: "" },
  ]);

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), accountCode: "", debit: "", credit: "", memo: "" },
    ]);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.id !== id) : prev));
  }, []);

  const updateLine = useCallback((id: string, field: keyof JournalLine, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = { ...line, [field]: value };

        if (field === "debit" && value && parseFloat(value) > 0) {
          updated.credit = "";
        } else if (field === "credit" && value && parseFloat(value) > 0) {
          updated.debit = "";
        }

        return updated;
      }),
    );
  }, []);

  const totalDebit = lines.reduce((sum, line) => {
    const val = parseFloat(line.debit);
    return sum + (Number.isNaN(val) ? 0 : Math.round(val));
  }, 0);

  const totalCredit = lines.reduce((sum, line) => {
    const val = parseFloat(line.credit);
    return sum + (Number.isNaN(val) ? 0 : Math.round(val));
  }, 0);

  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const hasInvalidLines = lines.some(
    (line) =>
      !line.accountCode ||
      ((!line.debit || parseFloat(line.debit) <= 0) &&
        (!line.credit || parseFloat(line.credit) <= 0)) ||
      (line.debit && parseFloat(line.debit) > 0 && line.credit && parseFloat(line.credit) > 0),
  );

  const canSubmit =
    isBalanced && !hasInvalidLines && memo.trim().length > 0 && entryDate.length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!canSubmit) return;

      const data: ManualJournalInput = {
        entryDate: entryDate || new Date().toISOString().split("T")[0] || "",
        memo: memo.trim(),
        sourceType: sourceType as "manual_adjustment" | "opening_balance" | "backfill",
        projectId: projectId && projectId !== "none" ? projectId : null,
        lines: lines
          .filter((line) => line.accountCode)
          .map((line) => ({
            accountCode: line.accountCode as ManualJournalInput["lines"][number]["accountCode"],
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
            memo: line.memo || undefined,
          })),
      };

      createMutation.mutate(data, {
        onSuccess: (result) => {
          if (result.success) {
            router.push("/finance/ledger");
          }
        },
      });
    },
    [canSubmit, entryDate, memo, sourceType, projectId, lines, createMutation, router],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/finance/ledger">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            New Journal Entry
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a manual journal entry for adjustments, opening balances, or historical backfill.
          </p>
        </div>
      </div>

      {/* Entry Details */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Entry Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Entry Date *</Label>
              <Input
                id="entry-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-type">Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger id="source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="project">Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {isLoadingProjects ? (
                    <div className="p-2">
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="memo">Memo *</Label>
              <Textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Describe the purpose of this journal entry..."
                maxLength={500}
                required
              />
              <p className="text-muted-foreground text-xs">{memo.length}/500 characters</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Lines */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Journal Lines</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              disabled={lines.length >= 20}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Line Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
              <div className="col-span-4">Account</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-3">Line Memo</div>
              <div className="col-span-1"></div>
            </div>

            {/* Lines */}
            {lines.map((line) => (
              <JournalLineRow
                key={line.id}
                line={line}
                accounts={accounts}
                isLoadingAccounts={isLoadingAccounts}
                onUpdate={updateLine}
                onRemove={() => removeLine(line.id)}
                canRemove={lines.length > 2}
              />
            ))}
          </div>

          {/* Totals */}
          <div className="border-border mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Total Debit:</span>
                  <span className="text-emerald-600 text-sm font-semibold tabular-nums">
                    {formatMMK(totalDebit)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Total Credit:</span>
                  <span className="text-rose-600 text-sm font-semibold tabular-nums">
                    {formatMMK(totalCredit)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Balanced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Unbalanced
                  </Badge>
                )}
              </div>
            </div>

            {totalDebit !== totalCredit && totalDebit > 0 && (
              <p className="text-amber-600 mt-2 text-xs">
                Difference: {formatMMK(Math.abs(totalDebit - totalCredit))}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Create Journal Entry
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface JournalLineRowProps {
  line: JournalLine;
  accounts: LedgerAccountOption[];
  isLoadingAccounts: boolean;
  onUpdate: (id: string, field: keyof JournalLine, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function JournalLineRow({
  line,
  accounts,
  isLoadingAccounts,
  onUpdate,
  onRemove,
  canRemove,
}: JournalLineRowProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4">
        <Select
          {...(line.accountCode ? { value: line.accountCode } : {})}
          onValueChange={(v) => onUpdate(line.id, "accountCode", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingAccounts
              ? Array.from({ length: 5 }).map(() => (
                  <div key={crypto.randomUUID()} className="p-2">
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))
              : accounts.map((acc) => (
                  <SelectItem key={acc.code} value={acc.code}>
                    <div className="flex items-center gap-2">
                      <span>{acc.name}</span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-[10px] ${ACCOUNT_TYPE_COLORS[acc.type] ?? ""}`}
                      >
                        {acc.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2">
        <Input
          type="number"
          placeholder="0"
          min="0"
          step="1"
          value={line.debit}
          onChange={(e) => onUpdate(line.id, "debit", e.target.value)}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-2">
        <Input
          type="number"
          placeholder="0"
          min="0"
          step="1"
          value={line.credit}
          onChange={(e) => onUpdate(line.id, "credit", e.target.value)}
          className="text-right tabular-nums"
        />
      </div>

      <div className="col-span-3">
        <Input
          placeholder="Optional memo"
          value={line.memo}
          onChange={(e) => onUpdate(line.id, "memo", e.target.value)}
        />
      </div>

      <div className="col-span-1 flex items-center justify-center pt-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          className="h-8 w-8 text-muted-foreground hover:text-rose-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
