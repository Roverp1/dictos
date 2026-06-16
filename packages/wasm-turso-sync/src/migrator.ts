import * as errore from "@dictos/errore";
import type { Logger } from "@dictos/logger";
import type { SqliteTursoDrizzleProxy } from "@dictos/db-core";
import { sql } from "drizzle-orm";

export interface MigrationMeta {
  sql: string[];
  folderMillis: number;
  hash: string;
  bps: boolean;
}

export interface Journal {
  entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
}

export interface MigrationPayload {
  journal: Journal;
  /** maps filename to its content */
  sqlFiles: Record<string, unknown>;
}

export type ProxyMigrator = (migrationQueries: string[]) => Promise<void>;

export class MigrationError extends errore.createTaggedError({
  name: "MigrationError",
  message: "Migration failed: $reason",
}) {}

export const migrateWasm = async (
  db: SqliteTursoDrizzleProxy,
  callback: ProxyMigrator,
  logger: Logger,
  migrationData: MigrationPayload
): Promise<void | MigrationError> => {
  const migrationQueries: MigrationMeta[] = [];
  const { journal, sqlFiles } = migrationData;

  for (const journalEntry of journal.entries) {
    const migrationPath = `${journalEntry.tag}.sql`;

    const sqlKey = Object.keys(sqlFiles).find((k) => k.endsWith(migrationPath));

    if (!sqlKey) {
      return new MigrationError({
        reason: `No file ${migrationPath} found in provided migration payload`,
      });
    }

    const query = sqlFiles[sqlKey] as string;

    const result = query
      .split("--> statement-breakpoint")
      .map((it) => {
        return it.trim();
      })
      .filter((it) => it.length > 0);

    const encodedQuery = new TextEncoder().encode(query);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encodedQuery);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    migrationQueries.push({
      sql: result,
      bps: journalEntry.breakpoints,
      folderMillis: journalEntry.when,
      hash: hashHex,
    });
  }

  const migrations = migrationQueries;

  const migrationsTable = "__drizzle_migrations";

  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at INTEGER
    )
  `;

  const createResult = await db.run(migrationTableCreate).catch(
    (e) =>
      new MigrationError({
        reason: "Failed to create migrations table",
        cause: e,
      })
  );
  if (createResult instanceof Error) return createResult;

  const dbMigrations = await db
    .values<
      [number, string, string]
    >(sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`)
    .catch(
      (e) =>
        new MigrationError({
          reason: `Failed to select from ${migrationsTable}`,
          cause: e,
        })
    );
  if (dbMigrations instanceof Error) return dbMigrations;

  const lastDbMigration = dbMigrations[0] ?? undefined;

  const queriesToRun: string[] = [];
  for (const migration of migrations) {
    if (
      !lastDbMigration ||
      Number(lastDbMigration[2])! < migration.folderMillis
    ) {
      queriesToRun.push(
        ...migration.sql,
        `INSERT INTO \`${migrationsTable}\` ("hash", "created_at") VALUES('${migration.hash}', '${migration.folderMillis}')`
      );
    }
  }

  if (queriesToRun.length === 0) {
    logger.debug("No pending migrations found.");
  } else
    logger.info("Applying pending migrations", {
      queryCount: queriesToRun.length,
    });

  return await callback(queriesToRun).catch(
    (e) =>
      new MigrationError({
        reason: "Failed to run migrations callback",
        cause: e,
      })
  );
};
