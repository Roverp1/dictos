import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";
import { exit } from "process";

import * as schema from "../../schema/schema";

export async function createLibSqlDatabase(dbUrl: string) {
  const client = createClient({ url: dbUrl });
  await client.execute("PRAGMA foreign_keys = ON;");

  const db = drizzle({ client: client, schema, casing: "snake_case" });

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../drizzle/migrations/"),
  });

  await db
    .insert(schema.directoriesTable)
    .values({
      name: "/",
      parentId: null,
      privacy: "private",
    })
    .onConflictDoNothing({
      target: [schema.directoriesTable.name, schema.directoriesTable.parentId],
    })
    .catch((e) => {
      console.error("Failed to seed root directory:", e);
      throw new Error(
        "Database intialization failed: Could not seed root directory:",
        e
      );
    });

  return db;
}
