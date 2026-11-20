import { z } from "zod";

export function isMongoObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

export const SERVICE_CATEGORIES = [
  "hair", "hair styling", "hair color", "hair coloring", "facial", "skin care",
  "grooming", "manicure", "pedicure", "nails", "makeup", "spa", "massage", "other",
] as const;

const categorySchema = z.string().trim().min(2).max(60).transform((value) => value.toLowerCase())
  .refine((value) => (SERVICE_CATEGORIES as readonly string[]).includes(value), "Choose a supported service category");

const hostedImageUrlSchema = z.url({ protocol: /^https$/ }).refine((value) => {
  try { return new URL(value).hostname === "i.ibb.co"; } catch { return false; }
}, "Upload a service image through ImgBB first");

const serviceFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(2000),
  category: categorySchema,
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().positive().max(1000000),
};

export const createServiceSchema = z.object({ ...serviceFields, isActive: z.boolean().default(true), imageUrl: hostedImageUrlSchema }).strict();
export const updateServiceSchema = z.object({ ...serviceFields, isActive: z.boolean(), imageUrl: hostedImageUrlSchema }).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export const serviceStatusSchema = z.object({ isActive: z.boolean() }).strict();

const positiveIntegerQuery = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);
const positivePageQuery = positiveIntegerQuery.refine((value) => (value - 1) * 48 <= Number.MAX_SAFE_INTEGER);

export const adminServicesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: categorySchema.optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  sort: z.enum(["newest", "oldest", "price-asc", "price-desc"]).default("newest"),
  page: z.string().default("1").pipe(positivePageQuery),
  limit: z.string().default("10").pipe(positiveIntegerQuery.refine((value) => value <= 48)),
}).strict().transform(({ search, category, status, sort, page, limit }) => ({
  search: search?.trim() || undefined,
  category,
  status,
  sort,
  page,
  limit,
}));

export const browseServicesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
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
export type AdminServicesQuery = z.infer<typeof adminServicesQuerySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
