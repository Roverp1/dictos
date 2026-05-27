import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";

import {
  DbError,
  type AuthSession,
  type SessionRepository,
} from "@dictos/core";

import * as schema from "@db/schema/schema";

export class SqliteSessionRepository implements SessionRepository {
  constructor(private db: LibSQLDatabase<typeof schema>) {}

  async clearSession(): Promise<void | DbError> {
    await this.db.delete(schema.sessionTable).catch(
      (e) =>
        new DbError({
          operation: "clear_session",
          reason: "Delete failed",
          cause: e,
        })
    );
  }

  async saveSession(session: AuthSession): Promise<void | DbError> {
    await this.clearSession();

    const userResult = await this.db
      .insert(schema.usersTable)
      .values({
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        bio: session.user.bio,
        avatarUrl: session.user.avatarUrl,
      })
      .onConflictDoUpdate({
        target: schema.usersTable.id,
        set: {
          username: session.user.username,
          email: session.user.email,
          bio: session.user.bio,
          avatarUrl: session.user.avatarUrl,
        },
      })
      .catch(
        (e) =>
          new DbError({
            operation: "upsert_user",
            reason: "Exception",
            cause: e,
          })
      );

    if (userResult instanceof Error) return userResult;

    await this.db
      .insert(schema.sessionTable)
      .values({
        id: 1,
        userId: session.user.id,
        token: session.token,
      })
      .catch(
        (e) =>
          new DbError({
            operation: "save_session",
            reason: "Insert failed",
            cause: e,
          })
      );
  }

  async getSession(): Promise<AuthSession | DbError | null> {
    const res = await this.db
      .select()
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.id, 1))
      .innerJoin(
        schema.usersTable,
        eq(schema.sessionTable.userId, schema.usersTable.id)
      )
      .catch(
        (e) =>
          new DbError({
            operation: "get_session",
            reason: "Query failed",
            cause: e,
          })
      );

    if (res instanceof Error) return res;
    if (!res[0]) return null;

    const { session, users } = res[0];
    return {
      token: session.token,
      user: {
        id: users.id,
        username: users.username,
        email: users.email,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      },
    };
  }
}
