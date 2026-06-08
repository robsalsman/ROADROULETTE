import { defineConfig } from "drizzle-kit";
import path from "path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const rootEnvPath = path.resolve(import.meta.dirname, "..", "..", ".env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(import.meta.dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
