import { env } from "../config/env";

const knownSecrets = [
  env.MONGODB_URI,
  env.BETTER_AUTH_SECRET,
  env.STRIPE_SECRET_KEY,
  env.STRIPE_WEBHOOK_SECRET,
  env.IMGBB_API_KEY,
].filter((value): value is string => typeof value === "string" && value.length >= 8);

export function sanitizeLogMessage(value: string) {
  let sanitized = value;
  for (const secret of knownSecrets) sanitized = sanitized.split(secret).join("[secret redacted]");
  return sanitized
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[MongoDB URI redacted]")
    .replace(/\b(?:sk_(?:test|live)_|whsec_)[A-Za-z0-9]+\b/g, "[payment secret redacted]")
    .replace(/\b(?:bearer\s+)[A-Za-z0-9._~-]+/gi, "Bearer [token redacted]")
    .slice(0, 500);
}
