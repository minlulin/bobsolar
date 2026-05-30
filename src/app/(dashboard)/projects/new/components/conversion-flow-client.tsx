"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConvertToProject } from "@/hooks/use-projects";

import { useQuotation } from "@/hooks/use-quotations";
import type { Customer, Quotation } from "@/lib/db/schema";

type QuotationDraft = Quotation & {
  customer: Customer;
  project: { id: string } | null;
};

function defaultInstallationSite(quotation: QuotationDraft): string {
  const parts = [quotation.customer.address, quotation.customer.city]
    .map((fragment) => (fragment ?? "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

function QuotationConversionForm({
  quoteId,
  quotation,
}: {
  quoteId: string;
  quotation: QuotationDraft;
}): React.JSX.Element | null {
  const router = useRouter();
  const convertProject = useConvertToProject();

  const [siteAddress, setSiteAddress] = React.useState(() => defaultInstallationSite(quotation));
  const [systemSize, setSystemSize] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (quotation.project) {
      router.replace(`/projects/${quotation.project.id}`);
    }
  }, [quotation.project, router]);

  if (quotation.project) return null;

  function handleSubmit(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    convertProject.mutate(
      {
        quotationId: quoteId,
        siteAddress,
        systemSizeKwp: systemSize ? Number(systemSize) : undefined,
        notes,
      },
      {
        onSuccess: (res) => {
          if (res.success) {
            router.replace(`/projects/${res.data.id}`);
          }
        },
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border bg-card mx-auto max-w-3xl rounded-2xl border p-10 shadow-lg"
    >
      <div className="mb-10 space-y-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
            Approved Quotation
          </div>
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            {quotation.quoteNumber}
          </span>
        </div>
        <h1 className="font-heading text-primary text-4xl font-black tracking-tighter uppercase">
          Initialize Project
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          Transitioning client{" "}
          <span className="text-primary font-bold">{quotation.customer.name}</span> to technical
          planning phase.
        </p>
      </div>

      <div className="grid gap-8">
        <div className="space-y-3">
          <Label className="text-primary text-[10px] font-bold tracking-widest uppercase">
            Installation Site Address
          </Label>
          <Textarea
            rows={3}
            className="border-border bg-muted/20 focus:bg-background rounded-xl transition-colors"
            value={siteAddress}
            onChange={(e) => {
              setSiteAddress(e.target.value);
            }}
            required
            placeholder="Confirm the exact site location for the solar infrastructure..."
          />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-primary text-[10px] font-bold tracking-widest uppercase">
              Target System Capacity (kWp)
            </Label>
            <Input
              placeholder="E.g. 10.50"
              type="number"
              step={0.01}
              className="border-border bg-muted/20 h-12 rounded-xl"
              value={systemSize}
              onChange={(e) => {
                setSystemSize(e.target.value);
              }}
              onBlur={() => {
                if (systemSize && !Number.isNaN(Number(systemSize))) {
                  setSystemSize(Number(systemSize).toFixed(2));
                }
              }}
            />
          </div>

          <div className="col-span-full space-y-3">
            <Label className="text-primary text-[10px] font-bold tracking-widest uppercase">
              Technical Brief / Project Notes
            </Label>
            <Textarea
              rows={4}
              className="border-border bg-muted/20 focus:bg-background rounded-xl"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              placeholder="Additional logistics or hardware requirements for the installation team..."
            />
          </div>
        </div>

        <div className="border-border flex items-center justify-end gap-4 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-primary rounded-xl px-6 font-bold"
            onClick={() => {
              router.back();
            }}
          >
            Cancel Initialization
          </Button>
          <Button
            className="bg-accent hover:bg-accent/90 shadow-accent/20 h-14 rounded-xl px-10 text-lg font-black tracking-tight text-white shadow-xl"
            disabled={convertProject.isPending || !siteAddress.trim()}
            type="submit"
          >
            {convertProject.isPending ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null}
            Commence Project
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ConversionFlow(): React.JSX.Element | null {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId");

  const { data: quotation, isFetching, error, isError } = useQuotation(quoteId ?? "");

  if (!quoteId) {
    return (
      <div className="border-border bg-card mx-auto max-w-2xl rounded-2xl border p-12 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="bg-muted/30 rounded-full p-4">
            <Loader2 className="text-muted-foreground h-8 w-8 opacity-20" />
          </div>
        </div>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed font-medium">
          Project initialization must be triggered from an accepted quotation detail page.
        </p>
        <Button
          asChild
          className="bg-primary shadow-primary/20 h-12 rounded-xl px-8 font-bold text-white shadow-lg"
        >
          <Link href="/quotations">Return to Quotations</Link>
        </Button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="text-accent h-12 w-12 animate-spin" />
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.2em] uppercase">
          Synchronizing Pipeline...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center">
        <p className="mb-4 font-bold text-red-500">
          {error instanceof Error ? error.message : "System synchronization error."}
        </p>
        <Button
          asChild
          variant="outline"
          className="rounded-xl border-red-500/20 hover:bg-red-500/10"
        >
          <Link href={`/quotations/${quoteId}`}>Return to Quotation</Link>
        </Button>
      </div>
    );
  }

  if (!quotation) return null;

  if (quotation.status !== "accepted") {
    return (
      <div className="border-border bg-card mx-auto max-w-2xl rounded-2xl border p-12 text-center shadow-sm">
        <h3 className="text-primary mb-2 text-xl font-black tracking-tighter uppercase">
          Status Restricted
        </h3>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed font-medium">
          This project gate only opens once the quotation status has been finalized to{" "}
          <span className="font-bold text-emerald-500 uppercase">Accepted</span>.
        </p>
        <Button asChild className="bg-primary rounded-xl font-bold">
          <Link href={`/quotations/${quoteId}`}>Return to Details</Link>
        </Button>
      </div>
    );
  }

  return <QuotationConversionForm key={quotation.id} quoteId={quoteId} quotation={quotation} />;
}
