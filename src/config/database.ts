import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { env } from "./env";
import { ensureAppointmentReservationIndex } from "../modules/appointments/appointment.model";
import { ensureTransactionIndexes } from "../modules/transactions/transaction.model";

const uri = env.MONGODB_URI;
const databaseName = decodeURIComponent(new URL(uri).pathname.slice(1)) || "salonbook";
export const mongoClient = new MongoClient(uri);
export const authDatabase = mongoClient.db(databaseName);

export type DatabaseStatus = "disconnected" | "connecting" | "connected";
let databaseStatus: DatabaseStatus = "disconnected";
let connectionPromise: Promise<void> | null = null;

export function getDatabaseStatus(): DatabaseStatus {
  if (databaseStatus === "connected" && mongoose.connection.readyState !== 1) return "disconnected";
  return databaseStatus;
}

export async function connectDatabase() {
  if (databaseStatus === "connected") return;
  if (connectionPromise) return connectionPromise;

  databaseStatus = "connecting";
  connectionPromise = (async () => {
    try {
      await mongoClient.connect();
      await authDatabase.command({ ping: 1 });
      await mongoose.connect(uri, { dbName: databaseName, maxPoolSize: 10 });
      await ensureAppointmentReservationIndex();
      await ensureTransactionIndexes();
      databaseStatus = "connected";
      console.info(`Connected to MongoDB database: ${databaseName}`);
    } catch (error) {
      databaseStatus = "disconnected";
      await Promise.allSettled([mongoose.disconnect(), mongoClient.close()]);
      throw error;
    }
  })();

  try {
    await connectionPromise;
  } finally {
    if (getDatabaseStatus() !== "connected") connectionPromise = null;
  }
}

export async function closeDatabase() {
  databaseStatus = "disconnected";
  connectionPromise = null;
  await Promise.allSettled([mongoose.disconnect(), mongoClient.close()]);
}
