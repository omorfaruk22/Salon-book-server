import dotenv from "dotenv";
import path from "node:path";

// Load the server project's own environment file before importing modules that read env values.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function startServer() {
  const [{ createApp }, { connectDatabase, mongoClient }] = await Promise.all([
    import("./app"),
    import("./config/database"),
  ]);
  const port = Number(process.env.PORT ?? 4000);
  const app = createApp();
  try {
    await connectDatabase();
    app.listen(port, () => console.log(`SalonBook API listening on port ${port}`));
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    await mongoClient.close();
    process.exit(1);
  }
}

void startServer();
