import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB_NAME = "fives-rewards-db";
const DEFAULT_BUSINESS_SLUG = "fives-pub-and-grill";
const PLACEHOLDER_DESCRIPTION = "Placeholder menu item — replace before launch.";

const args = new Set(process.argv.slice(2));
const runRemote = args.has("--remote");
const businessSlugArg = process.argv.find((value) => value.startsWith("--business-slug="));
const businessSlug = businessSlugArg
	? businessSlugArg.split("=")[1]
	: process.env.BUSINESS_SLUG ?? DEFAULT_BUSINESS_SLUG;

const reviewPath = path.join("docs", "menu", "menu-import-review.json");
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));

function escapeSql(value) {
	return value.replaceAll("'", "''");
}

function sqlString(value) {
	return `'${escapeSql(value)}'`;
}

function sqlNullable(value) {
	if (value === null || value === undefined) return "NULL";
	return sqlString(value);
}

function runSql(sql) {
	const tempSqlPath = path.join(
		os.tmpdir(),
		`fives-rewards-menu-reconcile-${process.pid}.sql`,
	);
	fs.writeFileSync(tempSqlPath, sql, "utf8");

	const command = [
		"npx",
		"wrangler",
		"d1",
		"execute",
		DB_NAME,
		runRemote ? "--remote" : "--local",
		"--json",
		"--file",
		`\"${tempSqlPath}\"`,
	].join(" ");

	let stdout = "";
	try {
		stdout = execSync(command, {
			encoding: "utf8",
			cwd: process.cwd(),
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (error) {
		const withStreams = error;
		throw new Error(
			`wrangler d1 execute failed\nSQL: ${sql}\nSTDOUT: ${withStreams.stdout ?? ""}\nSTDERR: ${withStreams.stderr ?? ""}`,
		);
	} finally {
		if (fs.existsSync(tempSqlPath)) {
			fs.unlinkSync(tempSqlPath);
		}
	}

	const parsed = JSON.parse(stdout);
	return parsed[0] ?? { results: [] };
}

function firstRow(sql) {
	const output = runSql(sql);
	return output.results?.[0] ?? null;
}

function getPriceCents(item) {
	if (typeof item.price === "number") return item.price;
	if (Array.isArray(item.variants) && item.variants.length > 0) {
		return Math.min(...item.variants.map((variant) => variant.priceCents));
	}
	return null;
}

function asBool(value) {
	return value ? 1 : 0;
}

function log(message) {
	process.stdout.write(`${message}\n`);
}

const now = Date.now();

log(`Reconciling menu (${runRemote ? "remote" : "local"}) for business slug ${businessSlug}...`);

const business = firstRow(
	`SELECT id FROM businesses WHERE slug = ${sqlString(businessSlug)} LIMIT 1;`,
);
if (!business?.id) {
	throw new Error(`Business slug not found: ${businessSlug}`);
}
const businessId = String(business.id);

const summary = {
	categoriesCreated: 0,
	categoriesUpdated: 0,
	itemsCreated: 0,
	itemsBootstrapUpdated: 0,
	variantsCreated: 0,
	dummyItemsDeleted: 0,
	dummyCategoriesDeleted: 0,
};

const deleteDummyItems = runSql(
	`DELETE FROM menu_items WHERE business_id = ${sqlString(businessId)} AND description = ${sqlString(PLACEHOLDER_DESCRIPTION)};`,
);
summary.dummyItemsDeleted += Number(deleteDummyItems.meta?.changes ?? 0);

const deleteDummyCategories = runSql(
	`DELETE FROM menu_categories
	 WHERE business_id = ${sqlString(businessId)}
	   AND lower(name) IN ('breakfast', 'grills', 'desserts', 'coffee', 'drinks', 'pizza')
	   AND NOT EXISTS (SELECT 1 FROM menu_items i WHERE i.category_id = menu_categories.id);`,
);
summary.dummyCategoriesDeleted += Number(deleteDummyCategories.meta?.changes ?? 0);

for (const [categoryIndex, category] of review.categories.entries()) {
	const categoryName = String(category.name);
	const categoryDescription =
		typeof category.categoryOptionNotes === "string"
			? category.categoryOptionNotes
			: null;
	const existingCategory = firstRow(
		`SELECT id FROM menu_categories
		 WHERE business_id = ${sqlString(businessId)}
		   AND lower(name) = lower(${sqlString(categoryName)})
		 LIMIT 1;`,
	);

	let categoryId = existingCategory?.id ? String(existingCategory.id) : null;
	if (!categoryId) {
		const insertCategory = firstRow(
			`INSERT INTO menu_categories (
				id,
				business_id,
				name,
				description,
				menu_group,
				sort_order,
				active,
				created_at,
				updated_at
			)
			VALUES (
				lower(hex(randomblob(16))),
				${sqlString(businessId)},
				${sqlString(categoryName)},
				${sqlNullable(categoryDescription)},
				${sqlString(category.menuGroup)},
				${categoryIndex},
				1,
				${now},
				${now}
			)
			RETURNING id;`,
		);
		if (!insertCategory?.id) {
			throw new Error(`Failed to create category ${categoryName}`);
		}
		categoryId = String(insertCategory.id);
		summary.categoriesCreated += 1;
	} else {
		runSql(
			`UPDATE menu_categories
			 SET menu_group = ${sqlString(category.menuGroup)},
			     active = 1,
			     updated_at = ${now}
			 WHERE id = ${sqlString(categoryId)};`,
		);
		if (categoryDescription) {
			runSql(
				`UPDATE menu_categories
				 SET description = ${sqlString(categoryDescription)},
				     updated_at = ${now}
				 WHERE id = ${sqlString(categoryId)}
				   AND (description IS NULL OR trim(description) = '');`,
			);
		}
		summary.categoriesUpdated += 1;
	}

	for (const [itemIndex, item] of category.items.entries()) {
		const itemName = String(item.item);
		const priceCents = getPriceCents(item);
		if (priceCents === null) {
			log(`Skipping ${categoryName} / ${itemName}: no price and no variants.`);
			continue;
		}

		const itemDescription = typeof item.description === "string" ? item.description : "";
		const itemOptionNotes = typeof item.optionNotes === "string" ? item.optionNotes : "";
		const flags = item.flags ?? {};

		const existingItem = firstRow(
			`SELECT id, description FROM menu_items
			 WHERE business_id = ${sqlString(businessId)}
			   AND category_id = ${sqlString(categoryId)}
			   AND lower(name) = lower(${sqlString(itemName)})
			 LIMIT 1;`,
		);

		let itemId = existingItem?.id ? String(existingItem.id) : null;
		if (!itemId) {
			const inserted = firstRow(
				`INSERT INTO menu_items (
					id,
					business_id,
					category_id,
					name,
					description,
					option_notes,
					price_cents,
					image_key,
					active,
					available,
					popular,
					vegetarian,
					spicy,
					is_new,
					subject_to_availability,
					sort_order,
					created_at,
					updated_at
				)
				VALUES (
					lower(hex(randomblob(16))),
					${sqlString(businessId)},
					${sqlString(categoryId)},
					${sqlString(itemName)},
					${sqlString(itemDescription)},
					${sqlString(itemOptionNotes)},
					${priceCents},
					NULL,
					1,
					1,
					${asBool(flags.popular)},
					${asBool(flags.vegetarian)},
					${asBool(flags.spicy)},
					${asBool(flags.new)},
					${asBool(flags.subjectToAvailability)},
					${itemIndex},
					${now},
					${now}
				)
				RETURNING id;`,
			);
			if (!inserted?.id) {
				throw new Error(`Failed to insert item ${categoryName} / ${itemName}`);
			}
			itemId = String(inserted.id);
			summary.itemsCreated += 1;
		} else {
			const existingDescription = String(existingItem.description ?? "").trim();
			if (
				existingDescription.length === 0 ||
				existingDescription === PLACEHOLDER_DESCRIPTION
			) {
				runSql(
					`UPDATE menu_items
					 SET description = ${sqlString(itemDescription)},
					     option_notes = ${sqlString(itemOptionNotes)},
					     price_cents = ${priceCents},
					     active = 1,
					     available = 1,
					     popular = ${asBool(flags.popular)},
					     vegetarian = ${asBool(flags.vegetarian)},
					     spicy = ${asBool(flags.spicy)},
					     is_new = ${asBool(flags.new)},
					     subject_to_availability = ${asBool(flags.subjectToAvailability)},
					     updated_at = ${now}
					 WHERE id = ${sqlString(itemId)};`,
				);
				summary.itemsBootstrapUpdated += 1;
			}

			if (itemOptionNotes) {
				runSql(
					`UPDATE menu_items
					 SET option_notes = ${sqlString(itemOptionNotes)},
					     updated_at = ${now}
					 WHERE id = ${sqlString(itemId)}
					   AND trim(option_notes) = '';`,
				);
			}
		}

		for (const [variantIndex, variant] of (item.variants ?? []).entries()) {
			const existingVariant = firstRow(
				`SELECT id FROM menu_item_variants
				 WHERE menu_item_id = ${sqlString(itemId)}
				   AND lower(name) = lower(${sqlString(String(variant.name))})
				 LIMIT 1;`,
			);
			if (existingVariant?.id) continue;

			runSql(
				`INSERT INTO menu_item_variants (
					id,
					menu_item_id,
					name,
					price_cents,
					sort_order,
					active,
					created_at,
					updated_at
				)
				VALUES (
					lower(hex(randomblob(16))),
					${sqlString(itemId)},
					${sqlString(String(variant.name))},
					${Number(variant.priceCents)},
					${variantIndex},
					1,
					${now},
					${now}
				);`,
			);
			summary.variantsCreated += 1;
		}
	}
}

const categoryCount = firstRow(
	`SELECT COUNT(*) AS count FROM menu_categories WHERE business_id = ${sqlString(businessId)};`,
);
const itemCount = firstRow(
	`SELECT COUNT(*) AS count FROM menu_items WHERE business_id = ${sqlString(businessId)};`,
);
const variantCount = firstRow(
	`SELECT COUNT(*) AS count
	 FROM menu_item_variants
	 WHERE menu_item_id IN (SELECT id FROM menu_items WHERE business_id = ${sqlString(
		businessId,
	)});`,
);

log("Reconciliation complete.");
log(JSON.stringify(summary, null, 2));
log(
	`Final totals: categories=${categoryCount?.count ?? 0}, items=${itemCount?.count ?? 0}, variants=${variantCount?.count ?? 0}`,
);

const reviewFlags = review.manualReview?.filter((entry) => entry.needsReview) ?? [];
if (reviewFlags.length > 0) {
	log("Manual review flags:");
	for (const entry of reviewFlags) {
		log(`- ${entry.topic}: ${entry.note}`);
	}
}
