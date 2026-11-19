import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Types } from "mongoose";
import { env } from "../config/env";
import { User, UserRecord } from "../modules/users/user.model";

export type AppRole = "customer" | "admin";
export interface AuthenticatedRequest extends Request {
  authUser?: { id: string; profileId: string; role: AppRole };
}

const authIssuer = env.CLIENT_ORIGIN;
// Fetch the signing keys from the API service directly; tokens use the
// public same-origin auth URL exposed by the frontend proxy as iss/aud.
const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", env.BETTER_AUTH_URL));

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ data: null, error: { message: "Authentication required" } });
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: authIssuer, audience: authIssuer, algorithms: ["EdDSA"] }));
  } catch {
    return res.status(401).json({ data: null, error: { message: "Invalid or expired token" } });
  }
  try {
    if (typeof payload.sub !== "string") return res.status(401).json({ data: null, error: { message: "Invalid token subject" } });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) throw new Error("Token has no email claim");
    const profile = await User.findOneAndUpdate(
      { authUserId: payload.sub },
      // App role and block status live in the trusted Mongoose profile. A
      // missing profile is created as a customer; only the operator promotion
      // script may provision an admin.
      { $setOnInsert: { authUserId: payload.sub, name: typeof payload.name === "string" ? payload.name : "SalonBook User", email, role: "customer", status: "active" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean().exec() as unknown as (UserRecord & { _id: Types.ObjectId }) | null;
    if (!profile) throw new Error("User profile could not be loaded");
    if (profile.status === "blocked") return res.status(403).json({ data: null, error: { message: "This account is blocked. Contact the salon administrator." } });
    const role: AppRole = profile.role === "admin" ? "admin" : "customer";
    (req as AuthenticatedRequest).authUser = { id: payload.sub, profileId: String(profile._id), role };
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) return res.status(401).json({ data: null, error: { message: "Authentication required" } });
    if (!roles.includes(user.role)) return res.status(403).json({ data: null, error: { message: "Insufficient permissions" } });
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireCustomer = requireRole("customer");
