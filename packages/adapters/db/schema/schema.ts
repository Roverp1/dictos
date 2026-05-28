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
    id: text()
      .primaryKey()
      .default(sql`(uuid7_str())`),
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
  },
  (t) => [unique().on(t.text, t.folderId)]
);

export const descriptionsTable = sqliteTable("descriptions", {
  id: text()
    .primaryKey()
    .default(sql`(uuid7_str())`),
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
    id: text()
      .primaryKey()
      .default(sql`(uuid7_str())`),
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
    unique().on(t.name, t.parentId),
  ]
);

export const instructionsTable = sqliteTable("instructions", {
  id: text()
    .primaryKey()
    .default(sql`(uuid7_str())`),
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
  id: text()
    .primaryKey()
    .default(sql`(uuid7_str())`),
  date: text().notNull().unique(),
  count: int().notNull().default(1),
});

// server support

export const usersTable = sqliteTable("users", {
  id: text()
    .primaryKey()
    .default(sql`(uuid7_str())`), // will equal to central db id
  username: text().notNull(),
  email: text().notNull(),
  bio: text(),
  avatarUrl: text(),
});

export const sessionTable = sqliteTable("session", {
  id: int().primaryKey(),
  token: text().notNull(),
  userId: text()
    .notNull()
    .references(() => usersTable.id),
  tursoUrl: text(),
  tursoToken: text(),
});

export const outboxTable = sqliteTable("outbox", {
  id: text()
    .primaryKey()
    .default(sql`(uuid7_str())`),
  tableName: text().notNull(),
  recordId: text().notNull(), // id of the modified record
  operation: text({ enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
