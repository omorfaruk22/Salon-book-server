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

export const adminStatusSchema = z.object({ status: z.enum(["cancelled", "completed"]) }).strict();
