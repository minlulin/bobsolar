"use client";

import { format } from "date-fns";
import { CheckCircle2, Clock, Plus, Receipt, Sparkles, WalletCards } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ActionData } from "@/lib/utils/action-response";
import { type getExpensesData, submitGeneralExpense } from "./actions";

type ExpensesData = ActionData<Awaited<ReturnType<typeof getExpensesData>>>;

const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, filter: "blur(4px)" },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { ease: "easeOut" as const, duration: 0.4 },
  },
};

export function ExpensesClient({ data }: { data: ExpensesData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaid, setIsPaid] = useState(true);

  const fmt = (val: string | number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MMK",
      maximumFractionDigits: 0,
    }).format(Number(val));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      if (!isPaid) {
        formData.delete("paymentMethodId");
        formData.delete("paymentAssetAccountCode");
      }

      await submitGeneralExpense(formData);

      toast.success("Expense recorded successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to record expense");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalYTD = data.expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="relative min-h-full w-full bg-background overflow-hidden selection:bg-primary/30 pb-20">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-background via-background/80 to-transparent z-[1] pointer-events-none" />

      <div className="relative z-10 flex flex-col w-full max-w-7xl mx-auto px-6 py-12 md:px-12 md:py-16">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Badge
                variant="outline"
                className="px-3 py-1 bg-background border-border/50 text-xs tracking-widest uppercase font-semibold"
              >
                Ledger Operations
              </Badge>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-foreground leading-tight">
              Operating <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground font-light italic">
                Expenses
              </span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-6 bg-card/60 backdrop-blur-xl border border-border/50 p-6 rounded-[2rem] shadow-2xl w-full md:w-auto"
          >
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-1">
                YTD Expenses
              </p>
              <p className="text-3xl font-bold tracking-tight">{fmt(totalYTD)}</p>
            </div>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  size="lg"
                  className="h-16 px-8 rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-all shadow-lg group"
                >
                  <Plus className="mr-2 h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
                  <span className="text-lg font-semibold">Record</span>
                </Button>
              </SheetTrigger>

              <SheetContent className="sm:max-w-2xl border-l-0 shadow-[0_0_100px_rgba(0,0,0,0.1)] p-0 flex flex-col bg-background/95 backdrop-blur-3xl">
                <div className="px-8 py-10 bg-muted/30 border-b relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                  <SheetHeader className="text-left relative z-10">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <SheetTitle className="text-4xl font-light tracking-tight">
                      New <span className="font-semibold">Expense</span>
                    </SheetTitle>
                    <SheetDescription className="text-base mt-2">
                      Securely log an operational transaction into the primary ledger.
                    </SheetDescription>
                  </SheetHeader>
                </div>

                <form
                  onSubmit={onSubmit}
                  className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar"
                >
                  <div className="space-y-3">
                    <Label
                      htmlFor="payeeName"
                      className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                    >
                      Payee / Vendor
                    </Label>
                    <Input
                      id="payeeName"
                      name="payeeName"
                      placeholder="e.g. Acme Corp Supplies"
                      required
                      className="h-14 text-lg bg-card border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label
                        htmlFor="amount"
                        className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                      >
                        Total Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                          Ks
                        </span>
                        <Input
                          id="amount"
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          required
                          className="h-14 text-xl font-medium pl-12 bg-card border-border/50 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="expenseDate"
                        className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                      >
                        Transaction Date
                      </Label>
                      <Input
                        id="expenseDate"
                        name="expenseDate"
                        type="date"
                        defaultValue={format(new Date(), "yyyy-MM-dd")}
                        required
                        className="h-14 bg-card border-border/50 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label
                      htmlFor="expenseAccountCode"
                      className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                    >
                      Ledger Category
                    </Label>
                    <Select name="expenseAccountCode" required>
                      <SelectTrigger className="h-14 bg-card border-border/50 rounded-xl text-lg">
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {data.expenseAccounts.map((acc) => (
                          <SelectItem
                            key={acc.code}
                            value={acc.code}
                            className="py-3 cursor-pointer"
                          >
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/40 p-6 rounded-2xl border border-border/50 space-y-6">
                    <div className="flex flex-col space-y-4">
                      <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                        Settlement Status
                      </Label>
                      <div className="flex bg-background/50 rounded-xl p-1 border border-border/50 shadow-inner">
                        <button
                          type="button"
                          onClick={() => setIsPaid(true)}
                          className={`flex-1 py-3 text-sm rounded-lg transition-all flex justify-center items-center gap-2 ${isPaid ? "bg-background shadow font-semibold" : "text-muted-foreground font-medium hover:text-foreground"}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Paid Immediately
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPaid(false)}
                          className={`flex-1 py-3 text-sm rounded-lg transition-all flex justify-center items-center gap-2 ${!isPaid ? "bg-background shadow font-semibold" : "text-muted-foreground font-medium hover:text-foreground"}`}
                        >
                          <Clock className="w-4 h-4" />
                          Accrue Liability
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isPaid && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="grid grid-cols-2 gap-4 overflow-hidden"
                        >
                          <div className="space-y-3">
                            <Label
                              htmlFor="paymentMethodId"
                              className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground"
                            >
                              Method
                            </Label>
                            <Select name="paymentMethodId" required={isPaid}>
                              <SelectTrigger className="h-12 bg-card rounded-lg">
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                              <SelectContent>
                                {data.paymentMethods.map((pm) => (
                                  <SelectItem key={pm.id} value={pm.id}>
                                    {pm.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-3">
                            <Label
                              htmlFor="paymentAssetAccountCode"
                              className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground"
                            >
                              Source Asset
                            </Label>
                            <Select name="paymentAssetAccountCode" required={isPaid}>
                              <SelectTrigger className="h-12 bg-card rounded-lg">
                                <SelectValue placeholder="Asset Account" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash_on_hand">Cash on Hand</SelectItem>
                                <SelectItem value="kbz_banking">KBZ Bank</SelectItem>
                                <SelectItem value="aya_banking">AYA Bank</SelectItem>
                                <SelectItem value="cb_banking">CB Bank</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-3">
                    <Label
                      htmlFor="reference"
                      className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                    >
                      Receipt / Ref #
                    </Label>
                    <Input
                      id="reference"
                      name="reference"
                      placeholder="Optional"
                      className="h-14 bg-card border-border/50 rounded-xl"
                    />
                  </div>

                  <div className="space-y-3 pb-8">
                    <Label
                      htmlFor="notes"
                      className="text-xs uppercase tracking-widest font-bold text-muted-foreground"
                    >
                      Context Notes
                    </Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Additional details..."
                      className="bg-card border-border/50 rounded-xl resize-none text-base p-4"
                      rows={3}
                    />
                  </div>
                </form>

                <div className="p-6 bg-background border-t">
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-xl text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg transition-transform active:scale-[0.98]"
                    disabled={isSubmitting}
                    onClick={(e) => {
                      const form = e.currentTarget
                        .closest(".sm\\:max-w-2xl")
                        ?.querySelector("form");
                      if (form) form.requestSubmit();
                    }}
                  >
                    {isSubmitting ? "Committing to Ledger..." : "Commit Transaction"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </motion.div>
        </div>

        {/* Ledger List */}
        <div className="premium-glass rounded-[2rem] overflow-hidden p-2">
          {data.expenses.length > 0 ? (
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-2"
            >
              {/* Table Header equivalent */}
              <div className="grid grid-cols-12 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">
                <div className="col-span-2 hidden md:block">Date</div>
                <div className="col-span-12 md:col-span-5">Transaction Entity</div>
                <div className="col-span-4 md:col-span-2 hidden md:block">Classification</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>

              {/* List Items */}
              {data.expenses.map((expense) => (
                <motion.div
                  key={expense.id}
                  variants={itemVariants}
                  className="group grid grid-cols-12 items-center p-4 md:px-6 rounded-2xl hover:bg-background/80 transition-all duration-300 border border-transparent hover:border-border/50 hover:shadow-sm"
                >
                  <div className="col-span-2 hidden md:block text-sm text-muted-foreground font-medium">
                    {expense.expenseDate
                      ? format(new Date(expense.expenseDate), "MMM dd, yyyy")
                      : "N/A"}
                  </div>

                  <div className="col-span-9 md:col-span-5 flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        expense.isPaid
                          ? "bg-muted/50 text-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          : "bg-orange-500/10 text-orange-600"
                      }`}
                    >
                      {expense.isPaid ? (
                        <Receipt className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold tracking-tight">{expense.payeeName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {!expense.isPaid && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase border-orange-500/30 text-orange-600 bg-orange-500/5 px-1.5 py-0"
                          >
                            Accrued
                          </Badge>
                        )}
                        {expense.reference && (
                          <span className="text-xs text-muted-foreground font-mono">
                            #{expense.reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 hidden md:flex items-center">
                    <Badge variant="secondary" className="bg-muted/50 font-normal">
                      {expense.account?.name || "Uncategorized"}
                    </Badge>
                  </div>

                  <div className="col-span-3 text-right flex flex-col items-end justify-center">
                    <span className="text-xl md:text-2xl font-bold tracking-tight">
                      {fmt(expense.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground md:hidden mt-1">
                      {expense.expenseDate
                        ? format(new Date(expense.expenseDate), "MMM dd")
                        : "N/A"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <WalletCards className="w-10 h-10 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-2xl font-light tracking-tight text-foreground">
                Pristine Ledger
              </h3>
              <p className="text-muted-foreground mt-2 max-w-sm">
                No operating expenses have been recorded yet. Click the button above to begin
                tracking.
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.4);
        }
      `}</style>
    </div>
  );
}
