import { sql } from "drizzle-orm";
import {
  sqliteTable,
  int,
  text,
  type AnySQLiteColumn,
  check,
  unique,
} from "drizzle-orm/sqlite-core";

export const entriesTable = sqliteTable(
  "entries",
  {
    id: int().primaryKey({ autoIncrement: true }),
    text: text().notNull(),
    folderId: int()
      .notNull()
      .references(() => foldersTable.id, { onDelete: "cascade" }),
    createdAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    modifiedAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [unique().on(t.text, t.folderId)]
);

export const descriptionsTable = sqliteTable("descriptions", {
  id: int().primaryKey(),
  entryId: int()
    .notNull()
    .references(() => entriesTable.id, { onDelete: "cascade" }),
  text: text().notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const foldersTable = sqliteTable(
  "folders",
  {
    id: int().primaryKey(),
    name: text().notNull(),
    parentId: int("parent_id").references(
      (): AnySQLiteColumn => foldersTable.id,
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

export const instructionsTable = sqliteTable("instructions", {
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

export const activityTable = sqliteTable("activity", {
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

export const outboxTable = sqliteTable("outbox", {
  id: int().primaryKey(),
  tableName: text().notNull(),
  recordId: int().notNull(), // id of the modified record
  operation: text({ enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
