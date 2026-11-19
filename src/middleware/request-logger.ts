import type { NextFunction, Request, Response } from "express";

/** Log method, route, status and duration only; never log query strings, cookies, or bodies. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  const method = req.method;
  const path = req.path;
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(`[http] ${method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });
  next();
}
