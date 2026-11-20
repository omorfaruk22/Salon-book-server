import { z } from "zod";

export const checkoutSchema = z.object({ appointmentId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid appointment id") }).strict();

const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);
const dateQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

export const transactionListQuerySchema = z.object({
  page: z.string().default("1").pipe(positiveInteger.refine((value) => value <= 10000)),
  limit: z.string().default("25").pipe(positiveInteger.refine((value) => value <= 50)),
}).strict();

export const adminTransactionsQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "pending", "paid", "failed", "refunded"]).default("all"),
  dateFrom: dateQuery.optional(),
  dateTo: dateQuery.optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.string().default("1").pipe(positiveInteger.refine((value) => value <= 10000)),
  limit: z.string().default("25").pipe(positiveInteger.refine((value) => value <= 50)),
}).strict().superRefine((query, context) => {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    context.addIssue({ code: "custom", path: ["dateTo"], message: "End date must be on or after the start date." });
  }
});

export type AdminTransactionsQuery = z.infer<typeof adminTransactionsQuerySchema>;
