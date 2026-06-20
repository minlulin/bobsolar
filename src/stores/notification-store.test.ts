import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationStore } from "@/stores/notification-store";

describe("notification-store", () => {
  beforeEach(() => {
    // Reset state before each test
    useNotificationStore.setState({
      unreadCount: 0,
      isOpen: false,
    });
  });

  it("sets unread count", () => {
    useNotificationStore.getState().setUnreadCount(5);
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });

  it("sanitizes unread count to 0 if negative", () => {
    useNotificationStore.getState().setUnreadCount(-2);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("toggles panel open state", () => {
    expect(useNotificationStore.getState().isOpen).toBe(false);

    useNotificationStore.getState().togglePanel();
    expect(useNotificationStore.getState().isOpen).toBe(true);

    useNotificationStore.getState().togglePanel();
    expect(useNotificationStore.getState().isOpen).toBe(false);
  });

  it("decrements unread count", () => {
    useNotificationStore.getState().setUnreadCount(2);
    useNotificationStore.getState().decrementUnread();
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("does not decrement unread count below 0", () => {
    useNotificationStore.getState().setUnreadCount(0);
    useNotificationStore.getState().decrementUnread();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("sets panel open state explicitly", () => {
    useNotificationStore.getState().setOpen(true);
    expect(useNotificationStore.getState().isOpen).toBe(true);

    useNotificationStore.getState().setOpen(false);
    expect(useNotificationStore.getState().isOpen).toBe(false);
  });
});
