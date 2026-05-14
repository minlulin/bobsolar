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

function isSafeInternalLink(link: string): boolean {
  if (!link.startsWith('/') || link.startsWith('//')) return false;
  if (/[\\\u0000-\u001F]/.test(link)) return false;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(link)) return false;
  return true;
}

export function NotificationBell(): React.JSX.Element {
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
      const timer = setTimeout(() => {
        setPulseBadge(false);
      }, 900);
      return (): void => {
        clearTimeout(timer);
      };
    }
    prevUnread.current = unreadCount;
    return;
  }, [unreadCount, prevUnread]);

  const handleNotificationClick = (notification: Notification): void => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    if (notification.link && isSafeInternalLink(notification.link)) {
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
      <SheetContent className="surface-card flex w-full flex-col sm:max-w-md">
        <SheetHeader className="border-border/70 border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    markAllAsRead.mutate();
                  }}
                  disabled={markAllAsRead.isPending}
                  className="text-muted-foreground hover:text-foreground h-8 text-xs"
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
              <Bell className="text-muted-foreground/30 mb-2 h-8 w-8" />
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
                  onClick={() => {
                    handleNotificationClick(notification);
                  }}
                  className={cn(
                    'hover:bg-muted/55 relative flex cursor-pointer gap-4 rounded-xl border p-4 transition-colors',
                    notification.isRead
                      ? 'border-transparent bg-transparent'
                      : 'border-border/70 bg-muted/35',
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
                          : 'text-foreground',
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {notification.message}
                    </p>
                    <p className="text-muted-foreground text-xs">
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
                    className="text-muted-foreground hover:text-foreground absolute right-3 bottom-2 text-[10px]"
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
                className="text-muted-foreground hover:text-foreground mt-2"
                onClick={() => {
                  markAllAsRead.mutate();
                }}
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
