import { Elysia } from "elysia";

export const healthPlugin = new Elysia({ prefix: "/health" })
  .get("/", () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
