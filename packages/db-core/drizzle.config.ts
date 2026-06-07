import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./schema/schema.ts",
  out: "./migrations",
  casing: "snake_case",
});
