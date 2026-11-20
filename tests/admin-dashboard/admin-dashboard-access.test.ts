import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { requireAdmin } from "../../src/middleware/authenticate";

function invokeAdminGuard(role?: "customer" | "admin") {
  let statusCode = 200;
  let payload: unknown;
  let continued = false;
  const req = role ? { authUser: { id: "user-1", profileId: "profile-1", role } } as unknown as Request : {} as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as unknown as Response;
  requireAdmin(req, res, () => { continued = true; });
  return { statusCode, payload, continued };
}

test("admin guard rejects customer accounts with 403", () => {
  const result = invokeAdminGuard("customer");
  assert.equal(result.statusCode, 403);
  assert.equal(result.continued, false);
  assert.deepEqual(result.payload, { data: null, error: { message: "Insufficient permissions" } });
});

test("admin guard requires authentication", () => {
  const result = invokeAdminGuard();
  assert.equal(result.statusCode, 401);
  assert.equal(result.continued, false);
});

test("admin guard allows authenticated administrators", () => {
  const result = invokeAdminGuard("admin");
  assert.equal(result.statusCode, 200);
  assert.equal(result.continued, true);
});
