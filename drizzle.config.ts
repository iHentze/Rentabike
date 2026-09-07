import { defineConfig } from "drizzle-kit";

// Migrations are checked in under ./drizzle and applied with
// `wrangler d1 migrations apply` — the project can rebuild its own database.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
