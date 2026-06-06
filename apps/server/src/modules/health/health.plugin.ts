import Elysia, { status } from "elysia";
import { sql } from "drizzle-orm";

import { DbError } from "@dictos/core";

import type { CentralDatabase } from "../../db/db";
import { errorsPlugin, type ErrorResponse } from "../../plugins/errors.plugin";
import { healthModel } from "./health.model";

export const healthPlugin = (db: CentralDatabase, startTime: number) => {
  return new Elysia()
    .use(errorsPlugin)
    .use(healthModel)
    .get(
      "/health",
      async ({ request }) => {
        const dbRes = await db.get(sql`SELECT 1`).catch(
          (e) =>
            new DbError({
              operation: "select_1",
              reason: "Exception",
              cause: e,
            })
        );

        if (dbRes instanceof Error)
          return status(503, {
            type: "about:blank",
            title: "Server Unavailable",
            status: 503,
            detail: dbRes.message,
            instance: new URL(request.url).pathname,
          } as ErrorResponse);

        return status(200, {
          data: {
            status: "ok",
            uptime: Math.floor((Date.now() - startTime) / 1000),
            database: "connected",
            timestamp: new Date(),
          },
        });
      },
      {
        response: {
          503: "errors.standard",
          200: "healthResponse",
        },
        detail: {
          tags: ["System"],
          description: "Check server uptime and database connectivity",
        },
      }
    );
};
