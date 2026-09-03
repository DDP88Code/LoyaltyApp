import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { ROLES } from "../../../shared/roles";
import { createdAt, json, pk } from "./_columns";
import { businesses } from "./business";

/**
 * Append-only record of privileged actions. `actor_user_id` is stored as a plain
 * column rather than a foreign key so history survives a deleted account.
 */
export const auditLogs = sqliteTable(
	"audit_logs",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		actorUserId: text("actor_user_id").notNull(),
		actorRole: text("actor_role", { enum: ROLES }).notNull(),
		action: text("action").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id"),
		oldValueJson: json("old_value_json"),
		newValueJson: json("new_value_json"),
		metadataJson: json("metadata_json"),
		createdAt: createdAt(),
	},
	(t) => [
		index("audit_logs_business_created_idx").on(t.businessId, t.createdAt),
		index("audit_logs_entity_idx").on(t.entityType, t.entityId),
		index("audit_logs_actor_idx").on(t.actorUserId),
	],
);
