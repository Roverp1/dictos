import { StorageError, type User, type UserRepository } from "@dictos/core";

import type { TursoDatabase } from "@db/clients";
import * as schema from "db/schema/schema";
import { eq } from "drizzle-orm";

export class SqliteUserRepository implements UserRepository {
  constructor(private db: TursoDatabase) {}

  async save(user: User): Promise<User | StorageError> {
    const result = await this.db
      .insert(schema.usersTable)
      .values(user)
      .onConflictDoUpdate({
        target: schema.usersTable.id,
        set: {
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
        },
      })
      .returning()
      .catch(
        (e) =>
          new StorageError({
            operation: "upsert_user",
            reason: "Exception",
            cause: e,
          })
      );

    if (result instanceof Error) return result;

    const newUser = result[0];
    if (newUser === undefined)
      return new StorageError({
        operation: "upsert_user",
        reason: "No row returned",
      });

    return newUser;
  }

  async findById(id: string): Promise<User | StorageError | null> {
    const userRes = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.id, id))
      .catch(
        (e) =>
          new StorageError({
            operation: "select_user_by_id",
            reason: "Exception",
            cause: e,
          })
      );

    if (userRes instanceof Error) return userRes;

    const user = userRes[0];
    if (!user) return null;

    return user;
  }
}
