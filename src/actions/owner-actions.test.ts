import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "owner" | "technician";
  archivedAt?: Date | null;
}

interface MockOwner {
  id: string;
  userId: string;
  slot: "A" | "B" | "C";
  ownershipPercentage: string;
  deletedAt: Date | null;
  createdAt: Date;
}

interface MockJoinRow {
  ownerId: string;
  userId: string;
  name: string;
  email: string;
  slot: "A" | "B" | "C";
  ownershipPercentage: string;
  createdAt: Date;
}

interface WhereClause {
  __op: "eq" | "and" | "isNull";
  col?: unknown;
  colName?: string;
  val?: unknown;
  args?: WhereClause[];
}

const state = vi.hoisted(() => ({
  auth: { userId: "admin-1", role: "admin" as "admin" | "owner" },
  requireAdminError: null as Error | null,
  users: [] as MockUser[],
  owners: [] as MockOwner[],
  joinRows: [] as MockJoinRow[],
  listThrow: null as Error | null,
}));

const spies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  hashPassword: vi.fn(),
}));

const revokedRef = vi.hoisted(() => ({ revokedUserId: "" }));

vi.mock("next/cache", () => ({
  revalidatePath: spies.revalidatePath,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAdmin: spies.requireAdmin.mockImplementation(async () => {
    if (state.requireAdminError) throw state.requireAdminError;
    return state.auth;
  }),
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: spies.hashPassword.mockImplementation(async (p: string) => `hash:${p}`),
}));

