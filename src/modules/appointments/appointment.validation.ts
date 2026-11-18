import { z } from "zod";

export const createAppointmentSchema = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id"),
  startsAt: z.iso.datetime({ offset: true }),
  customerNote: z.string().trim().max(500).optional(),
}).strict();

export const adminStatusSchema = z.object({ status: z.enum(["cancelled", "completed"]) }).strict();
