"use client";

import { format } from "date-fns";
import { ArrowLeft, Banknote, Loader2, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePaymentMethods } from "@/hooks/use-payments";
import type { PurchaseOrderDetail } from "@/hooks/use-purchases";
import {
  usePayPurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
} from "@/hooks/use-purchases";
import { formatMMK } from "@/lib/utils";

export default function PurchaseDetailPage({
  purchaseId,
}: {
  purchaseId: string;
}): React.JSX.Element {
  const { data: purchase, isLoading } = usePurchaseOrder(purchaseId);
  const { mutate: receivePO, isPending: isReceiving } = useReceivePurchaseOrder();
  const { mutate: payPO, isPending: isPaying } = usePayPurchaseOrder();
  const { data: methods } = usePaymentMethods();

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!purchase) {
    return <div>PO Not found</div>;
  }

  const isDraft = purchase.status === "draft";
  const isReceived = purchase.status === "received";
  type PurchaseItem = NonNullable<PurchaseOrderDetail["items"]>[number];
  type PurchasePayment = NonNullable<PurchaseOrderDetail["payments"]>[number];

  const handleReceive = () => {
    if (
      confirm(
        "Are you sure you want to receive this PO? This will increase warehouse stock and recognize the liability.",
      )
    ) {
      receivePO(purchaseId);
    }
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    payPO(
      {
        purchaseOrderId: purchaseId,
        amount: Number(paymentAmount),
        paymentMethodId,
        notes: paymentNotes,
      },
      {
        onSuccess: () => setIsPaymentOpen(false),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/purchases">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold">{purchase.poNumber}</h1>
            <Badge
              variant={isDraft ? "outline" : "default"}
              className={isReceived ? "bg-emerald-500" : ""}
            >
              {isDraft ? "Draft" : "Received"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Created on {format(new Date(purchase.createdAt), "PPP")} by {purchase.supplier?.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              onClick={handleReceive}
              disabled={isReceiving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isReceiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackageCheck className="mr-2 h-4 w-4" /> Receive Items
            </Button>
          )}

          {isReceived && parseFloat(purchase.balanceDue) > 0 && (
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Banknote className="mr-2 h-4 w-4" /> Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment to Supplier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePayment} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Amount (MMK)</Label>
                    <Input
                      type="number"
                      required
                      max={purchase.balanceDue}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Balance: {formatMMK(parseFloat(purchase.balanceDue))}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Source</Label>
                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {methods?.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isPaying} className="w-full">
                    {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Payment
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Item Description</th>
                      <th className="pb-3 font-medium text-right">Qty</th>
                      <th className="pb-3 font-medium text-right">Unit Price</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchase.items?.map((item: PurchaseItem) => (
                      <tr key={item.id} className="group">
                        <td className="py-4">
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.item?.name}</p>
                        </td>
                        <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-4 text-right tabular-nums">
                          {formatMMK(parseFloat(item.unitPrice))}
                        </td>
                        <td className="py-4 text-right font-medium tabular-nums">
                          {formatMMK(parseFloat(item.totalPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-base">
                      <td colSpan={3} className="py-4 text-right">
                        Total Amount:
                      </td>
                      <td className="py-4 text-right text-primary">
                        {formatMMK(parseFloat(purchase.totalAmount))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {purchase.payments?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchase.payments.map((payment: PurchasePayment) => (
                    <div
                      key={payment.id}
                      className="flex justify-between items-center p-3 border rounded-lg bg-muted/20"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          Paid via {payment.paymentMethod?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.paymentDate), "PPP p")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-rose-500">
                          {formatMMK(parseFloat(payment.amount))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{purchase.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Status</span>
                <span className="font-medium capitalize">{purchase.paymentStatus}</span>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{formatMMK(parseFloat(purchase.totalAmount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600">
                    {formatMMK(parseFloat(purchase.paidAmount))}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Balance Due</span>
                  <span className="text-rose-500">
                    {formatMMK(parseFloat(purchase.balanceDue))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supplier Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{purchase.supplier?.name}</p>
                {purchase.supplier?.companyName && (
                  <p className="text-sm text-muted-foreground">{purchase.supplier.companyName}</p>
                )}
              </div>
              <div className="text-sm space-y-1">
                {purchase.supplier?.phone && <p>{purchase.supplier.phone}</p>}
                {purchase.supplier?.email && <p>{purchase.supplier.email}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bill Date</span>
                <span className="font-medium">
                  {purchase.billDate ? format(new Date(purchase.billDate), "PPP") : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">
                  {purchase.dueDate ? format(new Date(purchase.dueDate), "PPP") : "-"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
