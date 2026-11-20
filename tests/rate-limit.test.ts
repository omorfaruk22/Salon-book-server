import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createRateLimiter } from "../src/middleware/rate-limit";

function invoke(middleware: ReturnType<typeof createRateLimiter>, ip: string, now: number, skip = false) {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  let continued = false;
  const req = {
    ip,
    method: skip ? "GET" : "POST",
    path: "/api/test",
    socket: { remoteAddress: ip },
  } as unknown as Request;
  const res = {
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  middleware(req, res, (() => { continued = true; }) as never);
  return { statusCode, body, headers, continued };
}

test("rate limiter returns a consistent 429 response and resets after its window", () => {
  let now = 1_000;
  const limit = createRateLimiter({ windowMs: 60_000, maxRequests: 2, now: () => now });
  assert.equal(invoke(limit, "192.0.2.1", now).statusCode, 200);
  assert.equal(invoke(limit, "192.0.2.1", now).statusCode, 200);
  const blocked = invoke(limit, "192.0.2.1", now);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.continued, false);
  assert.deepEqual(blocked.body, { data: null, error: { message: "Too many requests. Please wait and try again." } });
  assert.equal(blocked.headers.get("Retry-After"), "60");
  assert.equal(blocked.headers.get("RateLimit-Remaining"), "0");
  now += 60_001;
  assert.equal(invoke(limit, "192.0.2.1", now).statusCode, 200);
});

test("rate limiter keeps separate identities and skipped requests do not consume quota", () => {
  const limit = createRateLimiter({ windowMs: 60_000, maxRequests: 1, now: () => 10_000, skip: (req) => req.method === "GET" });
  assert.equal(invoke(limit, "192.0.2.1", 10_000, true).continued, true);
  assert.equal(invoke(limit, "192.0.2.1", 10_000).statusCode, 200);
  assert.equal(invoke(limit, "192.0.2.2", 10_000).statusCode, 200);
  assert.equal(invoke(limit, "192.0.2.1", 10_000).statusCode, 429);
});
