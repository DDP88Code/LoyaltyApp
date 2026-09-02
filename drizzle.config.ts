import { defineConfig } from "drizzle-kit";

// Schema lives in worker/db/schema and is compiled to plain SQLite migrations
// under drizzle/migrations, which Wrangler applies to D1.
export default defineConfig({
	dialect: "sqlite",
	driver: "d1-http",
	schema: "./worker/db/schema/index.ts",
	out: "./drizzle/migrations",
	verbose: true,
	strict: true,
});
