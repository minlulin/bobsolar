import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validators/common";

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable().or(z.literal("")),
  address: z.string().max(500).optional().nullable(),
  companyName: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;
