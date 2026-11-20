/** Salon calendar values are always interpreted in Bangladesh time. MongoDB stores the resulting instant as UTC. */
export const SALON_TIME_ZONE = "Asia/Dhaka";
export const MAX_SERVICE_DURATION_MINUTES = 600;
export const BUSINESS_DAY_END_MINUTES = 18 * 60;

export const APPOINTMENT_TIME_SLOTS = [
  { start: "09:00", end: "10:00", label: "09:00 AM – 10:00 AM" },
  { start: "10:00", end: "11:00", label: "10:00 AM – 11:00 AM" },
  { start: "11:00", end: "12:00", label: "11:00 AM – 12:00 PM" },
  { start: "12:00", end: "13:00", label: "12:00 PM – 01:00 PM" },
  { start: "14:00", end: "15:00", label: "02:00 PM – 03:00 PM" },
  { start: "15:00", end: "16:00", label: "03:00 PM – 04:00 PM" },
  { start: "16:00", end: "17:00", label: "04:00 PM – 05:00 PM" },
  { start: "17:00", end: "18:00", label: "05:00 PM – 06:00 PM" },
] as const;

export type AppointmentTimeSlot = (typeof APPOINTMENT_TIME_SLOTS)[number]["start"];
export type SlotUnavailableReason = "too-soon" | "booked" | "outside-business-hours";
export type SlotAvailability = {
  value: AppointmentTimeSlot;
  label: string;
  available: boolean;
  reason?: SlotUnavailableReason;
};

type ExistingAppointment = { startsAt: Date | string; serviceSnapshot: { durationMinutes: number } };

const zonedDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SALON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function isValidAppointmentDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isAppointmentTimeSlot(value: string): value is AppointmentTimeSlot {
  return APPOINTMENT_TIME_SLOTS.some((slot) => slot.start === value);
}

export function getDateInSalonTimeZone(value: Date = new Date()) {
  const parts = zonedDateTimeFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function toSalonDateTimeUtc(date: string, time: AppointmentTimeSlot) {
  if (!isValidAppointmentDate(date) || !isAppointmentTimeSlot(time)) throw new RangeError("Invalid appointment date or time slot");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;

  // Resolve the requested salon wall-clock time using the configured IANA timezone.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = zonedDateTimeFormatter.formatToParts(new Date(candidate));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    const adjustment = target - represented;
    if (adjustment === 0) return new Date(candidate);
    candidate += adjustment;
  }

  throw new RangeError("This appointment time does not exist in the salon timezone");
}

export function getReservedMinuteKeys(startsAt: Date, durationMinutes: number) {
  const firstMinute = Math.floor(startsAt.getTime() / 60_000);
  return Array.from({ length: durationMinutes }, (_, index) => firstMinute + index);
}

export function intervalsOverlap(startA: Date, durationA: number, startB: Date, durationB: number) {
  const endA = startA.getTime() + durationA * 60_000;
  const endB = startB.getTime() + durationB * 60_000;
  return startA.getTime() < endB && startB.getTime() < endA;
}

export function buildSlotAvailability(
  date: string,
  durationMinutes: number,
  appointments: ExistingAppointment[],
  now: Date = new Date(),
): SlotAvailability[] {
  const today = getDateInSalonTimeZone(now);
  return APPOINTMENT_TIME_SLOTS.map((slot) => {
    const startsAt = toSalonDateTimeUtc(date, slot.start);
    if (durationMinutes > MAX_SERVICE_DURATION_MINUTES || Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3)) + durationMinutes > BUSINESS_DAY_END_MINUTES) {
      return { value: slot.start, label: slot.label, available: false, reason: "outside-business-hours" };
    }
    if (date < today || startsAt.getTime() < now.getTime() + 60 * 60_000) {
      return { value: slot.start, label: slot.label, available: false, reason: "too-soon" };
    }
    const isBooked = appointments.some((appointment) => intervalsOverlap(
      startsAt,
      durationMinutes,
      new Date(appointment.startsAt),
      appointment.serviceSnapshot.durationMinutes,
    ));
    if (isBooked) return { value: slot.start, label: slot.label, available: false, reason: "booked" };
    return { value: slot.start, label: slot.label, available: true };
  });
}
