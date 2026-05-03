import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./schema/schema.ts",
  out: "./drizzle/migrations",
  // dbCredentials: {}, // ?
  casing: "snake_case",
});
