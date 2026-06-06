import { Elysia, t } from "elysia";

export const healthModel = new Elysia().model({
  healthResponse: t.Object({
    data: t.Object({
      status: t.Literal("ok"),
      uptime: t.Number(),
      database: t.Literal("connected"),
      timestamp: t.Date(),
    }),
  }),
});
