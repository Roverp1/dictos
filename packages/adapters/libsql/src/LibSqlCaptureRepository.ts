import type { Capture, CaptureRepository } from "@dictos/core";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "path";

import * as schema from "./schema";

export class LibSqlCaptureRepository implements CaptureRepository {
  private db: LibSQLDatabase<typeof schema>;
  private client: Client;

  constructor(dbUrl: string) {
    this.client = createClient({ url: dbUrl });
  }

  async initialize(): Promise<void> {
    await this.client.execute("PRAGMA foreign_keys = ON;");

    this.db = drizzle({ client: this.client, schema, casing: "snake_case" });

    await migrate(this.db, {
      // not sure if its correct
      migrationsFolder: path.resolve(__dirname, "../drizzle/migrations"),
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

  async getAll(): Promise<Capture[]> {
    const captures = await this.db.select().from(schema.capturesTable);

    return captures;
  }
}
