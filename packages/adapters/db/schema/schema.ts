import { sql } from "drizzle-orm";
import {
  sqliteTable,
  int,
  text,
  type AnySQLiteColumn,
  check,
  unique,
} from "drizzle-orm/sqlite-core";

export const capturesTable = sqliteTable(
  "captures",
  {
    id: int().primaryKey({ autoIncrement: true }),
    text: text().notNull(),
    directoryId: int()
      .notNull()
      .references(() => directoriesTable.id, { onDelete: "cascade" }),
    createdAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    modifiedAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [unique().on(t.text, t.directoryId)]
);

export const definitionsTable = sqliteTable("definitions", {
  id: int().primaryKey(),
  captureId: int()
    .notNull()
    .references(() => capturesTable.id, { onDelete: "cascade" }),
  text: text().notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const directoriesTable = sqliteTable(
  "directories",
  {
    id: int().primaryKey(),
    name: text().notNull(),
    parentId: int("parent_id").references(
      (): AnySQLiteColumn => directoriesTable.id,
      { onDelete: "cascade" }
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

  (t) => [
    check(
      "privacy_enum_check",
      sql`${t.privacy} IN ('private', 'public', 'unlisted')`
    ),
    unique().on(t.name, t.parentId),
  ]
);

export const promptsTable = sqliteTable("prompts", {
  id: int().primaryKey(),
  name: text(),
  text: text().notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int("modified_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const capturesAddedTable = sqliteTable("captures_added", {
  id: int().primaryKey(),
  date: text().notNull().unique(),
  count: int().notNull().default(1),
});

// server support

export const usersTable = sqliteTable("users", {
  id: int().primaryKey(), // will equal to central db id
  username: text().notNull(),
  email: text().notNull(),
  bio: text(),
  avatarUrl: text(),
});

export const sessionTable = sqliteTable("session", {
  id: int().primaryKey(),
  token: text().notNull(),
  userId: int()
    .notNull()
    .references(() => usersTable.id),
});
