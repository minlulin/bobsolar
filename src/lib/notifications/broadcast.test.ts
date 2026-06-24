import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as Array<{ id: string }>,
  admins: [] as Array<{ id: string }>,
}));

const spies = vi.hoisted(() => ({
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => state.admins),
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for drizzle query builder
      then: (resolve: (value: Array<{ id: string }>) => unknown) => resolve(state.users),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((payload: unknown) => {
      spies.values(payload);
      return {
        onConflictDoNothing: vi.fn((arg: unknown) => {
          spies.onConflictDoNothing(arg);
          return Promise.resolve();
        }),
      };
    }),
  })),
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

describe("broadcast notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.users = [];
    state.admins = [];
  });

  it("no-op when no users", async () => {
    const { notifyAllUsers } = await import("@/lib/notifications/broadcast");
    await notifyAllUsers({ title: "t", message: "m", type: "info" });
    expect(spies.values).not.toHaveBeenCalled();
  });

  it("inserts with dedupe key", async () => {
    state.users = [{ id: "u1" }, { id: "u2" }];
    const { notifyAllUsers } = await import("@/lib/notifications/broadcast");
    await notifyAllUsers({ title: "t", message: "m", type: "warning", dedupeKey: "k1" });
    expect(spies.values).toHaveBeenCalled();
    expect(spies.onConflictDoNothing).toHaveBeenCalled();
  });

  it("notifies only admins", async () => {
    state.admins = [{ id: "a1" }];
    const { notifyAdminUsers } = await import("@/lib/notifications/broadcast");
    await notifyAdminUsers({ title: "t", message: "m", type: "action" });
    expect(spies.values).toHaveBeenCalled();
  });
});
