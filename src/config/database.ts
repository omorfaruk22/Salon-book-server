import { MongoClient } from "mongodb";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");

export const mongoClient = new MongoClient(uri);
const databaseName = new URL(uri).pathname.slice(1) || "salonbook";
export const authDatabase = mongoClient.db(databaseName);

export async function connectDatabase() {
  await mongoClient.connect();
  await authDatabase.command({ ping: 1 });
  const mongooseUri = new URL(uri!);
  if (!mongooseUri.pathname || mongooseUri.pathname === "/") mongooseUri.pathname = "/salonbook";
  await mongoose.connect(mongooseUri.toString(), { maxPoolSize: 10 });
  console.log(`Connected to MongoDB database: ${databaseName}`);
}
