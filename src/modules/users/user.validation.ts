import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.union([z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/), z.literal("")]).optional(),
  imageUrl: z.union([z.literal(""), z.string().trim().url().max(2048).refine((value) => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, "Profile image URL must use HTTPS")]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a name or phone number to update");

export const userStatusSchema = z.object({ status: z.enum(["active", "blocked"]) }).strict();
