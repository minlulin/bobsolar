import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authFail: false,
  summaryRow: { overdue: 1, dueSoon: 2, upcoming: 3, active: 6 },
  alertRows: [
    {
      alert: {
        id: "a1",
        projectId: "p1",
        alertType: "warranty_expiry",
        description: "Panel check",
        dueDate: new Date("2026-05-22"),
        isResolved: false,
        createdAt: new Date("2026-05-20"),
      },
      projectNumber: "PJ-2026-0001",
      customerName: "Aung",
    },
  ],
  resolveAlert: {
    id: "a1",
    projectId: "p1",
    project: { projectNumber: "PJ-2026-0001" },
  } as null | { id: string; projectId: string; project: { projectNumber: string } },
  reopenAlert: {
    id: "a1",
    projectId: "p1",
  } as null | { id: string; projectId: string },
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  notifyAllUsers: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAuth: vi.fn(async () => {
    if (state.authFail) throw new Error("Unauthorized");
    return { userId: "u1", role: "admin" as const };
  }),
}));

vi.mock("@/lib/notifications/broadcast", () => ({
  notifyAllUsers: spies.notifyAllUsers,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: vi.fn(async () => [state.summaryRow]),
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(async () => state.alertRows),
              })),
            })),
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => state.alertRows),
            })),
          })),
        })),
      })),
    })),
    query: {
      warrantyAlerts: {
        findFirst: vi.fn(async (args?: { with?: unknown }) => {
          if (args?.with) return state.resolveAlert;
          return state.reopenAlert;
        }),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  },
}));

describe("warranty-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authFail = false;
    state.resolveAlert = {
      id: "a1",
      projectId: "p1",
      project: { projectNumber: "PJ-2026-0001" },
    };
    state.reopenAlert = { id: "a1", projectId: "p1" };
  });

  it("returns warranty summary", async () => {
    const { getWarrantySummary } = await import("@/actions/warranty-actions");
    const res = await getWarrantySummary();
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.active).toBe(6);
  });

  it("returns warranty alerts list", async () => {
    const { getWarrantyAlerts } = await import("@/actions/warranty-actions");
    const res = await getWarrantyAlerts({ tab: "all", limit: 20, offset: 0 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data[0]?.projectNumber).toBe("PJ-2026-0001");
  });

  it("resolves alert and notifies", async () => {
    const { resolveWarrantyAlert } = await import("@/actions/warranty-actions");
    const res = await resolveWarrantyAlert("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(spies.notifyAllUsers).toHaveBeenCalled();
    expect(spies.revalidatePath).toHaveBeenCalledWith("/warranty");
  });

  it("returns not found when resolving missing alert", async () => {
    state.resolveAlert = null;
    const { resolveWarrantyAlert } = await import("@/actions/warranty-actions");
    const res = await resolveWarrantyAlert("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toContain("Alert");
  });

  it("reopens alert", async () => {
    const { reopenWarrantyAlert } = await import("@/actions/warranty-actions");
    const res = await reopenWarrantyAlert("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(true);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/warranty");
  });

  it("returns not found on reopen missing alert", async () => {
    state.reopenAlert = null;
    const { reopenWarrantyAlert } = await import("@/actions/warranty-actions");
    const res = await reopenWarrantyAlert("11111111-1111-4111-8111-111111111111");
    expect(res.success).toBe(false);
  });
});
