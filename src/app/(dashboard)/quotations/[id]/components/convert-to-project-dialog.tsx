"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConvertToProject } from "@/hooks/use-projects";

import type { Customer, Quotation } from "@/lib/db/schema";

type QuotationWithCustomer = Quotation & {
  customer: Customer;
  project?: { id: string } | null;
};

interface ConvertToProjectDialogProps {
  quotation: QuotationWithCustomer;
  children: React.ReactNode;
}

export function ConvertToProjectDialog({
  quotation,
  children,
}: ConvertToProjectDialogProps): React.JSX.Element | null {
  const router = useRouter();
  const convertProject = useConvertToProject();
  const [open, setOpen] = React.useState(false);

  const defaultSite = [quotation.customer.address, quotation.customer.city]
    .map((fragment) => (fragment ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const [siteAddress, setSiteAddress] = React.useState(defaultSite);
  const [systemSize, setSystemSize] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [depositRequired, setDepositRequired] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState("");

  // If project already exists, redirect to it
  React.useEffect(() => {
    if (quotation.project) {
      router.replace(`/projects/${quotation.project.id}`);
    }
  }, [quotation.project, router]);

  function handleSubmit(ev: React.SyntheticEvent): void {
    ev.preventDefault();
    convertProject.mutate(
      {
        quotationId: quotation.id,
        siteAddress,
        systemSizeKwp: systemSize ? Number(systemSize) : undefined,
        notes,
        depositRequired,
        depositAmount: depositRequired ? Number(depositAmount) : 0,
      },
      {
        onSuccess: (res) => {
          if (res.success) {
            setOpen(false);
            router.push(`/projects/${res.data.id}`);
          } else {
            toast.error(res.error);
          }
        },
        onError: () => {
          toast.error("Failed to convert quotation to project");
        },
      },
    );
  }

  if (quotation.project) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Initialize Project</DialogTitle>
            <DialogDescription>
              Convert approved quotation {quotation.quoteNumber} for{" "}
              <span className="font-semibold">{quotation.customer.name}</span> into an active
              project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="site-address">Installation Site Address</Label>
              <Textarea
                id="site-address"
                rows={2}
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                required
                placeholder="Confirm the exact site location..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="system-size">Target System Capacity (kWp)</Label>
              <Input
                id="system-size"
                type="number"
                step={0.01}
                min={0}
                placeholder="E.g. 10.50"
                value={systemSize}
                onChange={(e) => setSystemSize(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="deposit-required"
                checked={depositRequired}
                onCheckedChange={(checked) => setDepositRequired(!!checked)}
              />
              <Label htmlFor="deposit-required" className="cursor-pointer font-medium text-sm">
                Require deposit to start project
              </Label>
            </div>
            {depositRequired && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="deposit-amount">Deposit Amount (MMK)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="e.g. 500000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required={depositRequired}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Technical Brief / Project Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional logistics or hardware requirements..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={convertProject.isPending}>
              {convertProject.isPending ? "Converting..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
