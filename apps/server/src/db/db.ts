import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "./schema";

export const createCentralDatabase = async () => {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:central.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  await client.execute("PRAGMA foreign_keys = ON;");
  const db = drizzle({ client, schema, casing: "snake_case" });

  await migrate(db, {
    // probably wont work in production
    migrationsFolder: path.resolve(__dirname, "../..drizzle/migrations"),
  });

  return db;
};

export type CentralDatabase = Awaited<ReturnType<typeof createCentralDatabase>>;
