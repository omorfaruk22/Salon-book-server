import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { authDatabase } from "./database";
import { User } from "../modules/users/user.model";

const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;
if (!baseURL || !secret) throw new Error("BETTER_AUTH_URL and BETTER_AUTH_SECRET are required");

export const auth = betterAuth({
  appName: "SalonBook",
  baseURL,
  secret,
  database: mongodbAdapter(authDatabase),
  trustedOrigins: [process.env.CLIENT_ORIGIN ?? "http://localhost:3000"],
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
