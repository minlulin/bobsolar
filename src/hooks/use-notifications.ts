import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationsWithFilter,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '@/actions/notification-actions';
import { useNotificationStore } from '@/stores/notification-store';

type ActionData<T> = T extends { data: infer D } ? D : never;

export function useNotifications(): ReturnType<typeof useQuery<
  ActionData<Awaited<ReturnType<typeof getNotificationsWithFilter>>>
>> {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await getNotificationsWithFilter({});
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 15 * 1000,
  });
}

export function useUnreadCount(): ReturnType<typeof useQuery<
  ActionData<Awaited<ReturnType<typeof getUnreadCount>>>
>> {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await getUnreadCount();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useMarkNotificationAsRead(): ReturnType<typeof useMutation<
  ActionData<Awaited<ReturnType<typeof markNotificationAsRead>>>,
  Error,
  string,
  { previous: Array<{ id: string; isRead: boolean }> | undefined }
>> {
  const queryClient = useQueryClient();
  const decrementUnread = useNotificationStore((s) => s.decrementUnread);

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<
        Array<{ id: string; isRead: boolean }>
      >(['notifications']);
      if (previous) {
        queryClient.setQueryData(
          ['notifications'],
          previous.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        const target = previous.find((n) => n.id === id);
        if (target && !target.isRead) decrementUnread();
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(['notifications'], ctx.previous);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useMarkAllNotificationsAsRead(): ReturnType<typeof useMutation<
  ActionData<Awaited<ReturnType<typeof markAllNotificationsAsRead>>>,
  Error,
  void,
  { previous: Array<{ isRead: boolean }> | undefined }
>> {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData<Array<{ isRead: boolean }>>([
        'notifications',
      ]);
      if (previous) {
        queryClient.setQueryData(
          ['notifications'],
          previous.map((n) => ({ ...n, isRead: true })),
        );
      }
      setUnreadCount(0);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(['notifications'], ctx.previous);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useDeleteNotification(): ReturnType<typeof useMutation<
  ActionData<Awaited<ReturnType<typeof deleteNotification>>>,
  Error,
  string
>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}