vi.mock("@/lib/auth/session", () => ({
  bumpUserSessionVersion: vi.fn(async (userId: string) => {
    revokedRef.revokedUserId = userId;
    return 1;
  }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((col: { name?: string } | unknown, val: unknown) => ({
      __op: "eq" as const,
      col,
      colName: (col as { name?: string } | undefined)?.name,
      val,
    })),
    and: vi.fn((...args: unknown[]) => ({ __op: "and" as const, args })),
    isNull: vi.fn((col: { name?: string } | unknown) => ({
      __op: "isNull" as const,
      col,
      colName: (col as { name?: string } | undefined)?.name,
    })),
  };
});

vi.mock("@/lib/db", () => {
  const makeThenableFrom = (table: unknown) => {
    const p: Promise<{ count: number }[]> & {
      where: (_where: WhereClause) => Promise<{ slot: "A" | "B" | "C" }[]>;
      _table: unknown;
    } = Promise.resolve([{ count: state.users.length }]) as Promise<{ count: number }[]> & {
      where: (_where: WhereClause) => Promise<{ slot: "A" | "B" | "C" }[]>;
      _table: unknown;
    };
    p.where = (_where: WhereClause) =>
      Promise.resolve(
        state.owners.filter((o) => o.deletedAt === null).map((o) => ({ slot: o.slot })),
      );
    p._table = table;
    return p;
  };

  const makeTx = () => ({
    select: vi.fn((_selection: unknown) => ({
      from: vi.fn((table: unknown) => makeThenableFrom(table)),
    })),
    query: {
      users: {
        findFirst: vi.fn(async ({ where }: { where?: WhereClause }) => {
          if (!where) return state.users[0] ?? null;
          if (where.__op === "eq" && where.colName === "email") {
            return state.users.find((u) => u.email === where.val) ?? null;
          }
          if (where.__op === "eq" && where.colName === "id") {
            return state.users.find((u) => u.id === where.val) ?? null;
          }
          if (where.__op === "and") {
            const eq = where.args?.find((a) => a.__op === "eq");
            if (eq && eq.colName === "email") {
              return state.users.find((u) => u.email === eq.val) ?? null;
            }
          }
          return null;
        }),
      },
      owners: {
        findFirst: vi.fn(async ({ where }: { where?: WhereClause }) => {
          if (!where) return state.owners[0] ?? null;
          if (where.__op === "eq" && where.colName === "id") {
            return state.owners.find((o) => o.id === where.val) ?? null;
          }
          return null;
        }),
      },
    },
    insert: vi.fn((_table: unknown) => ({
      values: vi.fn((payload: Record<string, unknown>) => ({
        returning: vi.fn(async (cols: { id?: unknown } | undefined) => {
          const idKey = cols && typeof cols === "object" ? Object.keys(cols)[0] : "id";
          if (idKey === "id" && "name" in payload && "email" in payload) {
            const id = `u-${state.users.length + 1}`;
            state.users.push({
              id,
              name: payload["name"] as string,
              email: payload["email"] as string,
              passwordHash: payload["passwordHash"] as string,
              role: (payload["role"] as "admin" | "owner") ?? "owner",
            });
            return [{ id }];
          }
          if (idKey === "id" && "userId" in payload && "slot" in payload) {
            const id = `o-${state.owners.length + 1}`;
            state.owners.push({
              id,
              userId: payload["userId"] as string,
              slot: payload["slot"] as "A" | "B" | "C",
              ownershipPercentage: payload["ownershipPercentage"] as string,
              deletedAt: null,
              createdAt: new Date(),
            });
            return [{ id }];
          }
          return [];
        }),
      })),
    })),
    update: vi.fn((_table: unknown) => ({
      set: vi.fn((payload: Record<string, unknown>) => ({
        where: vi.fn(async (where: WhereClause) => {
          if (where.__op === "eq" && where.colName === "id") {
            const userIdx = state.users.findIndex((u) => u.id === where.val);
            const user = userIdx >= 0 ? state.users[userIdx] : undefined;
            if (user) {
              Object.assign(user, payload);
              return undefined;
            }
            const ownerIdx = state.owners.findIndex((o) => o.id === where.val);
            const owner = ownerIdx >= 0 ? state.owners[ownerIdx] : undefined;
            if (owner) {
              Object.assign(owner, payload);
              return undefined;
            }
          }
          return undefined;
        }),
      })),
    })),
  });

  return {
    db: {
      transaction: vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
        cb(makeTx()),
      ),
      select: vi.fn((_selection: unknown) => ({
        from: vi.fn((_table: unknown) => ({
          innerJoin: vi.fn((_other: unknown, _on: unknown) => ({
            where: vi.fn((_w: WhereClause) => ({
              orderBy: vi.fn(async () => {
                if (state.listThrow) throw state.listThrow;
                return state.joinRows;
              }),
            })),
          })),
        })),
      })),
    },
  };
});

const resetState = () => {
  state.auth = { userId: "admin-1", role: "admin" };
  state.requireAdminError = null;
  state.listThrow = null;
  state.users = [
    { id: "u1", name: "Admin", email: "admin@x.com", passwordHash: "h", role: "admin" },
  ];
  state.owners = [
    {
      id: "o-existing",
      userId: "u-existing",
      slot: "A",
      ownershipPercentage: "34",
      deletedAt: null,
      createdAt: new Date("2024-01-01"),
    },
  ];
  state.joinRows = [
    {
      ownerId: "o-existing",
      userId: "u-existing",
      name: "Arkar",
      email: "arkar@x.com",
      slot: "A",
      ownershipPercentage: "34",
      createdAt: new Date("2024-01-01"),
    },
  ];
  revokedRef.revokedUserId = "";
  vi.clearAllMocks();
  spies.requireAdmin.mockImplementation(async () => {
    if (state.requireAdminError) throw state.requireAdminError;
    return state.auth;
  });
  spies.hashPassword.mockImplementation(async (p: string) => `hash:${p}`);
};

