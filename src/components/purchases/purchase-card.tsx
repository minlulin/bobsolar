"use client";

import { format } from "date-fns";
import { FileText, PackageCheck, PackageOpen } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PurchaseOrderListRow } from "@/hooks/use-purchases";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/domain/purchase";
import { formatMMK } from "@/lib/utils";

interface PurchaseCardProps {
  purchase: PurchaseOrderListRow;
}

export const PurchaseCard = React.memo(function PurchaseCard({
  purchase,
}: PurchaseCardProps): React.JSX.Element {
  const router = useRouter();
  const detailHref = `/purchases/${purchase.id}`;

  const isDraft = purchase.status === "draft";
  const isReceived = purchase.status === "received";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group border-border bg-muted/25 hover:bg-muted/45 relative cursor-pointer transition-colors"
        role="button"
        tabIndex={0}
        onClick={() => router.push(detailHref)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(detailHref);
          }
        }}
      >
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-fuchsia-100 text-fuchsia-600 rounded-lg p-2.5">
                {isDraft ? (
                  <PackageOpen className="h-5 w-5" />
                ) : (
                  <PackageCheck className="h-5 w-5" />
                )}
              </div>

              <div>
                <h3 className="font-heading text-foreground text-sm font-semibold tracking-tight">
                  {purchase.poNumber}
                </h3>
                <p className="text-muted-foreground text-xs">{purchase.supplier?.name}</p>
              </div>
            </div>

            <Badge
              variant={isDraft ? "outline" : "default"}
              className={isReceived ? "bg-emerald-500 hover:bg-emerald-600" : ""}
            >
              {PURCHASE_ORDER_STATUS_LABELS[purchase.status] || purchase.status}
            </Badge>
          </div>

          <div className="bg-background/50 border-border/50 rounded-xl border p-3 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Total Amount
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatMMK(parseFloat(purchase.totalAmount))}
              </p>
            </div>

            <div className="text-right space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                Balance Due
              </p>
              <p className="text-sm font-semibold text-rose-500">
                {formatMMK(parseFloat(purchase.balanceDue))}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {purchase.items?.length || 0} items
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(purchase.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
