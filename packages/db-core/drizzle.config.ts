import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/schema.ts",
  out: "./migrations",
  casing: "snake_case",
});
