"use client";

import { Loader2, RefreshCw, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface KeyStatus {
  label: string;
  available: boolean;
  cooldownRemainingMs: number;
}

interface KeyStatusResponse {
  keys: KeyStatus[];
  totalKeys: number;
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return "Available";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s cooldown`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s cooldown`;
}

export function ApiKeyStatusModal(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [keys, setKeys] = React.useState<KeyStatus[]>([]);
  const [totalKeys, setTotalKeys] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/key-status");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError("Admin access required");
          return;
        }
        setError(`Failed to fetch key status (${res.status})`);
        return;
      }
      const data: KeyStatusResponse = await res.json();
      setKeys(data.keys);
      setTotalKeys(data.totalKeys);
    } catch {
      setError("Network error — could not fetch key status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open, fetchStatus]);

  const availableCount = keys.filter((k) => k.available).length;
  const allAvailable = availableCount === totalKeys && totalKeys > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          API Key Status
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Gemini API Key Status
          </DialogTitle>
          <DialogDescription>
            {totalKeys > 0
              ? `${availableCount} of ${totalKeys} keys available`
              : "Loading key status..."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchStatus()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {/* Summary bar */}
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                allAvailable
                  ? "border-green-200 bg-green-50 text-green-800"
                  : availableCount > 0
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {allAvailable ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
              {allAvailable
                ? "All keys operational"
                : availableCount > 0
                  ? `${availableCount}/${totalKeys} keys available — failover active`
                  : "All keys on cooldown — requests will be rejected"}
            </div>

            {/* Key list */}
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.label}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                    key.available ? "border-border bg-card" : "border-amber-200 bg-amber-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        key.available ? "bg-green-500" : "bg-amber-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{key.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.available ? "Available" : formatCooldown(key.cooldownRemainingMs)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      key.available ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {key.available ? "Active" : "Cooldown"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter showCloseButton={false} className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => {
              fetchStatus(true);
              toast.success("Key status refreshed");
            }}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              Close
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
