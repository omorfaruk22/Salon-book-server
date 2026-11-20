import test from "node:test";
import assert from "node:assert/strict";
import { appointmentAnalyticsQuerySchema, recentLimitQuerySchema } from "../../src/modules/admin-dashboard/admin-dashboard.validation";

test("admin dashboard lists default to a bounded recent page", () => {
  assert.deepEqual(recentLimitQuerySchema.parse({}), { limit: 6 });
  assert.deepEqual(recentLimitQuerySchema.parse({ limit: "12" }), { limit: 12 });
});

test("admin dashboard lists reject unbounded or malformed limits", () => {
  for (const query of [{ limit: "0" }, { limit: "13" }, { limit: "many" }, { limit: ["2", "3"] }]) {
    assert.equal(recentLimitQuerySchema.safeParse(query).success, false);
  }
});

test("admin appointment analytics accepts only a 7 to 90 day range", () => {
  assert.deepEqual(appointmentAnalyticsQuerySchema.parse({}), { days: 30 });
  assert.deepEqual(appointmentAnalyticsQuerySchema.parse({ days: "90" }), { days: 90 });
  assert.equal(appointmentAnalyticsQuerySchema.safeParse({ days: "6" }).success, false);
  assert.equal(appointmentAnalyticsQuerySchema.safeParse({ days: "91" }).success, false);
});
