import { defineConfig } from "drizzle-kit";
import path from "path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, "..", "..", ".env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
