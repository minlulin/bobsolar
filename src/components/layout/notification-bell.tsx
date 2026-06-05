"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bell, Info, Loader2, PlayCircle, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDeleteAllNotifications,
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/use-notifications";
import type { Notification } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notification-store";

function isSafeInternalLink(link: string): boolean {
  if (!link.startsWith("/") || link.startsWith("//")) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentional security check for control chars in links
  if (/[\\\u0000-\u001F]/.test(link)) return false;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(link)) return false;
  return true;
}

export function NotificationBell(): React.JSX.Element {
  const { data: notifications, isPending, isError, refetch } = useNotifications();
  const unreadQuery = useUnreadCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const clearAll = useDeleteAllNotifications();
  const deleteOne = useDeleteNotification();
  const router = useRouter();
  const open = useNotificationStore((s) => s.isOpen);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  React.useEffect(() => {
    if (typeof unreadQuery.data === "number") setUnreadCount(unreadQuery.data);
  }, [unreadQuery.data, setUnreadCount]);

  const [pulseBadge, setPulseBadge] = React.useState(false);
  const prevUnread = React.useRef(0);
  React.useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setPulseBadge(true);
      refetch();
      const timer = setTimeout(() => {
        setPulseBadge(false);
      }, 900);
      prevUnread.current = unreadCount;
      return (): void => {
        clearTimeout(timer);
      };
    }
    prevUnread.current = unreadCount;
    return;
  }, [unreadCount, refetch]);

  React.useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
                "bg-destructive absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
                pulseBadge ? "animate-bounce" : "",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="bg-card border-border flex w-80 flex-col p-0 sm:w-96"
      >
        <div className="border-border/70 flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                markAllAsRead.mutate();
              }}
              disabled={markAllAsRead.isPending}
              className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
            >
              {markAllAsRead.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Mark all
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isPending ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : isError ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <AlertTriangle className="text-destructive mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">Failed to load notifications</p>
              <Button variant="link" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center">
              <Bell className="text-muted-foreground/30 mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No notifications</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
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
                    "hover:bg-muted/50 relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                    notification.isRead
                      ? "border-transparent bg-transparent"
                      : "border-border/50 bg-muted/20",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {notification.type === "info" && <Info className="h-4 w-4 text-blue-500" />}
                    {notification.type === "warning" && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    {notification.type === "action" && (
                      <PlayCircle className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p
                      className={cn(
                        "text-xs leading-none font-semibold",
                        notification.isRead ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-muted-foreground/70 text-[10px]">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove notification: ${notification.title}`}
                    className="text-muted-foreground/50 hover:text-foreground absolute top-2 right-2 p-1 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOne.mutate(notification.id);
                    }}
                  >
                    <span className="sr-only">Remove</span>
                    <Plus className="h-3 w-3 rotate-45" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications && notifications.length > 0 && (
          <div className="border-border/70 border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 w-full text-xs"
              onClick={() => {
                clearAll.mutate();
              }}
              disabled={clearAll.isPending}
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
