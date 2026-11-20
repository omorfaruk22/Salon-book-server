import assert from "node:assert/strict";
import test from "node:test";
import { myAppointmentsQuerySchema } from "../../src/modules/appointments/appointment.validation";
import { updateProfileSchema } from "../../src/modules/users/user.validation";

test("customer appointment query defaults to a bounded newest-first page", () => {
  assert.deepEqual(myAppointmentsQuerySchema.parse({}), { search: "", sort: "newest", page: 1, limit: 10 });
  assert.deepEqual(myAppointmentsQuerySchema.parse({ status: "confirmed", search: "  Hair Cut  ", sort: "oldest", page: "2", limit: "20" }), {
    status: "confirmed", search: "Hair Cut", sort: "oldest", page: 2, limit: 20,
  });
});

test("customer appointment query rejects unsupported status and unsafe page sizes", () => {
  assert.equal(myAppointmentsQuerySchema.safeParse({ status: "completed" }).success, false);
  assert.equal(myAppointmentsQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.equal(myAppointmentsQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(myAppointmentsQuerySchema.safeParse({ ownerId: "another-customer" }).success, false);
});

test("customer profile accepts permitted fields and an HTTPS image URL only", () => {
  assert.equal(updateProfileSchema.safeParse({ name: "Omor Faruk", phone: "+880 1712-345678", imageUrl: "https://images.example.com/profile.jpg" }).success, true);
  assert.equal(updateProfileSchema.safeParse({ name: "Omor Faruk", imageUrl: "http://images.example.com/profile.jpg" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ email: "other@example.com" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ role: "admin" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ status: "blocked" }).success, false);
});
