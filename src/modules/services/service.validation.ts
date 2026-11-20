import { z } from "zod";

export function isMongoObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

const serviceFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(60),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().positive().max(1000000),
  imageUrl: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
};

export const createServiceSchema = z.object(serviceFields).strict();
export const updateServiceSchema = z.object(serviceFields).partial().strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export const serviceStatusSchema = z.object({ isActive: z.boolean() }).strict();

const positiveIntegerQuery = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);
const positivePageQuery = positiveIntegerQuery.refine((value) => (value - 1) * 48 <= Number.MAX_SAFE_INTEGER);

export const browseServicesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  // Keep `q` as a compatibility alias for clients that used the previous API.
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  sort: z.enum(["default", "name", "price-asc", "price-desc", "price_asc", "price_desc"]).default("default"),
  page: z.string().default("1").pipe(positivePageQuery),
  limit: z.string().default("12").pipe(positiveIntegerQuery.refine((value) => value <= 48)),
}).strict()
  .refine((query) => !(query.search !== undefined && query.q !== undefined), { path: ["search"], message: "Use either search or q, not both." })
  .transform(({ search, q, category, sort, page, limit }) => ({
    search: (search ?? q)?.trim() || undefined,
    category: category?.trim().toLowerCase() || undefined,
    sort: sort === "price-asc" || sort === "price_asc" ? "price-asc" as const
      : sort === "price-desc" || sort === "price_desc" ? "price-desc" as const
        : "default" as const,
    page,
    limit,
  }));

export type BrowseServicesQuery = z.infer<typeof browseServicesQuerySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
