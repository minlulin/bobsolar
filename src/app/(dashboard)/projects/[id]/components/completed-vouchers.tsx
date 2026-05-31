"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGenerateVoucher, useProjectVouchers } from "@/hooks/use-vouchers";
import { formatMMK } from "@/lib/utils";

export function CompletedProjectVouchers({ projectId }: { projectId: string }): React.JSX.Element {
  const { data: vouchers } = useProjectVouchers(projectId);
  const generateVoucherMutation = useGenerateVoucher();

  const [voucherType, setVoucherType] = React.useState<
    "completion_certificate" | "final_payment_voucher"
  >("completion_certificate");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [paidAmount, setPaidAmount] = React.useState("");

  return (
    <div className="bg-card border-border rounded-2xl border p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-[0.3em] uppercase">
            Project vouchers
          </p>
          <p className="text-muted-foreground text-[11px]">
            Generate completion certificates and payment handover documents.
          </p>
        </div>
      </div>

      <div className="border-border/50 mb-5 flex flex-wrap gap-3 border-b border-dashed pb-5">
        <Button
          variant={voucherType === "completion_certificate" ? "default" : "outline"}
          size="sm"
          className="rounded-full text-[10px] font-bold uppercase"
          onClick={() => {
            setVoucherType("completion_certificate");
          }}
        >
          Completion Certificate
        </Button>
        <Button
          variant={voucherType === "final_payment_voucher" ? "default" : "outline"}
          size="sm"
          className="rounded-full text-[10px] font-bold uppercase"
          onClick={() => {
            setVoucherType("final_payment_voucher");
          }}
        >
          Final Payment Voucher
        </Button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] tracking-wide uppercase">Total amount (MMK)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={totalAmount}
            onChange={(e) => {
              setTotalAmount(e.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] tracking-wide uppercase">Paid amount (MMK)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={paidAmount}
            onChange={(e) => {
              setPaidAmount(e.target.value);
            }}
          />
        </div>
      </div>

      <Button
        className="rounded-full text-[10px] font-bold uppercase"
        disabled={generateVoucherMutation.isPending || !totalAmount || !paidAmount}
        onClick={() => {
          generateVoucherMutation.mutate({
            projectId,
            voucherType,
            totalAmount: Math.round(Number(totalAmount)),
            paidAmount: Math.round(Number(paidAmount)),
          });
        }}
      >
        {generateVoucherMutation.isPending ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : null}
        Generate {voucherType === "completion_certificate" ? "Certificate" : "Voucher"}
      </Button>

      {vouchers && vouchers.length > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-muted-foreground text-[10px] font-bold uppercase">Issued vouchers</p>
          {vouchers.map((v) => (
            <div
              key={v.id}
              className="border-border/70 bg-muted/25 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{v.voucherNumber}</p>
                <p className="text-muted-foreground text-[10px] uppercase">
                  {v.voucherType.replace("_", " ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">{formatMMK(Number(v.totalAmount))}</span>
                <Button variant="outline" size="sm" className="rounded-full text-[10px]" asChild>
                  <a href={`/vouchers/${v.id}/pdf`} target="_blank" rel="noopener">
                    Print
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
