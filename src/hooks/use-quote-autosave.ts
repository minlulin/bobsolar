"use client";

import * as React from "react";
import { createQuotation, updateQuotation } from "@/actions/quotation-actions";
import {
  buildQuoteAutosaveDraft,
  buildQuoteAutosaveKey,
  clearQuoteAutosaveDraft,
  hashAutosaveSyncInput,
  isQuoteAutosaveEffectivelyEmpty,
  type QuoteAutosaveMode,
  type QuoteAutosaveStateSnapshot,
  readQuoteAutosaveDraft,
  toServerQuotationInputFromDraft,
  writeQuoteAutosaveDraft,
} from "@/lib/quotations/quote-autosave";
import { useQuoteBuilderStore } from "@/stores/quote-builder-store";

type AutosaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

interface UseQuoteAutosaveParams {
  mode: QuoteAutosaveMode;
  quotationId?: string;
  serverUpdatedAt?: Date | null;
  snapshot: QuoteAutosaveStateSnapshot;
  debounceMs?: number;
}

export interface RestoreCandidate {
  savedAt: number;
  recommendedAction: "restore" | "discard";
  message: string;
}

export interface UseQuoteAutosaveResult {
  autosaveStatus: AutosaveStatus;
  lastSavedAt: number | null;
  restoreCandidate: RestoreCandidate | null;
  serverDraftId: string | null;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearAutosave: () => void;
}

export function useQuoteAutosave({
  mode,
  quotationId,
  serverUpdatedAt = null,
  snapshot,
  debounceMs = 3000,
}: UseQuoteAutosaveParams): UseQuoteAutosaveResult {
  const loadFromAutosaveDraft = useQuoteBuilderStore((state) => state.loadFromAutosaveDraft);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [restoreCandidate, setRestoreCandidate] = React.useState<RestoreCandidate | null>(null);
  const serverDraftIdRef = React.useRef<string | null>(quotationId ?? null);
  const restoreDraftRef = React.useRef<ReturnType<typeof buildQuoteAutosaveDraft> | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const inFlightRef = React.useRef(false);
  const retryCountRef = React.useRef(0);
  const nextRetryAtRef = React.useRef(0);
  const lastSyncedHashRef = React.useRef<string>("");
  const key = React.useMemo(() => buildQuoteAutosaveKey(mode, quotationId), [mode, quotationId]);

  const flush = React.useCallback(async (): Promise<void> => {
    const draft = buildQuoteAutosaveDraft(mode, snapshot, {
      quotationId: serverDraftIdRef.current ?? quotationId ?? null,
      serverUpdatedAt,
      dirty: true,
    });

    if (isQuoteAutosaveEffectivelyEmpty(draft)) {
      return;
    }

    writeQuoteAutosaveDraft(key, draft);
    setLastSavedAt(draft.savedAt);
    if (!navigator.onLine) {
      setAutosaveStatus("offline");
      return;
    }

    const syncInput = toServerQuotationInputFromDraft(draft);
    if (!syncInput) return;

    const syncHash = hashAutosaveSyncInput({
      ...syncInput,
      id: serverDraftIdRef.current,
      mode,
    });
    if (syncHash === lastSyncedHashRef.current || inFlightRef.current) return;
    if (Date.now() < nextRetryAtRef.current) return;

    inFlightRef.current = true;
    setAutosaveStatus("saving");

    try {
      const result =
        mode === "create" && !serverDraftIdRef.current
          ? await createQuotation(syncInput)
          : await updateQuotation(serverDraftIdRef.current ?? quotationId ?? "", syncInput);

      if (result.success) {
        serverDraftIdRef.current = result.data.id;
        retryCountRef.current = 0;
        nextRetryAtRef.current = 0;
        lastSyncedHashRef.current = syncHash;
        setAutosaveStatus("saved");
      } else {
        retryCountRef.current += 1;
        const delay = Math.min(30_000, 1000 * 2 ** retryCountRef.current);
        nextRetryAtRef.current = Date.now() + delay;
        setAutosaveStatus(navigator.onLine ? "error" : "offline");
      }
    } catch {
      retryCountRef.current += 1;
      const delay = Math.min(30_000, 1000 * 2 ** retryCountRef.current);
      nextRetryAtRef.current = Date.now() + delay;
      setAutosaveStatus(navigator.onLine ? "error" : "offline");
    } finally {
      inFlightRef.current = false;
    }
  }, [key, mode, quotationId, serverUpdatedAt, snapshot]);

  React.useEffect(() => {
    const localDraft = readQuoteAutosaveDraft(key);
    if (!localDraft || isQuoteAutosaveEffectivelyEmpty(localDraft)) return;

    restoreDraftRef.current = localDraft;
    const serverMs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
    const recommendedAction = localDraft.savedAt >= serverMs ? "restore" : "discard";
    const message =
      recommendedAction === "restore"
        ? "A newer local recovery draft was found."
        : "Server draft looks newer than your local recovery draft.";

    setRestoreCandidate({
      savedAt: localDraft.savedAt,
      recommendedAction,
      message,
    });
  }, [key, serverUpdatedAt]);

  React.useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flush();
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [debounceMs, flush]);

  React.useEffect(() => {
    const flushNow = () => {
      void flush();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const onPageHide = () => {
      flushNow();
    };
    const onBeforeUnload = () => {
      flushNow();
    };
    const onOnline = () => {
      void flush();
    };
    const onOffline = () => {
      setAutosaveStatus("offline");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush]);

  const clearAutosave = React.useCallback(() => {
    clearQuoteAutosaveDraft(key);
    setRestoreCandidate(null);
  }, [key]);

  const restoreDraft = React.useCallback(() => {
    const draft = restoreDraftRef.current;
    if (!draft) return;

    serverDraftIdRef.current = draft.quotationId ?? serverDraftIdRef.current;
    loadFromAutosaveDraft(draft);
    setRestoreCandidate(null);
  }, [loadFromAutosaveDraft]);

  const discardDraft = React.useCallback(() => {
    clearQuoteAutosaveDraft(key);
    restoreDraftRef.current = null;
    setRestoreCandidate(null);
  }, [key]);

  return {
    autosaveStatus,
    lastSavedAt,
    restoreCandidate,
    serverDraftId: serverDraftIdRef.current,
    restoreDraft,
    discardDraft,
    clearAutosave,
  };
}
