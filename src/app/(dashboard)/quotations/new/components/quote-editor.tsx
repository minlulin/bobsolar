"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, Loader2, Save, Send, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AddServiceMenu } from "./add-service-menu";
import { CustomerSelector } from "./customer-selector";
import { InventorySearch } from "./inventory-search";
import { QuoteItems } from "./quote-items";
import { QuoteSummary } from "./quote-summary";

const QuotePreview = dynamic(() => import("./quote-preview").then((mod) => mod.QuotePreview), {
  ssr: false,
  loading: () => (
    <div className="border-border/60 bg-muted/20 flex aspect-[1/1.414] w-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      <p className="text-muted-foreground mt-2 text-[10px] font-bold tracking-wider uppercase">
        Loading Live Preview...
      </p>
    </div>
  ),
});

import { motion } from "motion/react";
import {
  createQuotation,
  deleteQuotation,
  updateQuotation,
  updateQuotationStatus,
} from "@/actions/quotation-actions";
import { useQuoteAutosave } from "@/hooks/use-quote-autosave";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

interface QuoteEditorProps {
  mode: "create" | "edit";
  quotationId?: string;
  initialQuoteNumber?: string;
  defaultNotes?: string | undefined;
  serverUpdatedAt?: Date | null;
}

export function QuoteEditor({
  mode,
  quotationId,
  initialQuoteNumber,
  defaultNotes,
  serverUpdatedAt = null,
}: QuoteEditorProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectedCustomerId = useQuoteBuilderStore((s) => s.selectedCustomerId);
  const items = useQuoteBuilderStore((s) => s.items);
  const discountPercent = useQuoteBuilderStore((s) => s.discountPercent);
  const taxPercent = useQuoteBuilderStore((s) => s.taxPercent);
  const notes = useQuoteBuilderStore((s) => s.notes);
  const validUntil = useQuoteBuilderStore((s) => s.validUntil);
  const quotationDate = useQuoteBuilderStore((s) => s.quotationDate);
  const reset = useQuoteBuilderStore((s) => s.reset);

  const snapshot = React.useMemo(
    () => ({
      customerId: selectedCustomerId,
      items,
      discountPercent,
      taxPercent,
      notes,
      validUntil,
      quotationDate,
    }),
    [selectedCustomerId, items, discountPercent, taxPercent, notes, validUntil, quotationDate],
  );

  const {
    autosaveStatus,
    lastSavedAt,
    restoreCandidate,
    serverDraftId,
    restoreDraft,
    discardDraft,
    clearAutosave,
  } = useQuoteAutosave({
    mode,
    ...(quotationId ? { quotationId } : {}),
    serverUpdatedAt,
    snapshot,
  });

  React.useEffect(() => {
    if (mode === "create") {
      reset();
      if (defaultNotes) {
        useQuoteBuilderStore.setState({ notes: defaultNotes });
      }
    }
  }, [mode, reset, defaultNotes]);

  const handleSave = (status: "draft" | "sent" = "draft"): void => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (mode === "edit" && !quotationId) {
      toast.error("Missing quotation ID");
      return;
    }

    startTransition((): void => {
      void (async (): Promise<void> => {
        const data = {
          customerId: selectedCustomerId,
          items: items.map((item) => ({
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercentage: item.discountPercentage,
            sortOrder: item.sortOrder,
          })),
          discountPercent,
          taxPercent,
          notes,
          validUntil,
          quotationDate,
        };

        const effectiveId = serverDraftId ?? quotationId ?? "";
        const isCreatePath = mode === "create" && !serverDraftId;
        const res = isCreatePath
          ? await createQuotation(data)
          : await updateQuotation(effectiveId, data);

        if (res.success) {
          if (status === "sent") {
            await updateQuotationStatus(res.data.id, "sent");
          }

          toast.success(
            isCreatePath
              ? status === "sent"
                ? "Quotation sent successfully"
                : "Quotation created"
              : "Quotation updated",
          );
          clearAutosave();
          reset();
          router.push("/quotations");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      })();
    });
  };

  const handleDeleteDraft = (): void => {
    if (mode !== "edit" || !quotationId) return;
    startTransition((): void => {
      void (async (): Promise<void> => {
        const res = await deleteQuotation(quotationId);
        if (res.success) {
          toast.success("Draft deleted successfully");
          clearAutosave();
          reset();
          router.replace("/quotations");
          router.refresh();
        } else {
          toast.error(res.error || "Failed to delete draft");
        }
      })();
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 pb-32">
      {restoreCandidate && (
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recover unsaved quotation draft?</AlertDialogTitle>
              <AlertDialogDescription>
                {restoreCandidate.message} Last local save was{" "}
                {formatDistanceToNow(new Date(restoreCandidate.savedAt), { addSuffix: true })}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={discardDraft}>Discard Local Draft</AlertDialogCancel>
              <AlertDialogAction onClick={restoreDraft}>Restore Draft</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={() => {
              router.back();
            }}
            className="hover:bg-muted/45 rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-foreground text-2xl font-black tracking-tight uppercase italic">
              {mode === "create" ? "New" : "Edit"} <span className="text-amber-500">Quotation</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "create"
                ? "Build a professional solar proposal"
                : `Editing ${initialQuoteNumber}`}
            </p>
            <p className="text-muted-foreground/80 mt-1 text-xs">
              {autosaveStatus === "saving" && "Autosave: Saving..."}
              {autosaveStatus === "saved" &&
                `Autosave: Saved ${lastSavedAt ? formatDistanceToNow(new Date(lastSavedAt), { addSuffix: true }) : ""}`}
              {autosaveStatus === "offline" && "Autosave: Offline - local only"}
              {autosaveStatus === "error" && "Autosave: Sync pending"}
              {autosaveStatus === "idle" && "Autosave: Ready"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {mode === "edit" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isPending}
                  className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Draft
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete draft quotation?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteDraft}>Delete Draft</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            variant="outline"
            onClick={() => {
              handleSave("draft");
            }}
            disabled={isPending}
            className="border-border/70 bg-muted/45 hover:bg-muted/55 transition-all"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mode === "create" ? "Save Draft" : "Update Draft"}
          </Button>
          <Button
            onClick={() => {
              handleSave("sent");
            }}
            disabled={isPending}
            className="text-foreground bg-linear-to-r from-amber-500 to-orange-600 px-6 font-bold shadow-lg shadow-amber-500/20 transition-all hover:from-amber-600 hover:to-orange-700"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {mode === "create" ? "Review & Send" : "Update & Send"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        {/* Editor Pane */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          {/* Customer Section */}
          <div className="border-border/60 bg-muted/30 space-y-6 rounded-2xl border p-6">
            <CustomerSelector />
          </div>

          {/* Items Section */}
          <div className="border-border/60 bg-muted/30 space-y-6 rounded-2xl border p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
                  Line Items
                </h3>
                <p className="text-muted-foreground/70 mt-1 text-xs">
                  Note: Internal labor costs should be logged in Project Execution.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AddServiceMenu />
                <InventorySearch />
              </div>
            </div>

            <QuoteItems />

            <QuoteSummary />
          </div>
        </motion.div>

        {/* Preview Pane */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block"
        >
          <QuotePreview />
        </motion.div>
      </div>
    </div>
  );
}
