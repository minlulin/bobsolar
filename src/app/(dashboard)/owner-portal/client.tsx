"use client";

import { format } from "date-fns";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  HandCoins,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

import { type getOwnerPortalData, payCapitalCallAction, requestOwnerDrawAction } from "./actions";

type OwnerPortalData = Awaited<ReturnType<typeof getOwnerPortalData>>;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

export function OwnerPortalClient({ data }: { data: OwnerPortalData }) {
  const router = useRouter();
  const [activeOwnerId, setActiveOwnerId] = useState(data.owners[0]?.id);

  // Modals state
  const [drawModalOpen, setDrawModalOpen] = useState(false);
  const [capitalCallModalOpen, setCapitalCallModalOpen] = useState(false);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeOwner = data.owners.find((o) => o.id === activeOwnerId);

  const fmt = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MMK",
      maximumFractionDigits: 0,
    }).format(val);

  async function handleDrawSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeOwner) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const amount = parseFloat(formData.get("amount") as string);
      const accountCode = formData.get("paymentAssetAccountCode") as string;

      await requestOwnerDrawAction(activeOwner.id, amount, accountCode);
      toast.success("Draw requested and logged in the ledger.");
      setDrawModalOpen(false);
      router.refresh();
    } catch (_error) {
      toast.error("Failed to request draw");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCapitalCallSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeTxId) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const accountCode = formData.get("paymentAssetAccountCode") as string;

      await payCapitalCallAction(activeTxId, accountCode);
      toast.success("Capital call payment recorded successfully.");
      setCapitalCallModalOpen(false);
      setActiveTxId(null);
      router.refresh();
    } catch (_error) {
      toast.error("Failed to record capital call payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-full w-full bg-background overflow-hidden selection:bg-solar/30">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-solar/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[150px] pointer-events-none" />

      <div className="relative flex flex-col space-y-12 w-full max-w-[1400px] mx-auto px-6 py-12 md:px-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8"
        >
          <div className="relative">
            <div className="absolute -left-6 top-2 h-full w-1 bg-gradient-to-b from-solar to-transparent hidden md:block" />
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tighter text-foreground leading-[1.1]">
              Capital <br />
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground">
                Reserves
              </span>
            </h1>
          </div>
          <div className="max-w-md text-muted-foreground text-lg leading-relaxed font-light">
            An elegant, single source of truth for corporate equity, dividend distributions, and
            shareholder capital allocations.
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          <motion.div variants={itemVariants} className="md:col-span-8">
            <div className="premium-glass rounded-[2rem] p-8 md:p-12 h-full relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-solar/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                <div className="flex justify-between items-start">
                  <Badge
                    variant="outline"
                    className="px-4 py-1.5 rounded-full border-primary/20 bg-background/50 backdrop-blur-md text-sm font-medium tracking-wide"
                  >
                    Company Retained Earnings
                  </Badge>
                  <Landmark className="w-8 h-8 text-solar/50" />
                </div>
                <div>
                  <h2 className="text-5xl md:text-7xl font-semibold tracking-tighter text-foreground">
                    {fmt(data.retainedEarningsBalance)}
                  </h2>
                  <div className="flex items-center gap-3 mt-4 text-muted-foreground font-medium">
                    <Activity className="w-5 h-5 text-solar" />
                    <span>Global Reserve Pool (10% Allocation)</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="md:col-span-4">
            <div className="premium-glass rounded-[2rem] p-8 md:p-10 h-full flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all duration-700" />
              <div className="relative z-10">
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                  YTD Net Income
                </p>
                <div className="text-4xl font-bold tracking-tight mb-2">
                  {fmt(data.ytdNetIncome)}
                </div>
                <div className="flex items-center text-sm font-medium text-green-600 dark:text-green-400 mt-2 bg-green-500/10 w-fit px-3 py-1 rounded-full">
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  +14% Projected
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {data.owners.length > 0 ? (
          <div className="mt-16 relative">
            <h3 className="text-2xl font-light tracking-tight mb-8">Shareholder Portfolios</h3>

            <div className="flex flex-wrap gap-3 mb-10">
              {data.owners.map((owner) => {
                const isActive = activeOwnerId === owner.id;
                return (
                  <button
                    type="button"
                    key={owner.id}
                    onClick={() => setActiveOwnerId(owner.id)}
                    className={`relative px-6 py-3 rounded-full text-base font-medium transition-all duration-300 outline-none ${
                      isActive ? "text-background shadow-lg" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-foreground rounded-full -z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${isActive ? "bg-background" : "bg-solar"}`}
                      />
                      {owner.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {activeOwner && (
                <motion.div
                  key={activeOwner.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                      <div className="surface-panel rounded-3xl p-8 relative overflow-hidden border-t-4 border-t-solar">
                        <div className="absolute top-4 right-4 text-6xl font-black text-muted/20 select-none">
                          {activeOwner.ownershipPercentage}%
                        </div>
                        <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                          Available Draw
                        </h4>
                        <div className="text-5xl font-bold tracking-tighter text-foreground mb-8">
                          {fmt(activeOwner.availableDraw)}
                        </div>
                        <Button
                          size="lg"
                          onClick={() => setDrawModalOpen(true)}
                          className="w-full rounded-2xl h-14 text-lg font-medium solar-cta group relative overflow-hidden"
                          disabled={activeOwner.availableDraw <= 0}
                        >
                          <span className="relative z-10 flex items-center justify-center">
                            <Wallet className="mr-2 h-5 w-5 group-hover:-rotate-12 transition-transform" />
                            Request Draw
                          </span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="surface-panel-muted rounded-[2rem] p-6">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            YTD Draws
                          </p>
                          <p className="text-2xl font-bold">{fmt(activeOwner.ytdDraws)}</p>
                        </div>
                        <div className="surface-panel-muted rounded-[2rem] p-6">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Capital
                          </p>
                          <p className="text-2xl font-bold">
                            {fmt(activeOwner.capitalContributed)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 premium-glass rounded-[2rem] p-8 md:p-10 flex flex-col">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-2xl font-semibold tracking-tight">Ledger History</h4>
                        <Badge variant="secondary" className="rounded-full px-4 font-mono text-xs">
                          {activeOwner.transactions.length} Records
                        </Badge>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar min-h-[300px]">
                        {activeOwner.transactions.length > 0 ? (
                          activeOwner.transactions.map((tx, idx) => (
                            <motion.div
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              key={tx.id}
                              className="group flex items-center justify-between p-5 rounded-2xl bg-background/40 hover:bg-background/80 border border-transparent hover:border-border/50 transition-all duration-300"
                            >
                              <div className="flex items-center gap-5">
                                <div
                                  className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 ${
                                    tx.transactionType === "distribution"
                                      ? "bg-green-500/10 text-green-600"
                                      : tx.transactionType === "draw"
                                        ? "bg-orange-500/10 text-orange-600"
                                        : tx.transactionType === "capital_call_issued"
                                          ? "bg-destructive/10 text-destructive"
                                          : "bg-blue-500/10 text-blue-600"
                                  }`}
                                >
                                  {tx.transactionType === "distribution" ? (
                                    <ArrowDownRight className="w-6 h-6" />
                                  ) : tx.transactionType === "draw" ? (
                                    <ArrowUpRight className="w-6 h-6" />
                                  ) : tx.transactionType === "capital_call_issued" ? (
                                    <HandCoins className="w-6 h-6" />
                                  ) : (
                                    <Landmark className="w-6 h-6" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-lg font-semibold capitalize tracking-tight">
                                    {tx.transactionType.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-sm text-muted-foreground font-medium">
                                    {format(new Date(tx.transactionDate), "MMMM dd, yyyy")}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <p className="text-xl font-bold tracking-tight">
                                  {fmt(Number(tx.amount))}
                                </p>
                                {tx.status === "pending" &&
                                tx.transactionType === "capital_call_issued" ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-xs px-3 rounded-full"
                                    onClick={() => {
                                      setActiveTxId(tx.id);
                                      setCapitalCallModalOpen(true);
                                    }}
                                  >
                                    Pay Now
                                  </Button>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] uppercase tracking-widest font-bold border-none ${
                                      tx.status === "completed"
                                        ? "bg-green-500/10 text-green-600"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {tx.status}
                                  </Badge>
                                )}
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 opacity-60">
                            <Landmark className="w-16 h-16 mb-4 stroke-[1]" />
                            <p className="text-lg font-light">
                              No ledger entries found for this owner.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Draw Request Modal */}
                  <Dialog open={drawModalOpen} onOpenChange={setDrawModalOpen}>
                    <DialogContent className="sm:max-w-md premium-glass border-none p-0 overflow-hidden shadow-2xl">
                      <div className="p-8">
                        <DialogHeader className="mb-6">
                          <div className="w-12 h-12 rounded-full bg-solar/20 flex items-center justify-center mb-4 text-solar">
                            <Wallet className="w-6 h-6" />
                          </div>
                          <DialogTitle className="text-3xl font-light">
                            Request <span className="font-semibold">Draw</span>
                          </DialogTitle>
                          <DialogDescription className="text-base text-muted-foreground mt-2">
                            Withdraw funds from your available distribution balance.
                          </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleDrawSubmit} className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                                Amount
                              </Label>
                              <span className="text-xs font-semibold text-green-500">
                                Max: {fmt(activeOwner.availableDraw)}
                              </span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                Ks
                              </span>
                              <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                max={activeOwner.availableDraw}
                                min="1"
                                placeholder="0.00"
                                required
                                className="h-14 text-xl font-medium pl-12 bg-background/50 border-white/10 rounded-xl"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                              Destination Asset Account
                            </Label>
                            <Select name="paymentAssetAccountCode" required>
                              <SelectTrigger className="h-12 bg-background/50 border-white/10 rounded-lg">
                                <SelectValue placeholder="Select Bank/Asset" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash_on_hand">Cash on Hand</SelectItem>
                                <SelectItem value="kbz_banking">KBZ Bank</SelectItem>
                                <SelectItem value="aya_banking">AYA Bank</SelectItem>
                                <SelectItem value="cb_banking">CB Bank</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full h-12 rounded-xl text-base font-semibold solar-cta"
                          >
                            {isSubmitting ? "Processing..." : "Confirm Draw"}
                          </Button>
                        </form>
                      </div>
                    </DialogContent>
                  </Dialog>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="premium-glass p-16 text-center rounded-[3rem] mt-12 flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <Landmark className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-3xl font-light tracking-tight mb-2">No Ownership Data</h3>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Shareholder profiles have not been formally initialized in the ledger.
            </p>
          </div>
        )}
      </div>

      {/* Capital Call Payment Modal */}
      <Dialog open={capitalCallModalOpen} onOpenChange={setCapitalCallModalOpen}>
        <DialogContent className="sm:max-w-md premium-glass border-none p-0 overflow-hidden shadow-2xl">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-4 text-destructive">
                <HandCoins className="w-6 h-6" />
              </div>
              <DialogTitle className="text-3xl font-light">
                Pay <span className="font-semibold">Capital Call</span>
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground mt-2">
                Deposit funds to cover an issued capital call requirement.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCapitalCallSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  Source Asset Account
                </Label>
                <Select name="paymentAssetAccountCode" required>
                  <SelectTrigger className="h-12 bg-background/50 border-white/10 rounded-lg">
                    <SelectValue placeholder="Select Funding Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash_on_hand">Cash on Hand</SelectItem>
                    <SelectItem value="kbz_banking">KBZ Bank</SelectItem>
                    <SelectItem value="aya_banking">AYA Bank</SelectItem>
                    <SelectItem value="cb_banking">CB Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl text-base font-semibold"
              >
                {isSubmitting ? "Processing..." : "Submit Payment"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

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
