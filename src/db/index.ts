import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function hasValidDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return false;
  if (url.includes("ep-example-123456")) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!hasValidDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!cachedDb) {
    const sql = neon(process.env.DATABASE_URL!);
    cachedDb = drizzle(sql, { schema });
  }
  return cachedDb;
}
