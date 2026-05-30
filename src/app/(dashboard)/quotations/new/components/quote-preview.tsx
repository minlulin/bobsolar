"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, MapPin, Phone } from "lucide-react";
import { getCustomer } from "@/actions/customer-actions";
import { useQuoteTotals } from "@/hooks/use-quote-totals";
import { getInventoryCategoryLabel } from "@/lib/domain/inventory";
import { customerKeys } from "@/lib/query-keys";
import { formatMMK } from "@/lib/utils";
import { groupQuotationItems } from "@/lib/utils/quotation-grouping";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

export function QuotePreview(): React.JSX.Element {
  const {
    selectedCustomerId,
    items,
    discountPercent,
    taxPercent,
    notes,
    validUntil,
    quotationDate,
  } = useQuoteBuilderStore();
  const totals = useQuoteTotals();

  const { data: customerRes } = useQuery({
    queryKey: customerKeys.detail(selectedCustomerId || ""),
    queryFn: () => getCustomer(selectedCustomerId || ""),
    enabled: !!selectedCustomerId,
  });

  const customer = customerRes?.success ? customerRes.data : null;

  const displayItems = groupQuotationItems(items);

  return (
    <div className="sticky top-8 h-fit">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <FileText className="text-primary h-4 w-4" />
          <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Document Preview
          </h3>
        </div>
        <div className="bg-primary/5 text-primary rounded-full px-2 py-0.5 text-[8px] font-bold uppercase">
          Drafting Mode
        </div>
      </div>

      <div className="border-border/40 flex aspect-[1/1.414] w-full flex-col overflow-hidden rounded-2xl bg-white p-10 text-[10px] text-zinc-950 shadow-2xl ring-1 ring-zinc-200/50">
        {/* Document Branding */}
        <div className="mb-8 flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-xs font-black text-white">BS</span>
              </div>
              <span className="text-primary text-lg font-black tracking-tighter uppercase">
                BOB Solar
              </span>
            </div>
            <p className="text-muted-foreground text-[8px] leading-relaxed font-medium tracking-tighter uppercase">
              Energy Infrastructure & Installation
              <br />
              Premium Service Division
            </p>
          </div>
          <div className="space-y-1 text-right">
            <h2 className="text-3xl font-black tracking-tighter text-zinc-200 uppercase">
              Quotation
            </h2>
            <div className="flex flex-col gap-0.5">
              <p className="text-primary font-bold">QT-2026-####</p>
              <p className="text-muted-foreground font-medium">
                {format(quotationDate ?? new Date(), "MMMM dd, yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Client & Metadata */}
        <div className="mb-10 grid grid-cols-2 gap-12">
          <div className="space-y-3">
            <h4 className="border-primary/20 text-primary border-b pb-1 text-[7px] font-bold tracking-widest uppercase">
              Project For
            </h4>
            <div className="space-y-1">
              <p className="text-primary text-sm font-black">{customer?.name || "---"}</p>
              <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Phone className="text-accent h-2.5 w-2.5" />
                <span>{customer?.phone || "---"}</span>
              </div>
              <div className="text-muted-foreground flex items-start gap-1.5 font-medium">
                <MapPin className="text-accent mt-0.5 h-2.5 w-2.5" />
                <span className="max-w-[150px]">
                  {customer?.address ? `${customer.address}, ${customer.city}` : "---"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-right">
            <h4 className="border-primary/20 text-primary border-b pb-1 text-right text-[7px] font-bold tracking-widest uppercase">
              Terms
            </h4>
            <div className="space-y-1">
              <p className="text-[9px] font-bold uppercase">Validity Period</p>
              <p className="text-muted-foreground font-medium">
                Valid Until {validUntil ? format(validUntil, "MMM dd, yyyy") : "---"}
              </p>
              <div className="bg-accent/10 text-accent mt-2 inline-block px-2 py-0.5 text-[7px] font-bold uppercase">
                Solar Infrastructure Proposal
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-primary/10 border-b-2">
                <th className="text-muted-foreground py-3 text-left text-[7px] font-bold tracking-widest uppercase">
                  Description
                </th>
                <th className="text-muted-foreground py-3 text-center text-[7px] font-bold tracking-widest uppercase">
                  Qty
                </th>
                <th className="text-muted-foreground py-3 text-right text-[7px] font-bold tracking-widest uppercase">
                  Unit Price
                </th>
                <th className="text-muted-foreground py-3 text-right text-[7px] font-bold tracking-widest uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {displayItems.map((item, i) => (
                <tr key={item.id ?? item.itemId ?? `${item.description}-${i}`}>
                  <td className="py-4">
                    {item.category ? (
                      <p className="text-accent mb-0.5 text-[7px] font-bold tracking-widest uppercase">
                        {getInventoryCategoryLabel(item.category)}
                      </p>
                    ) : null}
                    <p className="text-primary font-bold">{item.description}</p>
                  </td>
                  <td className="py-4 text-center font-medium text-zinc-500">{item.quantity}</td>
                  <td className="py-4 text-right font-medium text-zinc-500">
                    {formatMMK(Number(item.unitPrice))}
                  </td>
                  <td className="text-primary py-4 text-right font-black">
                    {formatMMK(Number(item.quantity) * Number(item.unitPrice))}
                  </td>
                </tr>
              ))}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-16 text-center font-medium text-zinc-300 italic">
                    Select inventory items to generate proposal lines
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="mt-10 flex justify-end">
          <div className="w-56 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[7px] font-bold tracking-widest uppercase">
                Subtotal
              </span>
              <span className="text-primary font-bold">{formatMMK(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex items-center justify-between text-red-600">
                <span className="text-[7px] font-bold tracking-widest uppercase">
                  Incentive ({discountPercent}%)
                </span>
                <span className="font-bold">-{formatMMK(totals.discountAmount)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-[7px] font-bold tracking-widest uppercase">
                  Taxation ({taxPercent}%)
                </span>
                <span className="font-bold">+{formatMMK(totals.taxAmount)}</span>
              </div>
            )}
            <div className="border-primary border-t-2 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-primary text-[9px] font-black tracking-tighter uppercase">
                  Proposal Total
                </span>
                <span className="text-primary text-xl font-black tracking-tighter">
                  {formatMMK(totals.total)}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-right text-[6px] font-medium tracking-tight uppercase">
                All prices in Myanmar Kyat (MMK)
              </p>
            </div>
          </div>
        </div>

        {/* Terms & Signature */}
        <div className="mt-auto flex items-end justify-between border-t border-zinc-100 pt-10">
          <div className="space-y-2">
            <p className="text-primary text-[8px] font-black tracking-widest uppercase">
              Terms & Conditions
            </p>
            <p className="text-muted-foreground max-w-[280px] text-[7px] leading-relaxed font-medium">
              {notes ||
                "This quotation is subject to technical site survey. Hardware availability is confirmed upon acceptance. 50% downpayment required for project initiation."}
            </p>
          </div>
          <div className="space-y-4 text-right">
            <div className="border-primary/20 ml-auto h-12 w-32 border-b-2"></div>
            <p className="text-primary text-[8px] font-black tracking-widest uppercase">
              Authorized Signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
