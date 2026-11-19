import { env } from "./config/env";
import { sanitizeLogMessage } from "./utils/sanitize";
import type { Server } from "node:http";

async function startServer() {
  const { connectDatabase, closeDatabase } = await import("./config/database");
  let httpServer: Server | null = null;
  let stopping = false;

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
    const details = env.NODE_ENV === "production" ? "startup failed; verify server configuration and database availability" : safeStartupMessage(error);
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
