"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowRight, ArrowRightLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCashTransfer } from "@/hooks/use-cash-transfers";
import { CASH_ACCOUNT_CODES, LEDGER_ACCOUNT_LABELS } from "@/lib/domain/finance";
import { type CashTransferInput, cashTransferSchema } from "@/lib/validators/cash-transfer";

export function CashTransferClient(): React.JSX.Element {
  const router = useRouter();
  const { mutate: createTransfer, isPending } = useCreateCashTransfer();

  const form = useForm<CashTransferInput>({
    resolver: zodResolver(cashTransferSchema),
    defaultValues: {
      fromAccount: "kbz_banking",
      toAccount: "cash_on_hand",
      amount: 0,
      date: new Date(),
      reference: "",
      notes: "",
    },
  });

  const onSubmit = (data: CashTransferInput) => {
    createTransfer(data, {
      onSuccess: () => {
        router.push("/finance");
      },
    });
  };

  const fromAccount = form.watch("fromAccount");
  const toAccount = form.watch("toAccount");

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <BackButton />
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          Transfer Cash
        </h1>
        <p className="text-muted-foreground mt-1">
          Record a transfer between internal cash and bank accounts.
        </p>
      </div>

      <div className="bg-card border-border rounded-2xl border p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <FormField
                control={form.control}
                name="fromAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select origin account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CASH_ACCOUNT_CODES.map((code) => (
                          <SelectItem key={code} value={code} disabled={code === toAccount}>
                            {LEDGER_ACCOUNT_LABELS[code]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="hidden md:flex justify-center pb-2">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              <FormField
                control={form.control}
                name="toAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CASH_ACCOUNT_CODES.map((code) => (
                          <SelectItem key={code} value={code} disabled={code === fromAccount}>
                            {LEDGER_ACCOUNT_LABELS[code]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (MMK)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 500000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={
                          field.value
                            ? format(new Date(field.value as string | number | Date), "yyyy-MM-dd")
                            : ""
                        }
                        onChange={(e) =>
                          field.onChange(e.target.value ? new Date(e.target.value) : new Date())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference / Transaction ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. TR-99887766" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Details about this transfer..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 border-t pt-6">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Transfer
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
