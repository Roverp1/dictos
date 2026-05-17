import type { CentralDatabase } from "db/db";
import * as schema from "db/schema";
import { eq } from "drizzle-orm";

export class AuthService {
  constructor(private db: CentralDatabase) {}

  async register(username: string, email: string, passwordRaw: string) {
    const existing = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, email))
      .get();
    if (!existing) return null;

    const passwordHash = await Bun.password.hash(passwordRaw);

    const result = await this.db
      .insert(schema.usersTable)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning()
      .get();

    if (!result) return null;

    const { passwordHash: _, ...safeUser } = result;
    return safeUser;
  }

  async login(email: string, passwordRaw: string) {
    const userRecord = await this.db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, email))
      .get();

    if (!userRecord) return null;

    const isMatch = await Bun.password.verify(
      passwordRaw,
      userRecord.passwordHash
    );
    if (!isMatch) return null;

    await this.db
      .update(schema.usersTable)
      .set({
        lastLoginAt: new Date(),
      })
      .where(eq(schema.usersTable.id, userRecord.id));

    const { passwordHash: _, ...safeUser } = userRecord;
    return safeUser;
  }
}
