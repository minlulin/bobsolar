import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotificationsWithFilter,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/actions/notification-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { STALE_TIME } from "@/lib/query-config";
import { notificationKeys } from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import { useNotificationStore } from "@/stores/notification-store";

export function useNotifications(): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getNotificationsWithFilter>>>>
> {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const res = await getNotificationsWithFilter({});
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.REALTIME,
  });
}

export function useUnreadCount(): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getUnreadCount>>>>
> {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      const res = await getUnreadCount();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: 30 * 1000,
  });
}

export function useMarkNotificationAsRead(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof markNotificationAsRead>>,
    Error,
    string,
    { previous: Array<{ id: string; isRead: boolean }> | undefined }
  >
> {
  const queryClient = useQueryClient();
  const decrementUnread = useNotificationStore((s) => s.decrementUnread);

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      const previous = queryClient.getQueryData<Array<{ id: string; isRead: boolean }>>(
        notificationKeys.list(),
      );
      if (previous) {
        queryClient.setQueryData(
          notificationKeys.list(),
          previous.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        const target = previous.find((n) => n.id === id);
        if (target && !target.isRead) decrementUnread();
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notificationKeys.list(), ctx.previous);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      await queryClient.invalidateQueries({
        queryKey: notificationKeys.unread(),
      });
    },
  });
}

export function useMarkAllNotificationsAsRead(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof markAllNotificationsAsRead>>,
    Error,
    void,
    { previous: Array<{ isRead: boolean }> | undefined }
  >
> {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      const previous = queryClient.getQueryData<Array<{ isRead: boolean }>>(
        notificationKeys.list(),
      );
      if (previous) {
        queryClient.setQueryData(
          notificationKeys.list(),
          previous.map((n) => ({ ...n, isRead: true })),
        );
      }
      setUnreadCount(0);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notificationKeys.list(), ctx.previous);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      await queryClient.invalidateQueries({
        queryKey: notificationKeys.unread(),
      });
    },
  });
}

export const useDeleteNotification = createMutationHook({
  mutationFn: (id: string) => deleteNotification(id),
  invalidateKeys: [notificationKeys.all, notificationKeys.unread()],
  successMessage: "Notification deleted",
  errorMessage: "Failed to delete notification",
});

export function useDeleteAllNotifications(): ReturnType<
  typeof useMutation<Awaited<ReturnType<typeof deleteAllNotifications>>, Error, void>
> {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return useMutation({
    mutationFn: () => deleteAllNotifications(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      const previous = queryClient.getQueryData<Array<unknown>>(notificationKeys.list());
      const previousCount = unreadCount;
      queryClient.setQueryData(notificationKeys.list(), []);
      setUnreadCount(0);
      return { previous, previousCount };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notificationKeys.list(), ctx.previous);
      if (ctx?.previousCount !== undefined) setUnreadCount(ctx.previousCount);
      toast.error("Failed to delete notifications");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      await queryClient.invalidateQueries({
        queryKey: notificationKeys.unread(),
      });
    },
  });
}
