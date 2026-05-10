'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Bell, Loader2, Info, AlertTriangle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/db/schema';
import { useNotificationStore } from '@/stores/notification-store';

export function NotificationBell() {
  const { data: notifications, isLoading } = useNotifications();
  const unreadQuery = useUnreadCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteOne = useDeleteNotification();
  const router = useRouter();
  const open = useNotificationStore((s) => s.isOpen);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  React.useEffect(() => {
    if (typeof unreadQuery.data === 'number') setUnreadCount(unreadQuery.data);
  }, [unreadQuery.data, setUnreadCount]);

  const [pulseBadge, setPulseBadge] = React.useState(false);
  const prevUnread = React.useRef(0);
  React.useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setPulseBadge(true);
      const timer = setTimeout(() => setPulseBadge(false), 900);
      return () => clearTimeout(timer);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open notifications"
          className="relative h-10 w-10 rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'bg-destructive absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white',
                pulseBadge ? 'animate-bounce' : '',
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col border-white/10 bg-zinc-950 sm:max-w-md">
        <SheetHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                  className="text-muted-foreground h-8 text-xs hover:text-white"
                >
                  {markAllAsRead.isPending && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Mark all as read
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="-mx-6 flex-1 px-6">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <Bell className="mb-2 h-8 w-8 text-white/10" />
              <p className="text-muted-foreground text-sm">No notifications</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-4">
              {notifications?.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'relative flex cursor-pointer gap-4 rounded-xl border p-4 transition-colors hover:bg-white/5',
                    notification.isRead
                      ? 'border-transparent bg-transparent'
                      : 'border-white/10 bg-white/[0.02]',
                  )}
                >
                  <div className="mt-1">
                    {notification.type === 'info' && (
                      <Info className="h-5 w-5 text-blue-500" />
                    )}
                    {notification.type === 'warning' && (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                    {notification.type === 'action' && (
                      <PlayCircle className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        notification.isRead
                          ? 'text-muted-foreground'
                          : 'text-white',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {notification.message}
                    </p>
                    <p className="text-xs text-white/40">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove notification: ${notification.title}`}
                    className="absolute right-3 bottom-2 text-[10px] text-white/40 hover:text-white/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOne.mutate(notification.id);
                    }}
                  >
                    Remove
                  </button>
                </motion.div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground mt-2 hover:text-white"
                onClick={() => markAllAsRead.mutate()}
              >
                Clear all
              </Button>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
