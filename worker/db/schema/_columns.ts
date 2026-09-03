import { integer, text } from "drizzle-orm/sqlite-core";
// Relative imports throughout this folder: drizzle-kit bundles it without tsconfig paths.
import { newId } from "../ids";

/** Text primary key populated by the application, never by SQLite. */
export const pk = () => text("id").primaryKey().$defaultFn(newId);

/** SQLite has no date type; every instant is stored as epoch milliseconds. */
export const timestampMs = (name: string) =>
	integer(name, { mode: "timestamp_ms" });

/** SQLite has no boolean type; stored as 0/1. */
export const flag = (name: string) => integer(name, { mode: "boolean" });

export const createdAt = () =>
	timestampMs("created_at")
		.notNull()
		.$defaultFn(() => new Date());

export const updatedAt = () =>
	timestampMs("updated_at")
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date());

/** Arbitrary JSON serialised into a TEXT column. */
export const json = (name: string) =>
	text(name, { mode: "json" }).$type<unknown>();
