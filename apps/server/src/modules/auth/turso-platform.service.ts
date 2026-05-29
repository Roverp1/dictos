import { createClient } from "@tursodatabase/api";
import * as errore from "errore";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient as createLibSqlClient } from "@libsql/client";
import path from "path";

export class TursoPlatformError extends errore.createTaggedError({
  name: "TursoPlatformError",
  message: "Turso Platform API operation failed: $operation",
}) {}

export class TursoPlatformService {
  private api;
  private orgSlug: string;

  constructor() {
    this.orgSlug = process.env.TURSO_ORG_SLUG || "dev-org-slug"; // should throw
    this.api = createClient({
      org: this.orgSlug,
      token: process.env.TURSO_PLATFORM_TOKEN || "dev-platform",
    });
  }

  getDbName(userId: string) {
    return `dictos-${userId}`;
  }

  private async initializeRemoteSchema(
    dbUrl: string,
    token: string
  ): Promise<void | Error> {
    try {
      const remoteClient = createLibSqlClient({
        url: dbUrl,
        authToken: token,
      });

      const db = drizzle(remoteClient);

      await migrate(db, {
        migrationsFolder: path.resolve(
          __dirname,
          // todo: think how to avoid hardcoding the path to the migrations
          "../../../../../packages/adapters/db/drizzle/migrations"
        ),
      });

      remoteClient.close();
    } catch (err) {
      return new Error(
        `Failed to initialize remote schema: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async provisionDatabase(
    userId: string
  ): Promise<{ url: string; token: string } | TursoPlatformError> {
    const dbName = this.getDbName(userId);

    const createRes = await this.api.databases
      .create(dbName, { group: "default" })
      .catch(
        (e) =>
          new TursoPlatformError({ operation: "create_database", cause: e })
      );

    if (createRes instanceof Error) return createRes;

    const tokenRes = await this.api.databases
      .createToken(dbName, {
        expiration: "never",
        authorization: "full-access",
      })
      .catch(
        (e) => new TursoPlatformError({ operation: "create_token", cause: e })
      );

    if (tokenRes instanceof Error) return tokenRes;

    const url = `libsql://${createRes.hostname}`;
    const token = tokenRes.jwt;

    const initRes = await this.initializeRemoteSchema(url, token);
    if (initRes instanceof Error) {
      return new TursoPlatformError({
        operation: "initialize_schema",
        cause: initRes,
      });
    }

    return {
      url,
      token,
    };
  }

  async issueDatabaseToken(
    userId: string
  ): Promise<{ url: string; token: string } | TursoPlatformError> {
    const dbName = this.getDbName(userId);

    const dbRes = await this.api.databases
      .get(dbName)
      .catch(
        (e) => new TursoPlatformError({ operation: "get_database", cause: e })
      );

    if (dbRes instanceof Error) return dbRes;

    const tokenRes = await this.api.databases
      .createToken(dbName, {
        expiration: "never",
        authorization: "full-access",
      })
      .catch(
        (e) => new TursoPlatformError({ operation: "create_token", cause: e })
      );

    if (tokenRes instanceof Error) return tokenRes;

    return {
      url: `libsql://${dbRes.hostname}`,
      token: tokenRes.jwt,
    };
  }
}
