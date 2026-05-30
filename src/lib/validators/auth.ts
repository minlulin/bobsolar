import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").min(1, "Email is required"),
  password: z.string().trim().min(1, "Password is required"),
});

/** Shared password validation rules — SSoT for all password fields. */
export const passwordValidationSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const changePasswordSchema = z.object({
  currentPassword: z.string().trim().min(1, "Current password is required"),
  newPassword: passwordValidationSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
