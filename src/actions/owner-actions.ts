"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { bumpUserSessionVersion } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/validate";
import { db } from "@/lib/db";
import { owners, users } from "@/lib/db/schema";
import { PARTNER_SLOTS, type PartnerSlot } from "@/lib/domain/partners";
import { USER_CAP } from "@/lib/domain/policies";
import { type ActionResponse, successResponse } from "@/lib/utils/action-response";
import { handleActionError } from "@/lib/utils/error";
import { passwordValidationSchema } from "@/lib/validators/auth";
import { uuidSchema } from "@/lib/validators/common";

export type SafeOwner = {
  ownerId: string;
  userId: string;
  name: string;
  email: string;
  slot: PartnerSlot;
  ownershipPercentage: string;
  createdAt: Date;
};

const createOwnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: passwordValidationSchema,
  ownershipPercent: z
    .number()
    .positive("Ownership must be greater than 0")
    .max(100, "Ownership cannot exceed 100%"),
});

const updateOwnerSchema = z.object({
  ownerId: uuidSchema,
  name: z.string().trim().min(1).optional(),
  email: z.email().optional(),
  ownershipPercent: z.number().positive().max(100).optional(),
  password: passwordValidationSchema.optional(),
});

export async function listOwnersForSettings(): Promise<ActionResponse<{ owners: SafeOwner[] }>> {
  await requireAdmin();
  try {
    const rows = await db
      .select({
        ownerId: owners.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        slot: owners.slot,
        ownershipPercentage: owners.ownershipPercentage,
        createdAt: owners.createdAt,
      })
      .from(owners)
      .innerJoin(users, eq(owners.userId, users.id))
      .where(isNull(owners.deletedAt))
      .orderBy(asc(owners.slot));

    return successResponse({ owners: rows.map((r) => ({ ...r, slot: r.slot as PartnerSlot })) });
  } catch (error) {
    return handleActionError(error, "listOwnersForSettings", "Failed to load partners");
  }
}

export async function createOwner(
  rawInput: unknown,
): Promise<ActionResponse<{ ownerId: string; slot: PartnerSlot }>> {
  await requireAdmin();
  try {
    const input = createOwnerSchema.parse(rawInput);
    const passwordHash = await hashPassword(input.password);

    const { ownerId, slot } = await db.transaction(async (tx) => {
      // Hard cap: admin + owners + technicians = USER_CAP (10) total users.
      const [userCount] = await tx
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(users);
      if (userCount && userCount.count >= USER_CAP) {
        throw new Error(
          `User limit reached (${USER_CAP} max). Delete or archive an existing account first.`,
        );
      }

      // Reject duplicate email before allocating a slot.
      const existingUser = await tx.query.users.findFirst({
        where: eq(users.email, input.email),
        columns: { id: true },
      });
      if (existingUser) {
        throw new Error("A user with this email already exists.");
      }

      // Pick the next available slot (lowest of A, B, C not held).
      const heldSlots = await tx
        .select({ slot: owners.slot })
        .from(owners)
        .where(isNull(owners.deletedAt));
      const held = new Set(heldSlots.map((r) => r.slot as PartnerSlot));
      const nextSlot = PARTNER_SLOTS.find((s) => !held.has(s));
      if (!nextSlot) {
        throw new Error(
          `Maximum ${PARTNER_SLOTS.length} active partners reached. Archive one first.`,
        );
      }

      const [createdUser] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          role: "owner",
        })
        .returning({ id: users.id });
      if (!createdUser) throw new Error("Failed to create user");

      const [createdOwner] = await tx
        .insert(owners)
        .values({
          userId: createdUser.id,
          slot: nextSlot,
          ownershipPercentage: String(input.ownershipPercent),
        })
        .returning({ id: owners.id });
      if (!createdOwner) throw new Error("Failed to create owner");

      return { ownerId: createdOwner.id, slot: nextSlot };
    });

    revalidatePath("/settings");
    return successResponse({ ownerId, slot });
  } catch (error) {
    return handleActionError(error, "createOwner", "Failed to create partner");
  }
}

export async function updateOwner(
  rawInput: unknown,
): Promise<ActionResponse<{ slot: PartnerSlot }>> {
  await requireAdmin();
  try {
    const input = updateOwnerSchema.parse(rawInput);

    const result = await db.transaction(async (tx) => {
      const owner = await tx.query.owners.findFirst({
        where: eq(owners.id, input.ownerId),
        columns: { userId: true, slot: true },
      });
      if (!owner) throw new Error("Partner not found");

      const userUpdates: Partial<{ name: string; email: string; passwordHash: string }> = {};
      if (input.name !== undefined) userUpdates.name = input.name;
      if (input.email !== undefined) {
        const dup = await tx.query.users.findFirst({
          where: and(eq(users.email, input.email)),
          columns: { id: true },
        });
        if (dup && dup.id !== owner.userId) {
          throw new Error("Another user already uses this email.");
        }
        userUpdates.email = input.email;
      }
      if (input.password !== undefined) {
        userUpdates.passwordHash = await hashPassword(input.password);
      }
      if (Object.keys(userUpdates).length > 0) {
        await tx.update(users).set(userUpdates).where(eq(users.id, owner.userId));
        // Force the partner to re-authenticate after a password change.
        // Uses the outer `db` (same pattern as the old `revokeAllUserSessions`):
        // not strictly atomic with the tx above, but the failure window is
        // the same as the project's previous behaviour and `requireAuth`
        // falls back to redirecting the partner to /login either way.
        if (input.password !== undefined) {
          await bumpUserSessionVersion(owner.userId);
        }
      }

      if (input.ownershipPercent !== undefined) {
        await tx
          .update(owners)
          .set({ ownershipPercentage: String(input.ownershipPercent) })
          .where(eq(owners.id, input.ownerId));
      }

      return { slot: owner.slot as PartnerSlot };
    });

    revalidatePath("/settings");
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "updateOwner", "Failed to update partner");
  }
}

export async function archiveOwner(
  rawInput: unknown,
): Promise<ActionResponse<{ ownerId: string; freedSlot: PartnerSlot }>> {
  await requireAdmin();
  try {
    const { ownerId } = z.object({ ownerId: uuidSchema }).parse(rawInput);

    const result = await db.transaction(async (tx) => {
      const owner = await tx.query.owners.findFirst({
        where: eq(owners.id, ownerId),
        columns: { userId: true, slot: true, deletedAt: true },
      });
      if (!owner) throw new Error("Partner not found");
      if (owner.deletedAt) throw new Error("Partner is already archived");

      const now = new Date();
      await tx.update(owners).set({ deletedAt: now }).where(eq(owners.id, ownerId));
      // Soft-archive the linked user so they can no longer log in.
      await tx.update(users).set({ archivedAt: now }).where(eq(users.id, owner.userId));
      // Bump session_version (on the outer `db`) so any active sealed cookie
      // is rejected on the next request — defense in depth alongside archivedAt.
      await bumpUserSessionVersion(owner.userId);

      return { ownerId, freedSlot: owner.slot as PartnerSlot };
    });

    revalidatePath("/settings");
    return successResponse(result);
  } catch (error) {
    return handleActionError(error, "archiveOwner", "Failed to archive partner");
  }
}
