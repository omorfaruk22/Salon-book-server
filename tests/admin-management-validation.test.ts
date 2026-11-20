import assert from "node:assert/strict";
import test from "node:test";
import { adminAppointmentsQuerySchema } from "../src/modules/appointments/appointment.validation";
import { adminCustomerActionSchema, adminCustomersQuerySchema } from "../src/modules/users/admin-user.validation";

test("admin appointment query trims search and validates pagination and filters", () => {
  assert.deepEqual(adminAppointmentsQuerySchema.parse({
    search: "  Omor  ", status: "confirmed", paymentStatus: "paid", sort: "appointment-asc", page: "2", limit: "20",
  }), {
    search: "Omor", status: "confirmed", paymentStatus: "paid", sort: "appointment-asc", page: 2, limit: 20,
  });
  assert.deepEqual(adminAppointmentsQuerySchema.parse({}), {
    search: "", status: "all", paymentStatus: "all", sort: "newest", page: 1, limit: 10,
  });
  assert.equal(adminAppointmentsQuerySchema.safeParse({ status: "refunded" }).success, false);
  assert.equal(adminAppointmentsQuerySchema.safeParse({ paymentStatus: "processing" }).success, false);
  assert.equal(adminAppointmentsQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(adminAppointmentsQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.equal(adminAppointmentsQuerySchema.safeParse({ extra: "ignored" }).success, false);
});

test("admin customer query trims search and validates status, sort, and pagination", () => {
  assert.deepEqual(adminCustomersQuerySchema.parse({ search: "  faruk@example.com ", status: "blocked", sort: "name-asc", page: "3", limit: "15" }), {
    search: "faruk@example.com", status: "blocked", sort: "name-asc", page: 3, limit: 15,
  });
  assert.equal(adminCustomersQuerySchema.safeParse({ status: "admin" }).success, false);
  assert.equal(adminCustomersQuerySchema.safeParse({ sort: "email-desc" }).success, false);
  assert.equal(adminCustomersQuerySchema.safeParse({ limit: "100" }).success, false);
  assert.equal(adminCustomersQuerySchema.safeParse({ page: "1.5" }).success, false);
});

test("customer block and unblock actions reject client-supplied fields", () => {
  assert.deepEqual(adminCustomerActionSchema.parse({}), {});
  assert.equal(adminCustomerActionSchema.safeParse({ status: "admin" }).success, false);
  assert.equal(adminCustomerActionSchema.safeParse({ role: "admin" }).success, false);
});
