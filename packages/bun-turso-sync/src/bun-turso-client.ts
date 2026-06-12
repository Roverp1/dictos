import { connect, type Database } from "@tursodatabase/sync";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import path from "path";

import {
  type SyncPort,
  type SyncResult,
  SyncError,
  DbError,
} from "@dictos/core";
import type { Logger } from "@dictos/logger";
import { schema, SqliteFolderRepository } from "@dictos/db-core";

export type SqliteTursoDrizzleProxy = ReturnType<typeof drizzle<typeof schema>>;

interface SyncCredentials {
  url: string | null;
  token: string;
}

export class BunTursoClient implements SyncPort {
  private client: Database;
  public db: SqliteTursoDrizzleProxy;
  localDbPath: string;
  private credentials: SyncCredentials;

  private constructor(
    client: Database,
    db: ReturnType<typeof drizzle<typeof schema>>,
    localDbPath: string,
    credentials: SyncCredentials,
    private logger: Logger
  ) {
    this.client = client;
    this.db = db;
    this.localDbPath = localDbPath;
    this.credentials = credentials;
  }

  public static async create(
    localDbPath: string,
    logger: Logger
  ): Promise<BunTursoClient> {
    const credentials: SyncCredentials = { url: null, token: "" };

    logger.debug("Initializing database", {
      dbPath: localDbPath,
    });

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
          logger.warn("Proxy query failed", {
            err,
            sql,
            params,
          });
          // drizzle expects us to throw here
          // so we could handle it during the specific db call
          throw err;
        }
      },
      undefined,
      { schema, casing: "snake_case" }
    );

    instance = new BunTursoClient(client, db, localDbPath, credentials, logger);

    const migrationsFolder = path.resolve(
      __dirname,
      "../../db-core/migrations/"
    );

    logger.debug("Checking for pending database migrations...");

    const migrationRes = await migrate(
      db,
      async (queries) => {
        for (const query of queries) {
          await client.exec(query);
        }
      },
      { migrationsFolder }
    ).catch(
      (e) =>
        new DbError({ operation: "migration", reason: "Exception", cause: e })
    );

    if (migrationRes instanceof Error) {
      logger.fatal("Dabase migration failed during startup", migrationRes, {
        resolvedPath: migrationsFolder,
      });
      throw migrationRes;
    }

    logger.debug("Database migrations applied successfully");

    const folderRepo = new SqliteFolderRepository(db);
    await folderRepo.save({ name: "/", parentId: null, privacy: "private" });

    logger.info("Local database is ready");

    return instance;
  }

  async connectRemote(url: string, token: string): Promise<void | SyncError> {
    this.logger.debug("Connecting to remote database...", {
      url,
    });

    this.credentials.url = url;
    this.credentials.token = token;
    const syncRes = await this.sync();
    if (syncRes instanceof Error) return syncRes;

    this.logger.info(
      "Connected to a remote database and finished sync successfully.",
      {
        remoteUrl: url,
      }
    );
  }

  async sync(): Promise<SyncResult | SyncError> {
    if (!this.credentials.url) {
      return new SyncError({
        reason: "Not connected to an account",
      });
    }

    this.logger.trace("Sync started...", {
      remoteUrl: this.credentials.url,
    });

    let syncResult: SyncResult;

    try {
      const beforeStats = await this.client.stats();
      await this.client.push();
      const pullRes = await this.client.pull();
      const afterStats = await this.client.stats();

      syncResult = {
        pulledRemoteChanges: pullRes,
        pushedLocalChanges: beforeStats.cdcOperations > 0,
        stats: {
          bytesSent: afterStats.networkSentBytes - beforeStats.networkSentBytes,
          bytesReceived:
            afterStats.networkReceivedBytes - beforeStats.networkReceivedBytes,
          operationsSynced: beforeStats.cdcOperations,
        },
      };
    } catch (err) {
      this.logger.error("Sync failed.", err);
      return new SyncError({ reason: "Exception", cause: err });
    }

    this.logger.debug("Sync completed", {
      syncResult,
    });

    this.client.checkpoint().catch((e) =>
      this.logger.warn("Failed to checkpoint WAL after sync", {
        err: e,
      })
    );

    return syncResult;
  }

  async disconnectRemote(): Promise<void | SyncError> {
    this.credentials.url = null;
    this.credentials.token = "";
    this.logger.info("Disconnected from remote database");
  }
}
