import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { securityHeaders } from "../src/middleware/security-headers";

function invoke(production: boolean) {
  const headers = new Map<string, string>();
  let continued = false;
  const req = {} as Request;
  const res = { setHeader(name: string, value: string) { headers.set(name, value); } } as unknown as Response;
  securityHeaders(production)(req, res, (() => { continued = true; }) as never);
  return { headers, continued };
}

test("API security headers disable sniffing and framing and constrain browser features", () => {
  const result = invoke(false);
  assert.equal(result.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(result.headers.get("X-Frame-Options"), "DENY");
  assert.equal(result.headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(result.headers.has("Strict-Transport-Security"), false);
  assert.equal(result.continued, true);
});

test("HSTS is only enabled for production responses", () => {
  assert.equal(invoke(true).headers.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
});
