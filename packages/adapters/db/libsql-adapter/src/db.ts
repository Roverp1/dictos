import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "../../schema/schema";

export async function creatLibSqlDatabase(dbUrl: string) {
  const client = createClient({ url: dbUrl });
  await client.execute("PRAGMA foreign_keys = ON;");

  const db = drizzle({ client: client, schema, casing: "snake_case" });

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../drizzle/migrations/"),
  });
}
