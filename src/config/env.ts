import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

// Load the server repo's .env without printing any values or replacing host-provided values.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().trim().min(1, "is required").refine(
    isMongoConnectionString,
    "must be a valid mongodb:// or mongodb+srv:// connection string",
  ),
  CLIENT_ORIGIN: z.string().url("must be a valid frontend URL").transform((value) => new URL(value).origin),
  BETTER_AUTH_URL: z.string().url("must be a valid API URL").transform((value) => value.replace(/\/+$/, "")),
  BETTER_AUTH_SECRET: z.string().trim().min(32, "must be at least 32 characters"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  IMGBB_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
}).refine(
  (value) => Boolean(value.GOOGLE_CLIENT_ID) === Boolean(value.GOOGLE_CLIENT_SECRET),
  { path: ["GOOGLE_CLIENT_SECRET"], message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must either both be set or both be empty" },
);

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  // Keep the deployed Prompt 01 names working while also accepting Prompt 03's names.
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? process.env.CLIENT_URL ?? (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000"),
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? process.env.SERVER_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  STRIPE_SECRET_KEY: optional(process.env.STRIPE_SECRET_KEY),
  STRIPE_WEBHOOK_SECRET: optional(process.env.STRIPE_WEBHOOK_SECRET),
  IMGBB_API_KEY: optional(process.env.IMGBB_API_KEY),
  GOOGLE_CLIENT_ID: optional(process.env.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: optional(process.env.GOOGLE_CLIENT_SECRET),
});

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `- ${issue.path.join(".") || "environment"}: ${issue.message}`).join("\n");
  throw new Error(`Invalid server environment configuration:\n${details}`);
}

export const env = parsed.data;

function optional(value: string | undefined) {
  return value?.trim() || undefined;
}

function isMongoConnectionString(value: string) {
  if (!/^mongodb(?:\+srv)?:\/\//i.test(value)) return false;
  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
}
