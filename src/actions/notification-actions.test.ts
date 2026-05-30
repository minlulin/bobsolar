import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authRole: "admin" as "admin" | "staff",
  authFail: false,
  notificationsRows: [
    {
      id: "n1",
      userId: "u1",
      title: "Hi",
      message: "Msg",
      type: "info",
      link: null,
      isRead: false,
      notificationDedupeKey: null,
      createdAt: new Date(),
    },
  ],
  unreadCountRow: [{ total: 2 }],
  insertedReturning: [{ id: "n1" }],
  existingDedupeRows: [] as Array<{ userId: string; notificationDedupeKey: string | null }>,
  usersRows: [{ id: "u1" }, { id: "u2" }],
  adminRows: [{ id: "u1" }],
  expiringRows: [] as Array<{ id: string; quoteNumber: string; createdBy: string }>,
  dueSoonRows: [] as Array<{ id: string; projectId: string; projectNumber: string }>,
  overdueRows: [] as Array<{ id: string; projectId: string; projectNumber: string }>,
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: spies.revalidatePath }));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: state.authRole };
  }),
  requireAdmin: vi.fn(async () => {
    if (state.authFail || state.authRole !== "admin") throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      notifications: {
        findMany: vi.fn(async () => state.notificationsRows),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => state.unreadCountRow),
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => state.dueSoonRows),
        })),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for drizzle query builder
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(state.usersRows)),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => state.insertedReturning),
        })),
      })),
    })),
  },
}));

describe("notification-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.authRole = "admin";
    state.unreadCountRow = [{ total: 2 }];
    state.insertedReturning = [{ id: "n1" }];
    state.existingDedupeRows = [];
    state.expiringRows = [];
    state.dueSoonRows = [];
    state.overdueRows = [];
  });

  it("gets notifications", async () => {
    const { getNotifications } = await import("@/actions/notification-actions");
    const res = await getNotifications();
    expect(res.success).toBe(true);
  });

  it("gets notifications with unread filter", async () => {
    const { getNotificationsWithFilter } = await import("@/actions/notification-actions");
    const res = await getNotificationsWithFilter({ unreadOnly: true });
    expect(res.success).toBe(true);
  });

  it("gets unread count", async () => {
    const { getUnreadCount } = await import("@/actions/notification-actions");
    const res = await getUnreadCount();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toBe(2);
  });

  it("marks notification as read", async () => {
    const { markNotificationAsRead } = await import("@/actions/notification-actions");
    const res = await markNotificationAsRead("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("deletes notification", async () => {
    const { deleteNotification } = await import("@/actions/notification-actions");
    const res = await deleteNotification("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
  });

  it("creates notification without dedupe", async () => {
    const { createNotification } = await import("@/actions/notification-actions");
    const res = await createNotification({
      userIds: ["11111111-1111-4111-8111-111111111111"],
      title: "Notice",
      message: "Hello",
      type: "info",
      link: "/projects",
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toBe(1);
  });

  it("creates notification with dedupe", async () => {
    const { createNotification } = await import("@/actions/notification-actions");
    const res = await createNotification({
      userIds: ["11111111-1111-4111-8111-111111111111"],
      title: "Notice",
      message: "Hello",
      type: "warning",
      link: "/projects",
      dedupeKey: "k1",
    });
    expect(res.success).toBe(true);
  });

  it("marks all notifications as read", async () => {
    const { markAllNotificationsAsRead } = await import("@/actions/notification-actions");
    const res = await markAllNotificationsAsRead();
    expect(res.success).toBe(true);
  });

  it("deletes all notifications", async () => {
    const { deleteAllNotifications } = await import("@/actions/notification-actions");
    const res = await deleteAllNotifications();
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
