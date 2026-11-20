import { z } from "zod";
import { isAppointmentTimeSlot, isValidAppointmentDate } from "./appointment.schedule";

export const createAppointmentSchema = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id"),
  appointmentDate: z.string().refine(isValidAppointmentDate, "Choose a valid appointment date"),
  timeSlot: z.string().refine(isAppointmentTimeSlot, "Choose an available salon time slot"),
  customerNote: z.string().trim().max(500).optional(),
}).strict();

export const appointmentAvailabilityQuerySchema = z.object({
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id"),
  date: z.string().refine(isValidAppointmentDate, "Choose a valid appointment date"),
}).strict();

export const myAppointmentsQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
  search: z.string().trim().max(100).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
}).strict();

export const adminStatusSchema = z.object({ status: z.enum(["cancelled", "completed"]) }).strict();

const positiveIntegerQuery = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);

export const adminAppointmentsQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "pending", "confirmed", "cancelled", "completed"]).default("all"),
  paymentStatus: z.enum(["all", "paid", "unpaid"]).default("all"),
  sort: z.enum(["newest", "oldest", "appointment-asc", "appointment-desc"]).default("newest"),
  page: z.string().default("1").pipe(positiveIntegerQuery),
  limit: z.string().default("10").pipe(positiveIntegerQuery.refine((value) => value <= 50)),
}).strict().transform((query) => ({ ...query, search: query.search.trim() }));

export type AdminAppointmentsQuery = z.infer<typeof adminAppointmentsQuerySchema>;
