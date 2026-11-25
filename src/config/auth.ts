import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { z } from "zod";
import { env } from "./env";
import { authDatabase } from "./database";
import { User } from "../modules/users/user.model";

const publicRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/),
  image: z.string().url().refine((value) => /^https?:\/\//i.test(value)).optional(),
});

const googleProvider = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
  : undefined;

export const auth = betterAuth({
  appName: "SalonBook",
  // The client exposes /api/auth through its same-origin rewrite. Using that
  // public origin keeps session cookies first-party and makes the Google
  // callback return through the same proxy.
  baseURL: env.CLIENT_ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(authDatabase),
  trustedOrigins: [env.CLIENT_ORIGIN],
  rateLimit: {
    enabled: true,
    customRules: {
      "/sign-in/email": { window: 10, max: 3 },
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
  advanced: {
    // Auth requests reach Render through Vercel's external rewrite. Prefer
    // Vercel's client-IP header, then accept its standard forwarded-IP
    // fallbacks. Without a usable header Better Auth shares one rate-limit
    // bucket across visitors, which can lock out unrelated users.
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"],
    },
    // Vercel and Render are different sites. Production fetch-based auth needs
    // SameSite=None cookies; local development stays on the safer Lax default.
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    },
  },
  socialProviders: googleProvider,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const parsed = publicRegistrationSchema.safeParse(ctx.body);
      if (!parsed.success) {
        const passwordInvalid = parsed.error.issues.some((issue) => issue.path[0] === "password");
        const nameInvalid = parsed.error.issues.some((issue) => issue.path[0] === "name");
        const imageInvalid = parsed.error.issues.some((issue) => issue.path[0] === "image");
        throw new APIError("BAD_REQUEST", {
          message: passwordInvalid
            ? "Password must be at least 8 characters and include uppercase and lowercase letters."
            : nameInvalid
              ? "Enter your full name (2 to 100 characters)."
              : imageInvalid
                ? "Profile image must be a valid image URL."
                : "Enter a valid email address.",
        });
      }
      // Public signup is always a customer registration, even if a caller adds
      // an untrusted role property to the request body.
      return { context: { ...ctx, body: { ...ctx.body, ...parsed.data, role: "customer" } } };
    }),
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "customer", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const profileFields = {
            authUserId: user.id,
            name: user.name,
            email: user.email.toLowerCase(),
            role: "customer" as const,
            status: "active" as const,
            ...(user.image ? { imageUrl: user.image } : {}),
          };
          await User.updateOne(
            { authUserId: user.id },
            { $setOnInsert: profileFields },
            { upsert: true },
          );
        },
      },
      update: {
        after: async (user) => {
          const set: Record<string, string> = { name: user.name, email: user.email.toLowerCase() };
          const update: Record<string, Record<string, string>> = { $set: set };
          if (user.image) set.imageUrl = user.image;
          else update.$unset = { imageUrl: "" };
          // The Mongoose profile owns app roles and blocking state. Auth identity
          // updates must never demote an admin or unblock a customer.
          await User.updateOne({ authUserId: user.id }, update);
        },
      },
    },
  },
  plugins: [jwt({
    jwks: { keyPairConfig: { alg: "EdDSA" } },
    jwt: {
      issuer: env.CLIENT_ORIGIN,
      audience: env.CLIENT_ORIGIN,
      // API requests exchange the cookie-backed session for a bearer JWT, so
      // keep the residual access window after sign-out short.
      expirationTime: "5m",
      definePayload: ({ user }) => ({ role: user.role === "admin" ? "admin" : "customer", name: user.name, email: user.email }),
    },
  })],
});
