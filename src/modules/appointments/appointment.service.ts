import { Types } from "mongoose";
import { Service, ServiceRecord } from "../services/service.model";
import { Appointment, AppointmentRecord, AppointmentStatus } from "./appointment.model";

function httpError(status: number, message: string) { return Object.assign(new Error(message), { status }); }

export async function requestAppointment(customerId: string, input: { serviceId: string; startsAt: string; customerNote?: string }) {
  const service = await Service.findOne({ _id: input.serviceId, isActive: true }).lean().exec() as unknown as (ServiceRecord & { _id: Types.ObjectId }) | null;
  if (!service) throw httpError(404, "Active service not found");
  const startsAt = new Date(input.startsAt);
  if (startsAt.getTime() < Date.now() + 60 * 60 * 1000) throw httpError(400, "Choose an appointment time at least one hour from now");
  return Appointment.create({
    customerId,
    serviceId: service._id,
    serviceSnapshot: { name: service.name, durationMinutes: service.durationMinutes, price: service.price },
    startsAt,
    customerNote: input.customerNote,
    status: "pending",
  });
}

export async function listCustomerAppointments(customerId: string) {
  return Appointment.find({ customerId }).sort({ startsAt: -1 }).lean();
}

export async function listAdminAppointments(status?: string) {
  const filter = status && ["pending", "confirmed", "cancelled", "completed"].includes(status) ? { status } : {};
  return Appointment.find(filter).sort({ startsAt: 1 }).lean();
}

export async function getAppointment(id: string) { return await Appointment.findById(id).lean().exec() as unknown as (AppointmentRecord & { _id: Types.ObjectId }) | null; }

export async function cancelCustomerAppointment(id: string, customerId: string) {
  const appointment = await Appointment.findOne({ _id: id, customerId, status: "pending" });
  if (!appointment) throw httpError(404, "Pending appointment not found");
  appointment.status = "cancelled";
  appointment.cancelledBy = "customer";
  await appointment.save();
  return appointment.toObject();
}

export async function confirmAppointment(id: string) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw httpError(404, "Appointment not found");
  if (appointment.status !== "pending") throw httpError(409, "Only pending appointments can be confirmed");
  const wantedStart = appointment.startsAt.getTime();
  const wantedEnd = wantedStart + appointment.serviceSnapshot.durationMinutes * 60_000;
  const confirmed = await Appointment.find({ status: "confirmed", _id: { $ne: appointment._id } }).select("startsAt serviceSnapshot.durationMinutes").lean();
  const conflict = confirmed.some((item) => {
    const start = item.startsAt.getTime();
    const end = start + item.serviceSnapshot.durationMinutes * 60_000;
    return wantedStart < end && start < wantedEnd;
  });
  if (conflict) throw httpError(409, "This time overlaps another confirmed appointment");
  appointment.status = "confirmed";
  await appointment.save();
  return appointment.toObject();
}

export async function setAdminStatus(id: string, status: Extract<AppointmentStatus, "cancelled" | "completed">) {
  const appointment = await Appointment.findById(id);
  if (!appointment) throw httpError(404, "Appointment not found");
  const allowed = status === "cancelled" ? ["pending", "confirmed"] : ["confirmed"];
  if (!allowed.includes(appointment.status)) throw httpError(409, `Cannot mark a ${appointment.status} appointment as ${status}`);
  appointment.status = status;
  if (status === "cancelled") appointment.cancelledBy = "admin";
  await appointment.save();
  return appointment.toObject();
}

export function isAppointmentId(value: string) { return Types.ObjectId.isValid(value); }
