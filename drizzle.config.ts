import { defineConfig } from "drizzle-kit";

// Schema lives in worker/db/schema and is compiled to plain SQLite migrations
// under drizzle/migrations, which Wrangler applies to D1. `generate` needs only
// the schema; `wrangler d1 migrations apply` owns the d1_migrations bookkeeping.
export default defineConfig({
	dialect: "sqlite",
	schema: "./worker/db/schema/index.ts",
	out: "./drizzle/migrations",
	verbose: true,
	strict: true,
});
