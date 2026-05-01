import { sql } from "drizzle-orm";
import {
  sqliteTable,
  int,
  text,
  type AnySQLiteColumn,
  check,
} from "drizzle-orm/sqlite-core";

export const capturesTable = sqliteTable("captures", {
  id: int().primaryKey({ autoIncrement: true }),
  text: text().notNull(), // text + directoryId primary key or unique constraint?
  directoryId: int("directory_id").notNull(),
  // .references(() => directoriesTable.id, { onDelete: "cascade" }),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int("modified_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const directoriesTable = sqliteTable(
  "directories",
  {
    id: int().primaryKey(),
    name: text().notNull(), // primary key should be name + parent_id? - it will potentially eliminate possibility to create 2 direcotries with the same name in the same directory
    parentId: int("parent_id").references(
      (): AnySQLiteColumn => directoriesTable.id
    ),
    privacy: text("privacy", { enum: ["private", "public", "unlisted"] })
      .notNull()
      .default("private"),
    createdAt: int("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    modifiedAt: int("modified_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },

  (table) => [
    check(
      "privacy_enum_check",
      sql`${table.privacy} IN ('private', 'public', 'unlisted')`
    ),
  ]
);
