import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.union([z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/), z.literal("")]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a name or phone number to update");

export const userStatusSchema = z.object({ status: z.enum(["active", "blocked"]) }).strict();
