import { Types } from "mongoose";
import { Service, ServiceRecord } from "../services/service.model";
import { Appointment, AppointmentRecord, AppointmentStatus } from "./appointment.model";
import {
  APPOINTMENT_TIME_SLOTS,
  AppointmentTimeSlot,
  BUSINESS_DAY_END_MINUTES,
  buildSlotAvailability,
  getDateInSalonTimeZone,
  getReservedMinuteKeys,
  isAppointmentTimeSlot,
  isValidAppointmentDate,
  MAX_SERVICE_DURATION_MINUTES,
  SALON_TIME_ZONE,
  toSalonDateTimeUtc,
} from "./appointment.schedule";

function httpError(status: number, message: string) { return Object.assign(new Error(message), { status }); }
function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && Number((error as { code: unknown }).code) === 11000;
}

type ExistingAppointmentWindow = Pick<AppointmentRecord, "startsAt" | "serviceSnapshot">;

async function findOverlappingAppointments(startsAt: Date, durationMinutes: number, excludeId?: Types.ObjectId) {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const earliestPossibleStart = new Date(startsAt.getTime() - MAX_SERVICE_DURATION_MINUTES * 60_000);
  const appointments = await Appointment.find({
    status: { $in: ["pending", "confirmed"] },
    startsAt: { $gte: earliestPossibleStart, $lt: endsAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("startsAt serviceSnapshot.durationMinutes").lean().exec() as unknown as ExistingAppointmentWindow[];

  return appointments.filter((appointment) => {
    const existingStart = new Date(appointment.startsAt);
    const requestedEnd = startsAt.getTime() + durationMinutes * 60_000;
    const existingEnd = existingStart.getTime() + appointment.serviceSnapshot.durationMinutes * 60_000;
    return startsAt.getTime() < existingEnd && existingStart.getTime() < requestedEnd;
  });
}

export async function getAppointmentAvailability(input: { serviceId: string; date: string }) {
  if (!isValidAppointmentDate(input.date)) throw httpError(400, "Choose a valid appointment date");
  if (input.date < getDateInSalonTimeZone()) throw httpError(400, "Past dates are not available for booking");
  const service = await Service.findOne({ _id: input.serviceId, isActive: true }).lean().exec() as unknown as (ServiceRecord & { _id: Types.ObjectId }) | null;
  if (!service) throw httpError(404, "Active service not found");

  const slotStarts = APPOINTMENT_TIME_SLOTS.map((slot) => toSalonDateTimeUtc(input.date, slot.start));
  const firstStart = Math.min(...slotStarts.map((date) => date.getTime()));
  const lastStart = Math.max(...slotStarts.map((date) => date.getTime()));
  const appointments = await Appointment.find({
    status: { $in: ["pending", "confirmed"] },
    startsAt: {
      $gte: new Date(firstStart - MAX_SERVICE_DURATION_MINUTES * 60_000),
      $lt: new Date(lastStart + service.durationMinutes * 60_000),
    },
  }).select("startsAt serviceSnapshot.durationMinutes").lean().exec() as unknown as ExistingAppointmentWindow[];

  return {
    date: input.date,
    timeZone: SALON_TIME_ZONE,
    service: { _id: String(service._id), name: service.name, category: service.category, price: service.price, durationMinutes: service.durationMinutes },
    slots: buildSlotAvailability(input.date, service.durationMinutes, appointments),
  };
}

export async function requestAppointment(customerId: string, input: { serviceId: string; appointmentDate: string; timeSlot: string; customerNote?: string }) {
  if (!isValidAppointmentDate(input.appointmentDate)) throw httpError(400, "Choose a valid appointment date");
  if (!isAppointmentTimeSlot(input.timeSlot)) throw httpError(400, "Choose a valid salon time slot");
  if (input.appointmentDate < getDateInSalonTimeZone()) throw httpError(400, "Past dates are not available for booking");

  const service = await Service.findOne({ _id: input.serviceId, isActive: true }).lean().exec() as unknown as (ServiceRecord & { _id: Types.ObjectId }) | null;
  if (!service) throw httpError(404, "Active service not found");

  const timeSlot = input.timeSlot as AppointmentTimeSlot;
  const startsAt = toSalonDateTimeUtc(input.appointmentDate, timeSlot);
  if (startsAt.getTime() < Date.now() + 60 * 60_000) throw httpError(400, "Choose an appointment time at least one hour from now");
  const startMinuteOfDay = Number(timeSlot.slice(0, 2)) * 60 + Number(timeSlot.slice(3));
  if (startMinuteOfDay + service.durationMinutes > BUSINESS_DAY_END_MINUTES) throw httpError(409, "This service does not fit before the salon closes");

  const overlaps = await findOverlappingAppointments(startsAt, service.durationMinutes);
  if (overlaps.length) throw httpError(409, "This time is no longer available. Please choose another slot.");

  try {
    return await Appointment.create({
      customerId,
      serviceId: service._id,
      serviceSnapshot: {
        name: service.name,
        category: service.category,
        description: service.description,
        imageUrl: service.imageUrl,
        durationMinutes: service.durationMinutes,
        price: service.price,
      },
      appointmentDate: input.appointmentDate,
      timeSlot,
      startsAt,
      customerNote: input.customerNote?.trim() || undefined,
      status: "pending",
      paymentStatus: "unpaid",
      slotReserved: true,
      reservedSlotKeys: getReservedMinuteKeys(startsAt, service.durationMinutes),
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw httpError(409, "This time was just booked by someone else. Please select another slot.");
    throw error;
  }
}

export async function listCustomerAppointments(customerId: string) {
  return Appointment.find({ customerId }).sort({ startsAt: -1 }).lean();
}

export async function getCustomerAppointmentStats(customerId: string) {
  const [stats] = await Appointment.aggregate<{
    totalAppointments: number;
    pendingAppointments: number;
    confirmedAppointments: number;
    cancelledAppointments: number;
  }>([
    { $match: { customerId } },
    { $group: {
      _id: null,
      totalAppointments: { $sum: 1 },
      pendingAppointments: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
      confirmedAppointments: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
      cancelledAppointments: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
    } },
    { $project: { _id: 0, totalAppointments: 1, pendingAppointments: 1, confirmedAppointments: 1, cancelledAppointments: 1 } },
  ]).exec();
  return stats ?? { totalAppointments: 0, pendingAppointments: 0, confirmedAppointments: 0, cancelledAppointments: 0 };
}

export async function listMyAppointments(customerId: string, input: { status?: "pending" | "confirmed" | "cancelled"; search: string; sort: "newest" | "oldest"; page: number; limit: number }) {
  const filter: Record<string, unknown> = { customerId };
  if (input.status) filter.status = input.status;
  if (input.search) {
    const escapedSearch = input.search.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
    const searchConditions: Record<string, unknown>[] = [{ "serviceSnapshot.name": { $regex: escapedSearch, $options: "i" } }];
    if (isAppointmentId(input.search)) searchConditions.push({ _id: new Types.ObjectId(input.search) });
    filter.$or = searchConditions;
  }
  const direction = input.sort === "oldest" ? 1 : -1;
  const [appointments, total] = await Promise.all([
    Appointment.find(filter).sort({ createdAt: direction, _id: direction }).skip((input.page - 1) * input.limit).limit(input.limit).lean().exec(),
    Appointment.countDocuments(filter).exec(),
  ]);
  const enrichedAppointments = await enrichAppointmentServiceSnapshots(appointments as unknown as (AppointmentRecord & { _id: Types.ObjectId })[]);
  return { appointments: enrichedAppointments, total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) };
}

export async function getMyAppointment(customerId: string, id: string) {
  const appointment = await Appointment.findOne({ _id: id, customerId }).lean().exec() as unknown as (AppointmentRecord & { _id: Types.ObjectId }) | null;
  if (!appointment) return null;
  const [enriched] = await enrichAppointmentServiceSnapshots([appointment]);
  return enriched;
}

async function enrichAppointmentServiceSnapshots(appointments: (AppointmentRecord & { _id: Types.ObjectId })[]) {
  const serviceIds = [...new Set(appointments
    .filter(({ serviceSnapshot }) => !serviceSnapshot.category || serviceSnapshot.description === undefined || serviceSnapshot.imageUrl === undefined)
    .map(({ serviceId }) => String(serviceId)))];
  const services = serviceIds.length
    ? await Service.find({ _id: { $in: serviceIds } }).select("category description imageUrl").lean().exec()
    : [];
  const servicesById = new Map(services.map((service) => [String(service._id), service]));
  return appointments.map((appointment) => {
    const service = servicesById.get(String(appointment.serviceId));
    return {
      ...appointment,
      serviceSnapshot: {
        ...appointment.serviceSnapshot,
        category: appointment.serviceSnapshot.category ?? service?.category ?? "Salon service",
        description: appointment.serviceSnapshot.description ?? service?.description ?? "Service information is no longer available.",
        imageUrl: appointment.serviceSnapshot.imageUrl ?? service?.imageUrl,
      },
    };
  });
}

export async function listAdminAppointments(status?: string) {
  const filter = status && ["pending", "confirmed", "cancelled", "completed"].includes(status) ? { status } : {};
  return Appointment.find(filter).sort({ startsAt: 1 }).lean();
}

export async function getAppointment(id: string) { return await Appointment.findById(id).lean().exec() as unknown as (AppointmentRecord & { _id: Types.ObjectId }) | null; }

export async function cancelCustomerAppointment(id: string, customerId: string) {
  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, customerId, status: "pending" },
    { $set: { status: "cancelled", cancelledBy: "customer", slotReserved: false, reservedSlotKeys: [] } },
    { new: true, runValidators: true },
  ).lean().exec();
  if (appointment) return appointment;

  const existing = await Appointment.findById(id).select("customerId status").lean().exec();
  if (!existing) throw httpError(404, "Appointment not found");
  if (existing.customerId !== customerId) throw httpError(403, "You cannot cancel another customer’s appointment");
  if (existing.status === "cancelled") throw httpError(409, "This appointment is already cancelled");
  throw httpError(409, "Only pending appointments can be cancelled");
}

export async function confirmAppointment(id: string) {
  const appointment = await Appointment.findById(id).exec();
  if (!appointment) throw httpError(404, "Appointment not found");
  if (appointment.status !== "pending") throw httpError(409, "Only pending appointments can be confirmed");

  const overlaps = await findOverlappingAppointments(appointment.startsAt, appointment.serviceSnapshot.durationMinutes, appointment._id);
  if (overlaps.length) throw httpError(409, "This time overlaps another active appointment");

  try {
    const confirmed = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: "pending" },
      { $set: { status: "confirmed", slotReserved: true, reservedSlotKeys: getReservedMinuteKeys(appointment.startsAt, appointment.serviceSnapshot.durationMinutes) } },
      { new: true, runValidators: true },
    ).exec();
    if (!confirmed) throw httpError(409, "This appointment has already changed");
    return confirmed.toObject();
  } catch (error) {
    if (isDuplicateKey(error)) throw httpError(409, "This time overlaps another active appointment");
    throw error;
  }
}

export async function setAdminStatus(id: string, status: Extract<AppointmentStatus, "cancelled" | "completed">) {
  const allowed = status === "cancelled" ? ["pending", "confirmed"] : ["confirmed"];
  const appointment = await Appointment.findOneAndUpdate(
    { _id: id, status: { $in: allowed } },
    { $set: {
      status,
      slotReserved: false,
      reservedSlotKeys: [],
      ...(status === "cancelled" ? { cancelledBy: "admin" } : {}),
    } },
    { new: true, runValidators: true },
  ).exec();
  if (appointment) return appointment.toObject();

  const existing = await Appointment.findById(id).select("status").lean().exec();
  if (!existing) throw httpError(404, "Appointment not found");
  throw httpError(409, `Cannot mark a ${existing.status} appointment as ${status}`);
}

export function isAppointmentId(value: string) { return /^[a-f\d]{24}$/i.test(value); }