describe("owner-actions", () => {
  beforeEach(resetState);

  describe("listOwnersForSettings", () => {
    it("returns joined owner+user rows ordered by slot, excluding archived", async () => {
      const { listOwnersForSettings } = await import("@/actions/owner-actions");

      const result = await listOwnersForSettings();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owners).toHaveLength(1);
        expect(result.data.owners[0]).toMatchObject({
          ownerId: "o-existing",
          userId: "u-existing",
          name: "Arkar",
          email: "arkar@x.com",
          slot: "A",
          ownershipPercentage: "34",
        });
      }
      expect(spies.revalidatePath).not.toHaveBeenCalled();
    });

    it("returns empty list when no active owners", async () => {
      const { listOwnersForSettings } = await import("@/actions/owner-actions");

      state.joinRows = [];
      const result = await listOwnersForSettings();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owners).toEqual([]);
      }
    });

    it("propagates db errors as failure", async () => {
      const { listOwnersForSettings } = await import("@/actions/owner-actions");

      state.listThrow = new Error("connection lost");
      const result = await listOwnersForSettings();
      expect(result.success).toBe(false);
    });
  });

  describe("createOwner", () => {
    const validInput = {
      name: "  New Partner  ",
      email: "new@x.com",
      password: "Password123!@#",
      ownershipPercent: 33.34,
    };

    it("creates user + owner with slot A when nothing is held", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.owners = [];
      const result = await createOwner(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slot).toBe("A");
        expect(result.data.ownerId).toMatch(/^o-/);
      }
      expect(state.users).toHaveLength(2);
      const newUser = state.users[1];
      if (!newUser) throw new Error("expected new user at index 1");
      expect(newUser.role).toBe("owner");
      expect(newUser.passwordHash).toBe("hash:Password123!@#");
      expect(spies.revalidatePath).toHaveBeenCalledWith("/settings");
    });

    it("picks slot B when A is held", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.owners = [
        {
          id: "o1",
          userId: "u-a",
          slot: "A",
          ownershipPercentage: "33.33",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      const result = await createOwner(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slot).toBe("B");
      }
    });

    it("picks slot C when A and B are held", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.owners = [
        {
          id: "o1",
          userId: "u-a",
          slot: "A",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
        {
          id: "o2",
          userId: "u-b",
          slot: "B",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      const result = await createOwner(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slot).toBe("C");
      }
    });

    it("skips slots held by archived owners (deletedAt set)", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.owners = [
        {
          id: "o1",
          userId: "u-a",
          slot: "A",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
        {
          id: "o2",
          userId: "u-b",
          slot: "B",
          ownershipPercentage: "33",
          deletedAt: new Date("2024-06-01"),
          createdAt: new Date(),
        },
      ];
      const result = await createOwner(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slot).toBe("B");
      }
    });

    it("rejects when USER_CAP is reached (10 users)", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.users = [
        { id: "1", name: "a", email: "a@x.com", passwordHash: "h", role: "admin" },
        { id: "2", name: "b", email: "b@x.com", passwordHash: "h", role: "owner" },
        { id: "3", name: "c", email: "c@x.com", passwordHash: "h", role: "owner" },
        { id: "4", name: "d", email: "d@x.com", passwordHash: "h", role: "owner" },
        { id: "5", name: "e", email: "e@x.com", passwordHash: "h", role: "technician" },
        { id: "6", name: "f", email: "f@x.com", passwordHash: "h", role: "technician" },
        { id: "7", name: "g", email: "g@x.com", passwordHash: "h", role: "technician" },
        { id: "8", name: "h", email: "h@x.com", passwordHash: "h", role: "technician" },
        { id: "9", name: "i", email: "i@x.com", passwordHash: "h", role: "technician" },
        { id: "10", name: "j", email: "j@x.com", passwordHash: "h", role: "technician" },
      ];
      const result = await createOwner(validInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/user limit|10 max/i);
      }
      expect(state.users).toHaveLength(10);
    });

    it("rejects when all 3 partner slots are held", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.owners = [
        {
          id: "o1",
          userId: "u-a",
          slot: "A",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
        {
          id: "o2",
          userId: "u-b",
          slot: "B",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
        {
          id: "o3",
          userId: "u-c",
          slot: "C",
          ownershipPercentage: "34",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      const result = await createOwner(validInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/maximum 3|active partners/i);
      }
    });

    it("rejects duplicate email", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      state.users.push({
        id: "u-dup",
        name: "Other",
        email: "new@x.com",
        passwordHash: "h",
        role: "owner",
      });
      const result = await createOwner(validInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/email/i);
      }
    });

    it("rejects invalid email", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      const result = await createOwner({ ...validInput, email: "not-an-email" });
      expect(result.success).toBe(false);
    });

    it("rejects weak password", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      const result = await createOwner({ ...validInput, password: "short" });
      expect(result.success).toBe(false);
    });

    it("rejects ownership percentage of zero", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      const result = await createOwner({ ...validInput, ownershipPercent: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects ownership percentage over 100", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      const result = await createOwner({ ...validInput, ownershipPercent: 150 });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", async () => {
      const { createOwner } = await import("@/actions/owner-actions");

      const result = await createOwner({ ...validInput, name: "   " });
      expect(result.success).toBe(false);
    });
  });

  describe("updateOwner", () => {
    const validOwnerId = "11111111-1111-4111-8111-111111111111";
    const ownerUserId = "11111111-1111-4111-8111-111111111110";

    beforeEach(() => {
      state.owners = [
        {
          id: validOwnerId,
          userId: ownerUserId,
          slot: "A",
          ownershipPercentage: "33.33",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      state.users = [
        { id: "u1", name: "Admin", email: "admin@x.com", passwordHash: "h", role: "admin" },
        { id: ownerUserId, name: "Arkar", email: "arkar@x.com", passwordHash: "h", role: "owner" },
      ];
    });

    it("updates name, email, and ownership in one call", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      const result = await updateOwner({
        ownerId: validOwnerId,
        name: "Arkar New",
        email: "arkar2@x.com",
        ownershipPercent: 40,
      });
      expect(result.success).toBe(true);

      const user = state.users.find((u) => u.id === ownerUserId);
      if (!user) throw new Error(`expected user ${ownerUserId}`);
      expect(user.name).toBe("Arkar New");
      expect(user.email).toBe("arkar2@x.com");
      const owner = state.owners.find((o) => o.id === validOwnerId);
      if (!owner) throw new Error(`expected owner ${validOwnerId}`);
      expect(owner.ownershipPercentage).toBe("40");
      expect(spies.revalidatePath).toHaveBeenCalledWith("/settings");
    });

    it("does not touch users when only ownership is updated", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      const result = await updateOwner({
        ownerId: validOwnerId,
        ownershipPercent: 50,
      });
      expect(result.success).toBe(true);
      const user = state.users.find((u) => u.id === ownerUserId);
      if (!user) throw new Error(`expected user ${ownerUserId}`);
      expect(user.name).toBe("Arkar");
      expect(user.email).toBe("arkar@x.com");
    });

    it("hashes new password and revokes sessions", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      const result = await updateOwner({
        ownerId: validOwnerId,
        password: "NewPassword123!@#",
      });
      expect(result.success).toBe(true);
      const user = state.users.find((u) => u.id === ownerUserId);
      if (!user) throw new Error(`expected user ${ownerUserId}`);
      expect(user.passwordHash).toBe("hash:NewPassword123!@#");
      expect(revokedRef.revokedUserId).toBe(ownerUserId);
    });

    it("rejects when ownerId is not a uuid", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      const result = await updateOwner({ ownerId: "not-uuid", name: "X" });
      expect(result.success).toBe(false);
    });

    it("rejects when owner does not exist", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      const result = await updateOwner({
        ownerId: "11111111-1111-4111-8111-111111111199",
        name: "X",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not found/i);
      }
    });

    it("rejects email conflict with another user", async () => {
      const { updateOwner } = await import("@/actions/owner-actions");

      state.users.push({
        id: "u-other",
        name: "Other",
        email: "other@x.com",
        passwordHash: "h",
        role: "owner",
      });
      const result = await updateOwner({
        ownerId: validOwnerId,
        email: "other@x.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/email/i);
      }
    });
  });

  describe("archiveOwner", () => {
    const validOwnerId = "11111111-1111-4111-8111-111111111222";
    const ownerUserId = "11111111-1111-4111-8111-111111111220";

    beforeEach(() => {
      state.owners = [
        {
          id: validOwnerId,
          userId: ownerUserId,
          slot: "B",
          ownershipPercentage: "33.33",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      state.users = [
        { id: "u1", name: "Admin", email: "admin@x.com", passwordHash: "h", role: "admin" },
        {
          id: ownerUserId,
          name: "Author",
          email: "author@x.com",
          passwordHash: "h",
          role: "owner",
        },
      ];
    });

    it("sets deletedAt on owner, archivedAt on user, and revokes sessions", async () => {
      const { archiveOwner } = await import("@/actions/owner-actions");

      const result = await archiveOwner({ ownerId: validOwnerId });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.freedSlot).toBe("B");
      }

      const owner = state.owners.find((o) => o.id === validOwnerId);
      if (!owner) throw new Error(`expected owner ${validOwnerId}`);
      expect(owner.deletedAt).toBeInstanceOf(Date);
      const user = state.users.find((u) => u.id === ownerUserId);
      if (!user) throw new Error(`expected user ${ownerUserId}`);
      expect(user.archivedAt).toBeInstanceOf(Date);
      expect(revokedRef.revokedUserId).toBe(ownerUserId);
      expect(spies.revalidatePath).toHaveBeenCalledWith("/settings");
    });

    it("rejects when owner is already archived", async () => {
      const { archiveOwner } = await import("@/actions/owner-actions");

      const firstOwner = state.owners[0];
      if (!firstOwner) throw new Error("expected owner in state");
      firstOwner.deletedAt = new Date("2024-05-01");
      const result = await archiveOwner({ ownerId: validOwnerId });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/already archived/i);
      }
    });

    it("rejects when owner does not exist", async () => {
      const { archiveOwner } = await import("@/actions/owner-actions");

      const result = await archiveOwner({ ownerId: "11111111-1111-4111-8111-111111111199" });
      expect(result.success).toBe(false);
    });

    it("rejects when ownerId is not a uuid", async () => {
      const { archiveOwner } = await import("@/actions/owner-actions");

      const result = await archiveOwner({ ownerId: "not-uuid" });
      expect(result.success).toBe(false);
    });
  });

  describe("auth gating", () => {
    it("requireAdmin is called for every action", async () => {
      const { listOwnersForSettings, createOwner, updateOwner, archiveOwner } = await import(
        "@/actions/owner-actions"
      );

      state.owners = [
        {
          id: "11111111-1111-4111-8111-111111111333",
          userId: "u-x",
          slot: "A",
          ownershipPercentage: "33",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      state.users = [
        { id: "u1", name: "Admin", email: "admin@x.com", passwordHash: "h", role: "admin" },
        { id: "u-x", name: "X", email: "x@x.com", passwordHash: "h", role: "owner" },
      ];

      await listOwnersForSettings();
      await createOwner({
        name: "n",
        email: "n@x.com",
        password: "Password123!@#",
        ownershipPercent: 10,
      });
      await updateOwner({ ownerId: "11111111-1111-4111-8111-111111111333", name: "y" });
      await archiveOwner({ ownerId: "11111111-1111-4111-8111-111111111333" });

      expect(spies.requireAdmin).toHaveBeenCalledTimes(4);
    });

    it("propagates requireAdmin errors (redirect, not caught by try-catch)", async () => {
      const { listOwnersForSettings } = await import("@/actions/owner-actions");

      state.requireAdminError = new Error("NEXT_REDIRECT");
      await expect(listOwnersForSettings()).rejects.toThrow("NEXT_REDIRECT");
    });
  });
});
