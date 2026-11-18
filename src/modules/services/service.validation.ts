import { z } from "zod";

const serviceFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(60),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().min(0).max(1000000),
  imageUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
};

export const createServiceSchema = z.object(serviceFields).strict();
export const updateServiceSchema = z.object(serviceFields).partial().strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export const serviceStatusSchema = z.object({ isActive: z.boolean() }).strict();
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
