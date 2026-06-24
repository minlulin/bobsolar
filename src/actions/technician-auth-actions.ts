"use server";

import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { type ActionResponse, errorResponse, successResponse } from "@/lib/utils/action-response";
import { type TechnicianLoginInput, technicianLoginSchema } from "@/lib/validators/auth";

/**
 * Technician login action.
 *
 * Technicians log in with their name and a simple PIN (stored as password_hash).
 * The name is matched case-insensitively against the user's name field.
 * Only users with the "technician" role can log in via this flow.
 */
export async function technicianLogin(data: TechnicianLoginInput): Promise<ActionResponse<null>> {
  const result = technicianLoginSchema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return errorResponse(firstIssue?.message ?? "Invalid input");
  }

  const { name, pin } = result.data;

  // Fetch all technicians and match by name (case-insensitive)
  // since Drizzle doesn't support case-insensitive comparison directly
  const allTechnicians = await db.query.users.findMany({
    where: eq(users.role, "technician"),
    columns: {
      id: true,
      name: true,
      role: true,
      passwordHash: true,
      sessionVersion: true,
      archivedAt: true,
    },
  });

  const technician = allTechnicians.find(
    (t) => t.name.toLowerCase() === name.toLowerCase() && t.archivedAt === null,
  );

  if (!technician) {
    // Don't reveal whether the name exists or not
    return errorResponse("Invalid name or PIN");
  }

  // Verify the PIN against the stored hash
  const isValid = await verifyPassword(pin, technician.passwordHash);
  if (!isValid) {
    return errorResponse("Invalid name or PIN");
  }

  // Create session
  try {
    await createSession(technician.id, technician.role, technician.sessionVersion);
  } catch (error) {
    console.error("[technicianLogin.createSession]", error);
    return errorResponse(
      "Authentication service misconfigured. Please contact your administrator.",
    );
  }

  return successResponse(null);
}
