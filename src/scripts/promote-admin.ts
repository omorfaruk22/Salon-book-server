import "dotenv/config";
import mongoose from "mongoose";
import { authDatabase, connectDatabase, mongoClient } from "../config/database";
import { User } from "../modules/users/user.model";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: npm run admin:promote -- <existing-account-email>");
  await connectDatabase();
  const result = await authDatabase.collection("user").updateOne({ email }, { $set: { role: "admin", updatedAt: new Date() } });
  if (!result.matchedCount) throw new Error("No Better Auth account found for that email. Register the account first.");
  const authUser = await authDatabase.collection("user").findOne({ email });
  if (!authUser) throw new Error("Could not load the Better Auth user profile");
  await User.updateOne(
    { authUserId: String(authUser.id ?? authUser._id) },
    { $set: { role: "admin" }, $setOnInsert: { authUserId: String(authUser.id ?? authUser._id), name: String(authUser.name), email, status: "active" } },
    { upsert: true },
  );
  console.log(`Admin role assigned to ${email}. Sign out and sign back in to refresh the JWT.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await Promise.allSettled([mongoClient.close(), mongoose.disconnect()]); });
