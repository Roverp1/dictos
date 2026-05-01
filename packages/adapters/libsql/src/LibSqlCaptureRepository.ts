import type { Capture, CaptureRepository } from "@dictos/core";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";
import { createClient, type Client } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";

export class LibSqlCaptureRepository implements CaptureRepository {
  private db: LibSQLDatabase<typeof schema>;
  private client: Client;

  constructor(dbUrl: string) {
    this.client = createClient({ url: dbUrl });
  }

  async initialize(): Promise<void> {
    this.db = drizzle({ client: this.client, schema });

    await migrate(this.db, {
      // not sure if its correct
      migrationsFolder: "./packages/adapters/libsql/drizzle",
    });
  }

  async save(
    capture: Omit<Capture, "id" | "createdAt" | "modifiedAt">
  ): Promise<Capture> {
    const [inserted] = await this.db
      .insert(schema.capturesTable)
      .values({
        text: capture.text,
        directoryId: capture.directoryId,
      })
      .returning();

    if (!inserted)
      throw new Error("Insert failed: No row returned from database");

    return inserted;
  }

  async findById(id: number): Promise<Capture | null> {
    const [capture] = await this.db
      .select()
      .from(schema.capturesTable)
      .where(eq(schema.capturesTable.id, id));

    if (!capture)
      throw new Error("Select failed: No row returned from database");

    return capture;
  }

  // remove null?
  async getAll(): Promise<Capture[] | null> {
    const captures = await this.db.select().from(schema.capturesTable);

    return captures;
  }
}
