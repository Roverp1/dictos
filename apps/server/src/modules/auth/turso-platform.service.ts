import { createClient } from "@tursodatabase/api";
import * as errore from "errore";

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
      token:
        process.env.TURSO_PLATFORM_TOKEN ||
        "local-dev-token-ignored-by-local-sync-server",
    });
  }

  getDbName(userId: string) {
    return `dictos-${userId}`;
  }

  async provisionDatabase(
    userId: string
  ): Promise<{ url: string; token: string } | TursoPlatformError> {
    if (process.env.NODE_ENV === "development") {
      return {
        url: process.env.TURSO_SYNC_URL || "http://localhost:8080",
        token:
          process.env.TURSO_PLATFORM_TOKEN ||
          "local-dev-token-ignored-by-local-sync-server",
      };
    }

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

    return {
      url,
      token,
    };
  }

  async issueDatabaseToken(
    userId: string
  ): Promise<{ url: string; token: string } | TursoPlatformError> {
    if (process.env.NODE_ENV === "development") {
      return {
        url: process.env.TURSO_SYNC_URL || "http://localhost:8080",
        token:
          process.env.TURSO_PLATFORM_TOKEN ||
          "local-dev-token-ignored-by-local-sync-server",
      };
    }

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
