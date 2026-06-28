import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBackup,
  deleteBackup,
  getBackupHistory,
  restoreFromBackup,
} from "@/actions/backup-actions";

const state = vi.hoisted(() => ({
  role: "admin" as "admin" | "owner" | "standard",
  blobToken: "token123" as string | undefined,
  blobs: [] as { pathname: string; url: string; uploadedAt: Date; size: number }[],
  passwordValid: true as boolean,
  user: { id: "admin1", passwordHash: "hash" } as { id: string; passwordHash: string } | null,
  backupJson: null as object | null,
}));

const spies = vi.hoisted(() => ({
  put: vi.fn(async () => ({ url: "https://blob.com/backup.json", size: 1024 })),
  list: vi.fn(async () => ({ blobs: state.blobs })),
  del: vi.fn(async () => {}),
  get: vi.fn(
    async () =>
      null as {
        statusCode: number;
        stream: {
          getReader: () => {
            read: () => Promise<{ done: boolean; value: Uint8Array | undefined }>;
          };
        };
      } | null,
  ),
  verifyPassword: vi.fn(async () => state.passwordValid),
}));

vi.mock("@vercel/blob", () => ({
  put: spies.put,
  list: spies.list,
  del: spies.del,
  get: spies.get,
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: spies.verifyPassword,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAdmin: vi.fn(async () => {
    if (state.role !== "admin") throw new Error("Unauthorized");
    return { userId: "admin1" };
  }),
}));

vi.mock("@/lib/validators/backup", () => ({
  validateBackupFile: vi.fn((raw: unknown) => {
    if (!raw || typeof raw !== "object") return { valid: false, error: "Invalid" };
    const obj = raw as Record<string, unknown>;
    if (!obj["metadata"] || !obj["data"]) return { valid: false, error: "Missing fields" };
    return { valid: true, data: raw as object };
  }),
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(async () => []),
    })),
    query: {
      users: {
        findFirst: vi.fn(async () => state.user),
      },
    },
    delete: vi.fn(async () => ({
      where: vi.fn(async () => undefined),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb(mockDb);
    }),
  };
  return { db: mockDb };
});

describe("backup-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = "admin";
    state.blobToken = "token123";
    process.env["BLOB_READ_WRITE_TOKEN"] = state.blobToken;
    state.blobs = [
      { pathname: "backups/b1.json", url: "url1", uploadedAt: new Date("2026-06-20"), size: 100 },
      { pathname: "backups/b2.json", url: "url2", uploadedAt: new Date("2026-06-19"), size: 200 },
    ];
    state.passwordValid = true;
    state.user = { id: "admin1", passwordHash: "hash" };
    state.backupJson = {
      metadata: {
        timestamp: "2026-06-20T00:00:00Z",
        createdBy: "admin1",
        totalRows: 0,
        tables: {},
      },
      data: {},
    };
    spies.get.mockImplementation(async () => {
      const text = JSON.stringify(state.backupJson);
      const encoded = new TextEncoder().encode(text);
      let readCount = 0;
      return {
        statusCode: 200,
        stream: {
          getReader: () => ({
            read: async () => {
              readCount++;
              if (readCount === 1) {
                return { done: false, value: encoded };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      };
    });
  });

  describe("createBackup", () => {
    it("creates backup successfully", async () => {
      const res = await createBackup();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.url).toBe("https://blob.com/backup.json");
      }
      expect(spies.put).toHaveBeenCalled();
    });

    it("fails if not admin", async () => {
      state.role = "standard";
      const res = await createBackup();
      expect(res.success).toBe(false);
    });

    it("fails if blob token missing", async () => {
      delete process.env["BLOB_READ_WRITE_TOKEN"];
      const res = await createBackup();
      expect(res.success).toBe(false);
    });
  });

  describe("getBackupHistory", () => {
    it("lists backups sorted by date", async () => {
      const res = await getBackupHistory();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(2);
        expect(res.data[0]?.filename).toBe("b1.json");
      }
    });

    it("returns empty array if no token", async () => {
      delete process.env["BLOB_READ_WRITE_TOKEN"];
      const res = await getBackupHistory();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(0);
      }
    });
  });

  describe("deleteBackup", () => {
    it("deletes a backup", async () => {
      const res = await deleteBackup("https://blob.store/backups/backup-2026.json");
      expect(res.success).toBe(true);
      expect(spies.del).toHaveBeenCalledWith(
        "https://blob.store/backups/backup-2026.json",
        expect.any(Object),
      );
    });

    it("fails if not admin", async () => {
      state.role = "standard";
      const res = await deleteBackup("https://blob.store/backups/backup-2026.json");
      expect(res.success).toBe(false);
      expect(spies.del).not.toHaveBeenCalled();
    });

    it("rejects invalid backup URL", async () => {
      const res = await deleteBackup("url1");
      expect(res.success).toBe(false);
      expect(spies.del).not.toHaveBeenCalled();
    });

    it("rejects non-backup path", async () => {
      const res = await deleteBackup("https://blob.store/logos/logo.png");
      expect(res.success).toBe(false);
      expect(spies.del).not.toHaveBeenCalled();
    });
  });

  describe("restoreFromBackup", () => {
    it("fails if not admin", async () => {
      state.role = "standard";
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "pass");
      expect(res.success).toBe(false);
    });

    it("fails with incorrect password", async () => {
      state.passwordValid = false;
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "wrong");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("Incorrect password");
      }
    });

    it("fails with invalid backup URL", async () => {
      const res = await restoreFromBackup("not-a-url", "pass");
      expect(res.success).toBe(false);
    });

    it("fails with non-backup path URL", async () => {
      const res = await restoreFromBackup("https://blob.store/logos/logo.png", "pass");
      expect(res.success).toBe(false);
    });

    it("fails when blob download returns non-200", async () => {
      spies.get.mockResolvedValueOnce({
        statusCode: 404,
        stream: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
      });
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "pass");
      expect(res.success).toBe(false);
    });

    it("fails when backup file is invalid JSON", async () => {
      spies.get.mockResolvedValueOnce({
        statusCode: 200,
        stream: {
          getReader: () => {
            const encoded = new TextEncoder().encode("not-json");
            let read = false;
            return {
              read: async () => {
                if (!read) {
                  read = true;
                  return { done: false, value: encoded };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      });
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "pass");
      expect(res.success).toBe(false);
    });

    it("fails when backup file fails validation", async () => {
      spies.get.mockResolvedValueOnce({
        statusCode: 200,
        stream: {
          getReader: () => {
            const encoded = new TextEncoder().encode(JSON.stringify({}));
            let read = false;
            return {
              read: async () => {
                if (!read) {
                  read = true;
                  return { done: false, value: encoded };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      });
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "pass");
      expect(res.success).toBe(false);
    });

    it("succeeds with valid password and valid backup", async () => {
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "correct");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.totalRows).toBe(0);
        expect(typeof res.data.tables).toBe("number");
      }
      expect(spies.verifyPassword).toHaveBeenCalledWith("correct", "hash");
      expect(spies.get).toHaveBeenCalled();
    });

    it("does not attempt restore if user not found", async () => {
      state.user = null;
      const res = await restoreFromBackup("https://blob.store/backups/backup.json", "pass");
      expect(res.success).toBe(false);
      expect(spies.get).not.toHaveBeenCalled();
    });
  });
});
