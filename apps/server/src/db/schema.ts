import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  id: int().primaryKey(),
  username: text().notNull().unique(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  bio: text(),
  avatarUrl: text(),
  createdAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  lastLoginAt: int({ mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const centralCapturesAddedTable = sqliteTable("central_captures_added", {
  id: int().primaryKey(),
  userId: int()
    .notNull()
    .references(() => usersTable.id),
  date: text().notNull().unique(), // YYYY-MM-DD
  count: int().notNull().default(1),
});
