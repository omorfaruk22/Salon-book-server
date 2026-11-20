import { z } from "zod";

const positiveIntegerQuery = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);

export const adminCustomersQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "blocked"]).default("all"),
  sort: z.enum(["newest", "oldest", "name-asc", "name-desc"]).default("newest"),
  page: z.string().default("1").pipe(positiveIntegerQuery),
  limit: z.string().default("10").pipe(positiveIntegerQuery.refine((value) => value <= 50)),
}).strict().transform((query) => ({ ...query, search: query.search.trim() }));

export const adminCustomerActionSchema = z.object({}).strict();

export type AdminCustomersQuery = z.infer<typeof adminCustomersQuerySchema>;
