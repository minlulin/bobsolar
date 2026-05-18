import { z } from "zod";

/**
 * Shared validation schemas for common types
 */

/** UUID string schema */
export const uuidSchema = z.uuid("Invalid ID format");

/** Email string schema */
export const emailSchema = z.email("Invalid email address");

/** Phone string schema */
export const phoneSchema = z
  .string()
  .min(5, "Phone number is too short")
  .max(20, "Phone number is too long");

/** MongoDB/NoSQL safe string (alphanumeric, hyphens, underscores only) */
export const safeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format");

/** Positive integer schema */
export const positiveIntSchema = z.number().int().positive();

/** Non-negative integer schema */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/** Pagination schema */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
