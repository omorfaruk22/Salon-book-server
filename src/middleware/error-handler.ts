import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";

type ErrorWithStatus = Error & { status?: unknown; statusCode?: unknown; code?: unknown };

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const typedError = asError(error);
  const status = getStatus(typedError);
  const isServerError = status >= 500;
  const message = publicMessage(typedError, status);

  // Avoid logging exception messages or objects: driver/provider errors can contain sensitive details.
  const errorName = typedError.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) || "Error";
  const logLine = `[api:error] ${req.method} ${req.path} ${status} ${errorName}`;
  if (isServerError) console.error(logLine);
  else console.warn(logLine);

  res.status(status).json({ data: null, error: { message } });
};

function asError(error: unknown): ErrorWithStatus {
  if (error instanceof Error) return error as ErrorWithStatus;
  return Object.assign(new Error("Request failed"), { name: "UnknownError" });
}

function getStatus(error: ErrorWithStatus): number {
  if (error.code === 11000) return 409;
  if (error.name === "ValidationError" || error.name === "CastError") return 400;
  const candidate = Number(error.statusCode ?? error.status);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function publicMessage(error: ErrorWithStatus, status: number): string {
  if (error.code === 11000) return "A record with that unique value already exists";
  if (error.name === "ValidationError") return "Request validation failed";
  if (error.name === "CastError") return "Invalid record identifier";
  if (status >= 500 && env.NODE_ENV === "production" && status !== 503) return "Internal server error";
  return error.message || "Request failed";
}
