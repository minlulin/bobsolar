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

interface NotificationItem {
  id: string;
  isRead: boolean;
}

export function useMarkNotificationAsRead(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof markNotificationAsRead>>,
    Error,
    string,
    {
      previousList: NotificationItem[] | undefined;
      previousUnread: number | undefined;
    }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unread() });

      const previousList = queryClient.getQueryData<NotificationItem[]>(notificationKeys.list());
      const previousUnread = queryClient.getQueryData<number>(notificationKeys.unread());

      if (previousList) {
        queryClient.setQueryData(
          notificationKeys.list(),
          previousList.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        const target = previousList.find((n) => n.id === id);
        if (target && !target.isRead && typeof previousUnread === "number") {
          queryClient.setQueryData(notificationKeys.unread(), Math.max(0, previousUnread - 1));
        }
      }
      return { previousList, previousUnread };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previousList) queryClient.setQueryData(notificationKeys.list(), ctx.previousList);
      if (typeof ctx?.previousUnread === "number") {
        queryClient.setQueryData(notificationKeys.unread(), ctx.previousUnread);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsAsRead(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof markAllNotificationsAsRead>>,
    Error,
    void,
    {
      previousList: NotificationItem[] | undefined;
      previousUnread: number | undefined;
    }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unread() });

      const previousList = queryClient.getQueryData<NotificationItem[]>(notificationKeys.list());
      const previousUnread = queryClient.getQueryData<number>(notificationKeys.unread());

      if (previousList) {
        queryClient.setQueryData(
          notificationKeys.list(),
          previousList.map((n) => ({ ...n, isRead: true })),
        );
      }
      queryClient.setQueryData(notificationKeys.unread(), 0);
      return { previousList, previousUnread };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousList) queryClient.setQueryData(notificationKeys.list(), ctx.previousList);
      if (typeof ctx?.previousUnread === "number") {
        queryClient.setQueryData(notificationKeys.unread(), ctx.previousUnread);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export const useDeleteNotification = createMutationHook({
  mutationFn: (id: string) => deleteNotification(id),
  invalidateKeys: [notificationKeys.all],
  successMessage: "Notification deleted",
  errorMessage: "Failed to delete notification",
});

export function useDeleteAllNotifications(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof deleteAllNotifications>>,
    Error,
    void,
    {
      previousList: unknown[] | undefined;
      previousUnread: number | undefined;
    }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllNotifications(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.list() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.unread() });

      const previousList = queryClient.getQueryData<unknown[]>(notificationKeys.list());
      const previousUnread = queryClient.getQueryData<number>(notificationKeys.unread());

      queryClient.setQueryData(notificationKeys.list(), []);
      queryClient.setQueryData(notificationKeys.unread(), 0);

      return { previousList, previousUnread };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousList) queryClient.setQueryData(notificationKeys.list(), ctx.previousList);
      if (typeof ctx?.previousUnread === "number") {
        queryClient.setQueryData(notificationKeys.unread(), ctx.previousUnread);
      }
      toast.error("Failed to delete notifications");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
