import { connect, type Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";

import path from "path";

import * as schema from "@db/schema/schema";
import { isNull } from "drizzle-orm";

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

    await migrate(
      db,
      async (queries) => {
        for (const query of queries) {
          await client.exec(query);
        }
      },
      { migrationsFolder: path.resolve(__dirname, "../drizzle/migrations/") }
    );

    await this.seedDbOnInit(db);

    return new BunTursoClient(client, db);
  }

  private static async seedDbOnInit(
    db: ReturnType<typeof drizzle<typeof schema>>
  ) {
    const [rootDir] = await db
      .select()
      .from(schema.foldersTable)
      .where(isNull(schema.foldersTable.parentId));

    if (rootDir !== undefined) return;

    await db
      .insert(schema.foldersTable)
      .values({
        name: "/",
        parentId: null,
        privacy: "private",
      })
      .catch((e) => {
        console.error("Failed to seed root directory:", e);
        throw new Error("Could not seed root directory", { cause: e });
      });
  }
}
