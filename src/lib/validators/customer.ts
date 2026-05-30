import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validators/common";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../domain/policies";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: emailSchema.optional().nullable().or(z.literal("")),
  phone: phoneSchema,
  address: z.string().max(500, "Address is too long").optional().nullable(),
  city: z.string().max(100, "City is too long").optional().nullable(),
  notes: z.string().max(2000, "Notes are too long").optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.uuid(),
});

export const customerFilterSchema = z.object({
  search: z.string().max(100, "Search query is too long").optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export const customerSearchSchema = z.string().min(1).max(100, "Search query is too long");

export type CreateCustomer = z.infer<typeof createCustomerSchema>;
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;
// Input type for callers (defaults are optional at the boundary).
export type CustomerFilter = z.input<typeof customerFilterSchema>;
// Parsed type after Zod defaults are applied.
export type CustomerFilterParsed = z.infer<typeof customerFilterSchema>;
