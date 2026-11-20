import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  now?: () => number;
  maxEntries?: number;
  message?: string;
};

type Counter = { count: number; resetAt: number; touchedAt: number };

/** Small dependency-free limiter for a single API instance. Use behind the trusted
 * Render proxy and keep limits modest; a shared store is needed for multi-instance
 * global limits, while backend authorization remains authoritative. */
export function createRateLimiter(options: RateLimitOptions) {
  const counters = new Map<string, Counter>();
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? 50_000;
  let requestsSinceSweep = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skip?.(req)) return next();

    const currentTime = now();
    const identity = options.keyGenerator?.(req) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = String(identity).slice(0, 256);
    let counter = counters.get(key);
    if (!counter || currentTime >= counter.resetAt) {
      counter = { count: 0, resetAt: currentTime + options.windowMs, touchedAt: currentTime };
      counters.set(key, counter);
    }

    counter.count += 1;
    counter.touchedAt = currentTime;
    const remaining = Math.max(0, options.maxRequests - counter.count);
    res.setHeader("RateLimit-Limit", String(options.maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(counter.resetAt / 1000)));

    requestsSinceSweep += 1;
    if (requestsSinceSweep >= 256 || counters.size > maxEntries) {
      requestsSinceSweep = 0;
      for (const [entryKey, entry] of counters) {
        if (currentTime >= entry.resetAt) counters.delete(entryKey);
      }
      if (counters.size > maxEntries) {
        const oldest = [...counters.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt);
        for (const [entryKey] of oldest.slice(0, counters.size - maxEntries)) counters.delete(entryKey);
      }
    }

    if (counter.count > options.maxRequests) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((counter.resetAt - currentTime) / 1000))));
      return res.status(429).json({
        data: null,
        error: { message: options.message ?? "Too many requests. Please wait and try again." },
      });
    }
    return next();
  };
}

export function clientIdentity(req: Request) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function authenticatedIdentity(req: Request) {
  const user = (req as Request & { authUser?: { id: string } }).authUser;
  return user?.id ?? clientIdentity(req);
}
