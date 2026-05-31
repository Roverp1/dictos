import { sql } from "drizzle-orm";
import {
  sqliteTable,
  int,
  text,
  type AnySQLiteColumn,
  check,
} from "drizzle-orm/sqlite-core";

export const entriesTable = sqliteTable("entries", {
  id: text().primaryKey(), // uuidv5 based on text+folderId
  text: text().notNull(),
  folderId: text()
    .notNull()
    .references(() => foldersTable.id, { onDelete: "cascade" }),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const descriptionsTable = sqliteTable("descriptions", {
  id: text()
    .primaryKey()
    .default(sql`(uuid_str(uuid7()))`),
  entryId: text()
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
    id: text().primaryKey(),
    name: text().notNull(),
    parentId: text("parent_id").references(
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
  ]
);

export const instructionsTable = sqliteTable("instructions", {
  id: text()
    .primaryKey()
    .default(sql`(uuid_str(uuid7()))`),
  name: text(),
  text: text().notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  modifiedAt: int("modified_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const activitiesTable = sqliteTable("activities", {
  id: text().primaryKey(), // uuidv5 based on deviceId+date
  date: text().notNull(), // ISO 8601 format
  count: int().notNull().default(1),
});

// server support

export const usersTable = sqliteTable("users", {
  id: text()
    .primaryKey()
    .default(sql`(uuid_str(uuid7()))`), // will equal to central db id
  username: text().notNull(),
  email: text().notNull(),
  bio: text(),
  avatarUrl: text(),
});

export const outboxTable = sqliteTable("outbox", {
  id: text()
    .primaryKey()
    .default(sql`(uuid_str(uuid7()))`),
  tableName: text().notNull(),
  recordId: text().notNull(), // id of the modified record
  operation: text({ enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
