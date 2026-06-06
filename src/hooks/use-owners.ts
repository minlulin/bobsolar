import { useQuery } from "@tanstack/react-query";
import {
  archiveOwner,
  createOwner,
  listOwnersForSettings,
  type SafeOwner,
  updateOwner,
} from "@/actions/owner-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { STALE_TIME } from "@/lib/query-config";
import { settingsKeys } from "@/lib/query-keys";

export type { SafeOwner };

export function useOwners() {
  return useQuery({
    queryKey: settingsKeys.partners(),
    queryFn: async () => {
      const res = await listOwnersForSettings();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });
}

export const useCreateOwner = createMutationHook({
  mutationFn: (data: { name: string; email: string; password: string; ownershipPercent: number }) =>
    createOwner(data),
  invalidateKeys: [settingsKeys.partners()],
  successMessage: (data: { slot: string }) => `Partner added (slot ${data.slot})`,
  errorMessage: "Failed to add partner",
});

export const useUpdateOwner = createMutationHook({
  mutationFn: (data: {
    ownerId: string;
    name?: string;
    email?: string;
    ownershipPercent?: number;
    password?: string;
  }) => updateOwner(data),
  invalidateKeys: [settingsKeys.partners()],
  successMessage: "Partner updated",
  errorMessage: "Failed to update partner",
});

export const useArchiveOwner = createMutationHook({
  mutationFn: (ownerId: string) => archiveOwner({ ownerId }),
  invalidateKeys: [settingsKeys.partners()],
  successMessage: (data: { freedSlot: string }) =>
    `Partner archived (slot ${data.freedSlot} freed)`,
  errorMessage: "Failed to archive partner",
});
