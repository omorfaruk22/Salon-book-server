import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import type { AppRole, AuthenticatedRequest } from "../src/middleware/authenticate";

test("Admin role guard allows Admins and rejects customers or missing authentication", async () => {
  process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/salonbook-test";
  process.env.CLIENT_ORIGIN ||= "http://localhost:3000";
  process.env.BETTER_AUTH_URL ||= "http://localhost:4000";
  process.env.BETTER_AUTH_SECRET ||= "test-secret-value-that-is-at-least-32-chars";
  const { requireRole } = await import("../src/middleware/authenticate");
  const guard = requireRole("admin");

  async function check(role?: AppRole) {
    let statusCode = 200;
    let nextCalled = false;
    const request = { authUser: role ? { id: "auth-user", profileId: "profile-id", role } : undefined } as unknown as AuthenticatedRequest;
    const response = {
      status(code: number) { statusCode = code; return this; },
      json() { return this; },
    } as unknown as Response;
    guard(request as Request, response, (() => { nextCalled = true; }) as never);
    return { statusCode, nextCalled };
  }

  assert.deepEqual(await check("admin"), { statusCode: 200, nextCalled: true });
  assert.deepEqual(await check("customer"), { statusCode: 403, nextCalled: false });
  assert.deepEqual(await check(), { statusCode: 401, nextCalled: false });
});
