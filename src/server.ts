import { env } from "./config/env";
import { sanitizeLogMessage } from "./utils/sanitize";
import type { Server } from "node:http";

async function startServer() {
  const { connectDatabase, closeDatabase } = await import("./config/database");
  let httpServer: Server | null = null;
  let stopping = false;
  let startupStage = "database connection and index setup";

  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.info(`[server] ${signal} received; shutting down`);
    if (httpServer) await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    await closeDatabase();
  }

  try {
    await connectDatabase();
    // Better Auth initializes MongoDB indexes during module setup; only import it after DB is ready.
    startupStage = "application initialization";
    const { createApp } = await import("./app");
    const app = createApp();
    httpServer = app.listen(env.PORT, () => console.info(`SalonBook API listening on port ${env.PORT}`));
    httpServer.once("error", (error) => {
      const errorCode = (error as NodeJS.ErrnoException).code;
      console.error(`[server:error] ${errorCode ?? error.name ?? "ListenError"}`);
      process.exitCode = 1;
      void shutdown("listen error");
    });
    process.once("SIGINT", () => { void shutdown("SIGINT"); });
    process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  } catch (error) {
    const details = env.NODE_ENV === "production"
      ? `startup ${startupStage} failed: ${safeStartupDiagnostic(error)}`
      : safeStartupMessage(error);
    console.error(`[server:error] ${details}`);
    await closeDatabase();
    process.exitCode = 1;
  }
}

void startServer();

function safeStartupMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  return sanitizeLogMessage(message);
}

function safeStartupDiagnostic(error: unknown) {
  const value = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = typeof value.code === "string" || typeof value.code === "number" ? ` code=${String(value.code)}` : "";
  const codeName = typeof value.codeName === "string" ? ` codeName=${value.codeName}` : "";
  return sanitizeLogMessage(`${name}${code}${codeName}: ${error instanceof Error ? error.message : "Unknown startup error"}`);
}
