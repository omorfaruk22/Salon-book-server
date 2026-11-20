import type { NextFunction, Request, Response } from "express";
import { adminAppointmentsQuerySchema } from "./appointment.validation";
import { confirmAppointment, getAdminAppointment, isAppointmentId, listAdminAppointments, setAdminStatus } from "./appointment.service";

function badRequest(res: Response, message: string) {
  return res.status(400).json({ data: null, error: { message } });
}

function withoutCustomerAuthId<T extends { customerId: string }>(appointment: T) {
  const { customerId: _customerId, ...safeAppointment } = appointment;
  return safeAppointment;
}

function appointmentError(error: unknown, res: Response, next: NextFunction) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500;
  if (status >= 400 && status < 500) return res.status(status).json({ data: null, error: { message: error instanceof Error ? error.message : "Appointment operation failed." } });
  return next(error);
}

export async function listAdminAppointmentsController(req: Request, res: Response, next: NextFunction) {
  const parsed = adminAppointmentsQuerySchema.safeParse(req.query);
  if (!parsed.success) return badRequest(res, "Invalid appointment filters. Check search, status, payment status, sort, page, and limit.");
  try {
    const result = await listAdminAppointments(parsed.data);
    return res.json({
      data: result.appointments,
      error: null,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        stats: result.stats,
      },
    });
  } catch (error) { return next(error); }
}

export async function adminAppointmentDetailsController(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isAppointmentId(id)) return badRequest(res, "Invalid appointment id");
  try {
    const appointment = await getAdminAppointment(id);
    if (!appointment) return res.status(404).json({ data: null, error: { message: "Appointment not found" } });
    return res.json({ data: appointment, error: null });
  } catch (error) { return next(error); }
}

export async function confirmAdminAppointmentController(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isAppointmentId(id)) return badRequest(res, "Invalid appointment id");
  try { return res.json({ data: withoutCustomerAuthId(await confirmAppointment(id)), error: null }); }
  catch (error) { return appointmentError(error, res, next); }
}

export async function cancelAdminAppointmentController(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isAppointmentId(id)) return badRequest(res, "Invalid appointment id");
  try { return res.json({ data: withoutCustomerAuthId(await setAdminStatus(id, "cancelled")), error: null }); }
  catch (error) { return appointmentError(error, res, next); }
}

export async function completeAdminAppointmentController(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isAppointmentId(id)) return badRequest(res, "Invalid appointment id");
  try { return res.json({ data: withoutCustomerAuthId(await setAdminStatus(id, "completed")), error: null }); }
  catch (error) { return appointmentError(error, res, next); }
}
