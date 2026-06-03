import { connect, type Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { isNull } from "drizzle-orm";
import path from "path";

import { type SyncPort, type SyncResult, SyncError } from "@dictos/core";

import * as schema from "@db/schema/schema";
import { genFolderUUIDV5 } from "@db/uuid";

export type TursoDatabase = ReturnType<typeof drizzle<typeof schema>>;

interface SyncCredentials {
  url: string | null;
  token: string;
}

export class BunTursoClient implements SyncPort {
  private client: Database;
  public db: TursoDatabase;
  localDbPath: string;
  private credentials: SyncCredentials;

  private constructor(
    client: Database,
    db: ReturnType<typeof drizzle<typeof schema>>,
    localDbPath: string,
    credentials: SyncCredentials
  ) {
    this.client = client;
    this.db = db;
    this.localDbPath = localDbPath;
    this.credentials = credentials;
  }

  public static async create(localDbPath: string): Promise<BunTursoClient> {
    const credentials: SyncCredentials = { url: null, token: "" };

    const client = await connect({
      path: localDbPath,
      url: () => credentials.url,
      authToken: () => Promise.resolve(credentials.token),
    });

    await client.exec("PRAGMA foreign_keys = ON");

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
      undefined,
      { schema, casing: "snake_case" }
    );

    instance = new BunTursoClient(client, db, localDbPath, credentials);

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
      this.credentials.url = url;
      this.credentials.token = token;

      await this.client.push();
      await this.client.pull();
    } catch (err: any) {
      console.error("[Turso] connectRemote failed:", err.message || err);
      return new SyncError({
        reason: "Failed to connect to remote database",
        cause: err,
      });
    }
  }

  async sync(): Promise<SyncResult | SyncError> {
    if (!this.credentials.url) {
      return new SyncError({
        reason: "Not connected to an account",
      });
    }

    const beforeStats = await this.client
      .stats()
      .catch(
        (e) => new SyncError({ reason: "Failed to fetch stats", cause: e })
      );
    if (beforeStats instanceof Error) return beforeStats;

    const pushRes = await this.client
      .push()
      .catch((e) => new SyncError({ reason: "Push failed", cause: e }));
    if (pushRes instanceof Error) return pushRes;

    const pullRes = await this.client
      .pull()
      .catch((e) => new SyncError({ reason: "Pull failed", cause: e }));
    if (pullRes instanceof Error) return pullRes;

    const afterStats = await this.client
      .stats()
      .catch(
        (e) => new SyncError({ reason: "Failed to fetch stats", cause: e })
      );
    if (afterStats instanceof Error) return afterStats;

    this.client
      .checkpoint()
      .catch((e) =>
        console.error(
          "[Turso] Non-fatal: Failed to checkpoint WAL after sync:",
          e
        )
      );

    const syncResult: SyncResult = {
      pulledRemoteChanges: pullRes,
      pushedLocalChanges: beforeStats.cdcOperations > 0,
      stats: {
        bytesSent: afterStats.networkSentBytes - beforeStats.networkSentBytes,
        bytesReceived:
          afterStats.networkReceivedBytes - beforeStats.networkReceivedBytes,
        operationsSynced: beforeStats.cdcOperations,
      },
    } as const;

    return syncResult;
  }

  async disconnectRemote(): Promise<void | SyncError> {
    try {
      this.credentials.url = null;
      this.credentials.token = "";
      // remove try catch ?
    } catch (err) {
      return new SyncError({
        reason: "Failed to disconnect remote database",
        cause: err,
      });
    }
  }

  private static async seedDbOnInit(
    // swap to this.db?
    db: ReturnType<typeof drizzle<typeof schema>>
  ) {
    const [rootDir] = await db
      .select()
      .from(schema.foldersTable)
      .where(isNull(schema.foldersTable.parentId));

    if (rootDir !== undefined) return;

    const id = genFolderUUIDV5(`${"root"}:${"root"}`);

    await db
      .insert(schema.foldersTable)
      .values({
        id,
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
