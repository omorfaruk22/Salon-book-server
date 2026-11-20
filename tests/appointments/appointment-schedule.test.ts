import assert from "node:assert/strict";
import test from "node:test";
import { Appointment } from "../../src/modules/appointments/appointment.model";
import {
  APPOINTMENT_TIME_SLOTS,
  buildSlotAvailability,
  getDateInSalonTimeZone,
  getReservedMinuteKeys,
  intervalsOverlap,
  isAppointmentTimeSlot,
  isValidAppointmentDate,
  toSalonDateTimeUtc,
} from "../../src/modules/appointments/appointment.schedule";
import { createAppointmentSchema } from "../../src/modules/appointments/appointment.validation";

test("validates real calendar dates and the centralized salon slot list", () => {
  assert.equal(isValidAppointmentDate("2026-11-20"), true);
  assert.equal(isValidAppointmentDate("2026-02-30"), false);
  assert.equal(isValidAppointmentDate("2026-2-03"), false);
  assert.equal(isAppointmentTimeSlot("09:00"), true);
  assert.equal(isAppointmentTimeSlot("13:00"), false);
  assert.equal(APPOINTMENT_TIME_SLOTS.length, 8);
});

test("converts Bangladesh wall-clock slot time into a UTC instant", () => {
  assert.equal(toSalonDateTimeUtc("2026-11-20", "09:00").toISOString(), "2026-11-20T03:00:00.000Z");
  assert.equal(getDateInSalonTimeZone(new Date("2026-11-19T19:00:00.000Z")), "2026-11-20");
});

test("marks past, too-soon, booked, and out-of-hours slots unavailable", () => {
  const now = new Date("2026-11-20T02:15:00.000Z"); // 08:15 in Asia/Dhaka
  const slots = buildSlotAvailability("2026-11-20", 60, [], now);
  assert.equal(slots.find((slot) => slot.value === "09:00")?.reason, "too-soon");
  assert.equal(slots.find((slot) => slot.value === "10:00")?.available, true);
  const overlapping = buildSlotAvailability("2026-11-20", 60, [
    { startsAt: new Date("2026-11-20T03:30:00.000Z"), serviceSnapshot: { durationMinutes: 30 } },
  ], new Date("2026-11-19T00:00:00.000Z"));
  assert.equal(overlapping.find((slot) => slot.value === "09:00")?.reason, "booked");
  assert.equal(buildSlotAvailability("2026-11-19", 30, [], now).every((slot) => !slot.available), true);
  assert.equal(buildSlotAvailability("2026-11-21", 120, [], now).find((slot) => slot.value === "17:00")?.reason, "outside-business-hours");
});

test("uses non-overlapping appointment intervals and minute keys for atomic conflict protection", () => {
  const first = new Date("2026-11-20T03:00:00.000Z");
  const next = new Date("2026-11-20T04:00:00.000Z");
  assert.equal(intervalsOverlap(first, 60, next, 60), false);
  assert.equal(intervalsOverlap(first, 90, next, 30), true);
  assert.equal(getReservedMinuteKeys(first, 60).at(-1), Math.floor(next.getTime() / 60_000) - 1);
  const reservationIndex = Appointment.schema.indexes().find(([keys]) => "reservedSlotKeys" in keys);
  assert.equal(reservationIndex?.[1].unique, true);
  assert.deepEqual(reservationIndex?.[1].partialFilterExpression, { slotReserved: true });
});

test("customer booking payload cannot set identity or appointment/payment status", () => {
  const valid = { serviceId: "507f1f77bcf86cd799439011", appointmentDate: "2026-11-20", timeSlot: "09:00", customerNote: "Please call on arrival" };
  assert.equal(createAppointmentSchema.safeParse(valid).success, true);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, startsAt: "2026-11-20T03:00:00.000Z" }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, customerId: "someone-else" }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, status: "confirmed" }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, paymentStatus: "paid" }).success, false);
  assert.equal(createAppointmentSchema.safeParse({ ...valid, customerNote: "x".repeat(501) }).success, false);
});

test("appointments default to pending and unpaid", () => {
  const appointment = new Appointment({
    customerId: "verified-auth-user",
    serviceId: "507f1f77bcf86cd799439011",
    serviceSnapshot: { name: "Hair Cut", durationMinutes: 30, price: 500 },
    appointmentDate: "2026-11-20",
    timeSlot: "09:00",
    startsAt: new Date("2026-11-20T03:00:00.000Z"),
    reservedSlotKeys: getReservedMinuteKeys(new Date("2026-11-20T03:00:00.000Z"), 30),
  });
  assert.equal(appointment.status, "pending");
  assert.equal(appointment.paymentStatus, "unpaid");
  assert.equal(appointment.slotReserved, true);
});
