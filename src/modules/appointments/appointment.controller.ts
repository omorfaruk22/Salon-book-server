import type { NextFunction, Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { adminStatusSchema, appointmentAvailabilityQuerySchema, createAppointmentSchema, myAppointmentsQuerySchema } from "./appointment.validation";
import { cancelCustomerAppointment, confirmAppointment, getAppointment, getAppointmentAvailability, getCustomerAppointmentStats, getMyAppointment, isAppointmentId, listAdminAppointments, listCustomerAppointments, listMyAppointments, requestAppointment, setAdminStatus } from "./appointment.service";

function errorStatus(error: unknown) { return typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500; }
function message(error: unknown) { return error instanceof Error ? error.message : "Internal server error"; }
function idOrBadRequest(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!isAppointmentId(id)) { res.status(400).json({ data: null, error: { message: "Invalid appointment id" } }); return null; }
  return id;
}

export async function availability(req: Request, res: Response, next: NextFunction) {
  const parsed = appointmentAvailabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: parsed.error.issues.map((issue) => issue.message).join("; ") } });
  try { return res.json({ data: await getAppointmentAvailability(parsed.data), error: null }); }
  catch (error) { if (errorStatus(error) < 500) return res.status(errorStatus(error)).json({ data: null, error: { message: message(error) } }); next(error); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: parsed.error.issues.map((issue) => issue.message).join("; ") } });
  try {
    const customerId = (req as AuthenticatedRequest).authUser!.id;
    const appointment = await requestAppointment(customerId, parsed.data);
    return res.status(201).json({ data: appointment, error: null });
  } catch (error) { if (errorStatus(error) < 500) return res.status(errorStatus(error)).json({ data: null, error: { message: message(error) } }); next(error); }
}

export async function mine(req: Request, res: Response, next: NextFunction) {
  try { return res.json({ data: await listCustomerAppointments((req as AuthenticatedRequest).authUser!.id), error: null }); } catch (error) { next(error); }
}

export async function myStats(req: Request, res: Response, next: NextFunction) {
  try { return res.json({ data: await getCustomerAppointmentStats((req as AuthenticatedRequest).authUser!.id), error: null }); } catch (error) { next(error); }
}

export async function myAppointments(req: Request, res: Response, next: NextFunction) {
  const parsed = myAppointmentsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: parsed.error.issues.map((issue) => issue.message).join("; ") } });
  try {
    const result = await listMyAppointments((req as AuthenticatedRequest).authUser!.id, parsed.data);
    return res.json({ data: result.appointments, error: null, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) { next(error); }
}

export async function myAppointmentDetails(req: Request, res: Response, next: NextFunction) {
  const id = idOrBadRequest(req, res); if (!id) return;
  try {
    const appointment = await getMyAppointment((req as AuthenticatedRequest).authUser!.id, id);
    if (!appointment) return res.status(404).json({ data: null, error: { message: "Appointment not found" } });
    return res.json({ data: appointment, error: null });
  } catch (error) { next(error); }
}

export async function all(req: Request, res: Response, next: NextFunction) {
  try { return res.json({ data: await listAdminAppointments(typeof req.query.status === "string" ? req.query.status : undefined), error: null }); } catch (error) { next(error); }
}

export async function details(req: Request, res: Response, next: NextFunction) {
  const id = idOrBadRequest(req, res); if (!id) return;
  try {
    const appointment = await getAppointment(id);
    if (!appointment) return res.status(404).json({ data: null, error: { message: "Appointment not found" } });
    const user = (req as AuthenticatedRequest).authUser!;
    if (user.role !== "admin" && appointment.customerId !== user.id) return res.status(403).json({ data: null, error: { message: "You cannot view this appointment" } });
    return res.json({ data: appointment, error: null });
  } catch (error) { next(error); }
}

export async function cancelMine(req: Request, res: Response, next: NextFunction) {
  const id = idOrBadRequest(req, res); if (!id) return;
  try { return res.json({ data: await cancelCustomerAppointment(id, (req as AuthenticatedRequest).authUser!.id), error: null }); }
  catch (error) { if (errorStatus(error) < 500) return res.status(errorStatus(error)).json({ data: null, error: { message: message(error) } }); next(error); }
}

export async function confirm(req: Request, res: Response, next: NextFunction) {
  const id = idOrBadRequest(req, res); if (!id) return;
  try { return res.json({ data: await confirmAppointment(id), error: null }); }
  catch (error) { if (errorStatus(error) < 500) return res.status(errorStatus(error)).json({ data: null, error: { message: message(error) } }); next(error); }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  const id = idOrBadRequest(req, res); if (!id) return;
  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "Status must be cancelled or completed" } });
  try { return res.json({ data: await setAdminStatus(id, parsed.data.status), error: null }); }
  catch (error) { if (errorStatus(error) < 500) return res.status(errorStatus(error)).json({ data: null, error: { message: message(error) } }); next(error); }
}
