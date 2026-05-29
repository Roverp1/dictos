import { eq } from "drizzle-orm";
import * as errore from "errore";
import { DbError } from "@dictos/core";

import type { CentralDatabase } from "db/db";
import * as schema from "db/schema";
import { TursoPlatformService } from "./turso-platform.service";

export class UserExistsErorr extends errore.createTaggedError({
  name: "UserExistsError",
  message: "User with email $email already exists",
}) {}

export class InvalidCredentialsError extends errore.createTaggedError({
  name: "InvalidCredentialsError",
  message: "Invalid email or password",
}) {}

export class AuthService {
  private tursoService = new TursoPlatformService();

  constructor(private db: CentralDatabase) {}

  async register(username: string, email: string, passwordRaw: string) {
    const existing = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, email))
      .get()
      .catch(
        (e) =>
          new DbError({
            operation: "find_user",
            reason: "Query failed",
            cause: e,
          })
      );
    if (existing instanceof Error) return existing;
    if (existing) return new UserExistsErorr({ email });

    const passwordHash = await Bun.password.hash(passwordRaw);

    const result = await this.db
      .insert(schema.usersTable)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning()
      .get()
      .catch(
        (e) =>
          new DbError({
            operation: "insert_user",
            reason: "Insert failed",
            cause: e,
          })
      );

    if (result instanceof Error) return result;
    if (!result)
      return new DbError({
        operation: "insert_user",
        reason: "No row returned",
      });

    const { passwordHash: _, ...safeUser } = result;

    const turso = await this.tursoService.provisionDatabase(safeUser.id);
    if (turso instanceof Error) return turso;

    return { user: safeUser, turso };
  }

  async login(email: string, passwordRaw: string) {
    const userRecord = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, email))
      .get()
      .catch(
        (e) =>
          new DbError({
            operation: "find_user",
            reason: "Query failed",
            cause: e,
          })
      );

    if (userRecord instanceof Error) return userRecord;
    if (!userRecord) return new InvalidCredentialsError();

    const isMatch = await Bun.password.verify(
      passwordRaw,
      userRecord.passwordHash
    );
    if (!isMatch) return new InvalidCredentialsError();

    const updateRes = await this.db
      .update(schema.usersTable)
      .set({
        lastLoginAt: new Date(),
      })
      .where(eq(schema.usersTable.id, userRecord.id))
      .catch(
        (e) =>
          new DbError({
            operation: "update_login_time",
            reason: "Update failed",
            cause: e,
          })
      );

    if (updateRes instanceof Error) return updateRes;

    const { passwordHash: _, ...safeUser } = userRecord;

    const turso = await this.tursoService.issueDatabaseToken(safeUser.id);
    if (turso instanceof Error) return turso;

    return { user: safeUser, turso };
  }
}
