import { sql } from "drizzle-orm";
import {
  sqliteTable,
  int,
  text,
  type AnySQLiteColumn,
  check,
  index,
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

export const descriptionsTable = sqliteTable(
  "descriptions",
  {
    id: text()
      .primaryKey()
      .default(sql`(uuid_str(uuid7()))`),
    entryId: text()
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    senseId: text().references(() => sensesTable.id, { onDelete: "set null" }),
    type: text({ enum: ["misc", "translation", "definition", "example"] })
      .notNull()
      .default("misc"),
    text: text().notNull(),
    createdAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    modifiedAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => [
    index("descriptions_entry_id_idx").on(table.entryId),
    index("descriptions_sense_id_idx").on(table.senseId),
    check(
      "description_type_check",
      sql`${table.type} IN ('misc', 'translation', 'definition', 'example')`
    ),
  ]
);

export const sensesTable = sqliteTable(
  "senses",
  {
    id: text()
      .primaryKey()
      .default(sql`(uuid_str(uuid7()))`),
    entryId: text()
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    modifiedAt: int({ mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => [index("senses_entry_id_idx").on(table.entryId)]
);

export const foldersTable = sqliteTable(
  "folders",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => foldersTable.id
      // { onDelete: "cascade" } // @todo enable when turso will have https://github.com/tursodatabase/turso/issues/5154 fixed
      // // for now recursive deletion is handled in the FolderRepository
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
