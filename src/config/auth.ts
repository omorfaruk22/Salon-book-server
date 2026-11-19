import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { env } from "./env";
import { authDatabase } from "./database";
import { User } from "../modules/users/user.model";

export const auth = betterAuth({
  appName: "SalonBook",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(authDatabase),
  trustedOrigins: [env.CLIENT_ORIGIN],
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "customer", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await User.updateOne(
            { authUserId: user.id },
            { $setOnInsert: { authUserId: user.id, name: user.name, email: user.email.toLowerCase(), role: user.role === "admin" ? "admin" : "customer", status: "active" } },
            { upsert: true },
          );
        },
      },
      update: {
        after: async (user) => {
          await User.updateOne({ authUserId: user.id }, { $set: { name: user.name, email: user.email.toLowerCase(), role: user.role === "admin" ? "admin" : "customer" } });
        },
      },
    },
  },
  plugins: [jwt({ jwt: { definePayload: ({ user }) => ({ role: user.role === "admin" ? "admin" : "customer", name: user.name, email: user.email }) } })],
});
