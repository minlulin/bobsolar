import { z } from "zod";

/**
 * Backup file JSON schema validation.
 * The backup file contains metadata and data objects with table rows.
 */
const backupTableCountsSchema = z.record(z.string(), z.number().int().nonnegative());

export const backupFileSchema = z.object({
  metadata: z.object({
    timestamp: z.string(),
    createdBy: z.string(),
    totalRows: z.number().int().nonnegative(),
    tables: backupTableCountsSchema,
  }),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

/**
 * Validates that a parsed JSON object conforms to the expected backup file structure.
 * Returns { valid: true, data } on success or { valid: false, error } on failure.
 */
export function validateBackupFile(
  raw: unknown,
): { valid: true; data: BackupFile } | { valid: false; error: string } {
  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return { valid: false, error: firstIssue?.message ?? "Invalid backup file structure" };
  }
  return { valid: true, data: result.data };
}
