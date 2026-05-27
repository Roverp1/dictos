import { connect, type Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import * as schema from "@db/schema/schema";

export class BunTursoClient {
  private client: Database;
  public db: ReturnType<typeof drizzle<typeof schema>>;

  private constructor(
    client: Database,
    db: ReturnType<typeof drizzle<typeof schema>>
  ) {
    this.client = client;
    this.db = db;
  }

  public static async create(localDbPath: string): Promise<BunTursoClient> {
    const client = await connect({
      path: localDbPath,
    });

    const db = drizzle(
      async (sql, params, method) => {
        try {
          const stmt = await client.prepare(sql);

          if (method === "run") {
            await stmt.run(...params);
            return { rows: [] };
          }

          if (method === "get") {
            const row = await stmt.get(...params);
            return { rows: row ? Object.values(row) : [] };
          }

          // Handles "all" and "values" methods
          const rows = (await stmt.all(...params)) as Record<string, any>[];
          return { rows: rows.map((row) => Object.values(row)) };
        } catch (err) {
          console.error("Turso proxy query error:", err);
          throw err;
        }
      },
      { schema }
    );

    return new BunTursoClient(client, db);
  }
}
