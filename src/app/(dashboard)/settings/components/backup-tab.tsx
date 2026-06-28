"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  createBackup,
  deleteBackup,
  getBackupHistory,
  restoreFromBackup,
} from "@/actions/backup-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsKeys } from "@/lib/query-keys";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupTab(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [restoreTargetUrl, setRestoreTargetUrl] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");

  const historyQuery = useQuery({
    queryKey: settingsKeys.backups(),
    queryFn: async () => {
      const res = await getBackupHistory();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Backup created: ${res.data.totalRows} rows`);
        void queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
      } else {
        toast.error(res.error);
      }
    },
    onError: () => {
      toast.error("Backup failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Backup deleted");
        void queryClient.invalidateQueries({ queryKey: settingsKeys.backups() });
      } else {
        toast.error(res.error);
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ url, password }: { url: string; password: string }) => {
      return restoreFromBackup(url, password);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(
          `Restore complete: ${res.data.totalRows} rows across ${res.data.tables} tables`,
        );
        closeRestoreDialog();
      } else {
        toast.error(res.error);
      }
    },
    onError: () => {
      toast.error("Restore failed");
    },
  });

  function openRestoreDialog(url: string): void {
    setRestoreTargetUrl(url);
    setPasswordInput("");
  }

  function closeRestoreDialog(): void {
    setRestoreTargetUrl(null);
    setPasswordInput("");
  }

  function confirmRestore(): void {
    if (!restoreTargetUrl) return;
    restoreMutation.mutate({ url: restoreTargetUrl, password: passwordInput });
  }

  return (
    <div className="space-y-6">
      {/* Manual Backup */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Create Backup</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Export all database tables to JSON and upload to cloud storage.
              </p>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="solar-cta"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Backup Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto Backup Info */}
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-foreground text-sm font-semibold">Automatic Backups</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Daily backups run at 3:00 AM UTC via Vercel Cron. Requires{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[10px]">CRON_SECRET</code> env
            variable.
          </p>
          <div className="bg-muted/50 mt-3 rounded-lg p-3">
            <p className="text-muted-foreground text-[11px]">
              <span className="text-foreground font-medium">Setup:</span> Add{" "}
              <code className="bg-muted rounded px-1 py-0.5">CRON_SECRET</code> to your Vercel
              environment variables. The cron job authenticates via Bearer token.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="border-border">
        <CardContent className="p-6">
          <h3 className="text-foreground text-sm font-semibold">Backup History</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Recent backups stored in Vercel Blob storage.
          </p>

          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : !historyQuery.data || historyQuery.data.length === 0 ? (
            <div className="border-border/60 bg-muted/35 mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
              <Database className="text-muted-foreground/50 mb-3 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No backups yet</p>
              <p className="text-muted-foreground/70 mt-1 text-xs">
                Create your first backup to protect your data.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {historyQuery.data.map((backup) => (
                <div
                  key={backup.url}
                  className="border-border/60 flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-solar/10 flex h-9 w-9 items-center justify-center rounded-lg">
                      <Database className="text-solar h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{backup.filename}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(backup.timestamp)} · {formatBytes(backup.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRestoreDialog(backup.url)}
                      title="Restore from this backup"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const params = new URLSearchParams({ url: backup.url });
                        window.open(`/api/backup/download?${params}`, "_blank");
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(backup.url)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog
        open={restoreTargetUrl !== null}
        onOpenChange={(open) => {
          if (!open) closeRestoreDialog();
        }}
      >
        <AlertDialogContent className="border-border bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> all current data in every table and
              replace it with the selected backup. This action cannot be undone.
              {restoreTargetUrl ? (
                <span className="mt-2 block font-mono text-[11px]">
                  Backup: {restoreTargetUrl.split("/").pop()}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="restore-password" className="text-muted-foreground text-xs">
              Enter your password to confirm
            </Label>
            <Input
              id="restore-password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Current login password"
              className="border-border/70 bg-muted/45"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeRestoreDialog} disabled={restoreMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={!passwordInput || restoreMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoreMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
