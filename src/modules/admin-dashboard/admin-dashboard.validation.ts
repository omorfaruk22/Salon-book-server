import { z } from "zod";

export const recentLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
}).strict();

export const appointmentAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
}).strict();
