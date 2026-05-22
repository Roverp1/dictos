import { createClient } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "path";

import * as schema from "../../schema/schema";
import { isNull } from "drizzle-orm";

export const createLibSqlDatabase = async (dbUrl: string) => {
  const client = createClient({ url: dbUrl });
  await client.execute("PRAGMA foreign_keys = ON;");

  const db = drizzle({ client: client, schema, casing: "snake_case" });

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../drizzle/migrations/"),
  });

  await seedDbOnInit(db);

  return db;
};

const seedDbOnInit = async (db: LibSQLDatabase<typeof schema>) => {
  const [rootFolder] = await db
    .select()
    .from(schema.foldersTable)
    .where(isNull(schema.foldersTable.parentId));

  if (rootFolder !== undefined) return;

  await db
    .insert(schema.foldersTable)
    .values({
      name: "/",
      parentId: null,
      privacy: "private",
    })
    .catch((e) => {
      console.error("Failed to seed root folder:", e);
      throw new Error("Could not seed root folder", { cause: e });
    });
};
