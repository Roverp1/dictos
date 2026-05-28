import { connect, type Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import path from "path";

import { type SyncPort, SyncError } from "@dictos/core";

import * as schema from "@db/schema/schema";
import { isNull } from "drizzle-orm";

export type TursoDatabase = ReturnType<typeof drizzle<typeof schema>>;

export class BunTursoClient implements SyncPort {
  private client: Database;
  public db: TursoDatabase;
  localDbPath: string;

  private constructor(
    client: Database,
    db: ReturnType<typeof drizzle<typeof schema>>,
    localDbPath: string
  ) {
    this.client = client;
    this.db = db;
    this.localDbPath = localDbPath;
  }

  public static async create(localDbPath: string): Promise<BunTursoClient> {
    const client = await connect({
      path: localDbPath,
    });

    let instance: BunTursoClient;

    const db = drizzle(
      async (sql, params, method) => {
        try {
          const stmt = await instance.client.prepare(sql);

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

    instance = new BunTursoClient(client, db, localDbPath);

    await migrate(
      db,
      async (queries) => {
        for (const query of queries) {
          await client.exec(query);
        }
      },
      { migrationsFolder: path.resolve(__dirname, "../drizzle/migrations/") }
    );

    await BunTursoClient.seedDbOnInit(db);

    return instance;
  }

  async connectRemote(url: string, token: string): Promise<void | SyncError> {
    try {
      await this.client.close();

      this.client = await connect({
        path: this.localDbPath,
        url: url,
        authToken: token,
      });

      await this.client.pull();
    } catch (err) {
      return new SyncError({
        reason: "Failed to connect to remote database",
        cause: err,
      });
    }
  }

  async sync(): Promise<void | SyncError> {
    try {
      await this.client.push();
      await this.client.pull();
    } catch (err) {
      return new SyncError({ reason: "Sync push/pull failed", cause: err });
    }
  }

  async disconnectRemote(): Promise<void | SyncError> {
    try {
      await this.client.close();

      this.client = await connect({
        path: this.localDbPath,
      });
    } catch (err) {
      return new SyncError({
        reason: "Failed to disconnect remote database",
        cause: err,
      });
    }
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
