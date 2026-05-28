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
      token: process.env.TURSO_PLATFORM_TOKEN || "dev-platform",
    });
  }

  getDbName(userId: string) {
    return `dictos-${userId}`;
  }

  getDbUrl(dbName: string) {
    return `libsql://${dbName}-${this.orgSlug}.turso.io`;
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

    return {
      url: this.getDbUrl(dbName),
      token: tokenRes.jwt,
    };
  }

  async issueDatabaseToken(
    userId: string
  ): Promise<{ url: string; token: string } | TursoPlatformError> {
    const dbName = this.getDbName(userId);

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
      url: this.getDbUrl(dbName),
      token: tokenRes.jwt,
    };
  }
}
