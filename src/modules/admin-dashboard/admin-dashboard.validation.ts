import { z } from "zod";

export const recentLimitQuerySchema = z.object({
  limit: z.string().regex(/^[1-9]\d*$/).default("6").transform(Number).refine((value) => value <= 12),
}).strict();

export const appointmentAnalyticsQuerySchema = z.object({
  days: z.string().regex(/^[1-9]\d*$/).default("30").transform(Number).refine((value) => value >= 7 && value <= 90),
}).strict();
