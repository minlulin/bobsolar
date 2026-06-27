import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBackup, deleteBackup, getBackupHistory } from "@/actions/backup-actions";

const state = vi.hoisted(() => ({
  role: "admin" as "admin" | "owner" | "standard",
  blobToken: "token123" as string | undefined,
  blobs: [] as { pathname: string; url: string; uploadedAt: Date; size: number }[],
}));

const spies = vi.hoisted(() => ({
  put: vi.fn(async () => ({ url: "https://blob.com/backup.json", size: 1024 })),
  list: vi.fn(async () => ({ blobs: state.blobs })),
  del: vi.fn(async () => {}),
}));

vi.mock("@vercel/blob", () => ({
  put: spies.put,
  list: spies.list,
  del: spies.del,
}));

vi.mock("@/lib/auth/validate", () => ({
  requireAdmin: vi.fn(async () => {
    if (state.role !== "admin") throw new Error("Unauthorized");
    return { userId: "admin1" };
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async () => []),
    })),
  },
}));

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
});
