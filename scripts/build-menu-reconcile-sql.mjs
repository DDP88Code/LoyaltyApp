import fs from "node:fs";
import path from "node:path";

const BUSINESS_SLUG = process.env.BUSINESS_SLUG ?? "fives-pub-and-grill";
const PLACEHOLDER_DESCRIPTION = "Placeholder menu item — replace before launch.";
const NOW_SQL = "(unixepoch('now') * 1000)";

const reviewPath = path.join("docs", "menu", "menu-import-review.json");
const outPath = path.join("docs", "menu", "menu-reconcile.sql");
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));

function q(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

function qn(value) {
	if (value === null || value === undefined) return "NULL";
	const text = String(value);
	if (text.trim().length === 0) return "NULL";
	return q(text);
}

function boolInt(value) {
	return value ? 1 : 0;
}

function minPriceCents(item) {
	if (typeof item.price === "number") return item.price;
	if (Array.isArray(item.variants) && item.variants.length > 0) {
		return Math.min(...item.variants.map((variant) => Number(variant.priceCents)));
	}
	return null;
}

const lines = [];

lines.push(`DELETE FROM menu_items
WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1)
  AND description = ${q(PLACEHOLDER_DESCRIPTION)};`);

lines.push(`DELETE FROM menu_categories
WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1)
  AND lower(name) IN ('breakfast', 'grills', 'desserts', 'coffee', 'drinks', 'pizza')
  AND NOT EXISTS (SELECT 1 FROM menu_items i WHERE i.category_id = menu_categories.id);`);

for (const [categoryIndex, category] of review.categories.entries()) {
	const categoryName = String(category.name);
	const categoryDescription =
		typeof category.categoryOptionNotes === "string"
			? category.categoryOptionNotes
			: category.description ?? null;

	lines.push(`INSERT INTO menu_categories (
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
SELECT
	lower(hex(randomblob(16))),
	b.id,
	${q(categoryName)},
	${qn(categoryDescription)},
	${q(category.menuGroup)},
	${categoryIndex},
	1,
	${NOW_SQL},
	${NOW_SQL}
FROM businesses b
WHERE b.slug = ${q(BUSINESS_SLUG)}
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower(${q(categoryName)})
);`);

	lines.push(`UPDATE menu_categories
SET description = ${qn(categoryDescription)},
    menu_group = ${q(category.menuGroup)},
    updated_at = ${NOW_SQL}
WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1)
  AND lower(name) = lower(${q(categoryName)})
  AND (description IS NULL OR trim(description) = '');`);

	for (const [itemIndex, item] of category.items.entries()) {
		const priceCents = minPriceCents(item);
		if (priceCents === null) continue;

		const itemName = String(item.item);
		const itemDescription = typeof item.description === "string" ? item.description : "";
		const optionNotes = typeof item.optionNotes === "string" ? item.optionNotes : "";
		const flags = item.flags ?? {};

		lines.push(`INSERT INTO menu_items (
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
SELECT
	lower(hex(randomblob(16))),
	b.id,
	c.id,
	${q(itemName)},
	${q(itemDescription)},
	${q(optionNotes)},
	${Number(priceCents)},
	NULL,
	1,
	1,
	${boolInt(flags.popular)},
	${boolInt(flags.vegetarian)},
	${boolInt(flags.spicy)},
	${boolInt(flags.new)},
	${boolInt(flags.subjectToAvailability)},
	${itemIndex},
	${NOW_SQL},
	${NOW_SQL}
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower(${q(categoryName)})
WHERE b.slug = ${q(BUSINESS_SLUG)}
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower(${q(itemName)})
);`);

		lines.push(`UPDATE menu_items
SET description = ${q(itemDescription)},
    option_notes = ${q(optionNotes)},
    price_cents = ${Number(priceCents)},
    active = 1,
    available = 1,
    popular = ${boolInt(flags.popular)},
    vegetarian = ${boolInt(flags.vegetarian)},
    spicy = ${boolInt(flags.spicy)},
    is_new = ${boolInt(flags.new)},
    subject_to_availability = ${boolInt(flags.subjectToAvailability)},
    updated_at = ${NOW_SQL}
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = ${q(BUSINESS_SLUG)}
	  AND lower(c.name) = lower(${q(categoryName)})
	  AND lower(i.name) = lower(${q(itemName)})
	  AND (trim(i.description) = '' OR i.description = ${q(PLACEHOLDER_DESCRIPTION)})
);`);

		lines.push(`UPDATE menu_items
SET option_notes = ${q(optionNotes)},
    updated_at = ${NOW_SQL}
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = ${q(BUSINESS_SLUG)}
	  AND lower(c.name) = lower(${q(categoryName)})
	  AND lower(i.name) = lower(${q(itemName)})
	  AND trim(i.option_notes) = ''
)
  AND ${q(optionNotes)} <> '';`);

		for (const [variantIndex, variant] of (item.variants ?? []).entries()) {
			lines.push(`INSERT INTO menu_item_variants (
	id,
	menu_item_id,
	name,
	price_cents,
	sort_order,
	active,
	created_at,
	updated_at
)
SELECT
	lower(hex(randomblob(16))),
	i.id,
	${q(String(variant.name))},
	${Number(variant.priceCents)},
	${variantIndex},
	1,
	${NOW_SQL},
	${NOW_SQL}
FROM menu_items i
JOIN businesses b ON b.id = i.business_id
JOIN menu_categories c ON c.id = i.category_id
WHERE b.slug = ${q(BUSINESS_SLUG)}
  AND lower(c.name) = lower(${q(categoryName)})
  AND lower(i.name) = lower(${q(itemName)})
  AND NOT EXISTS (
	SELECT 1
	FROM menu_item_variants v
	WHERE v.menu_item_id = i.id
	  AND lower(v.name) = lower(${q(String(variant.name))})
);`);
		}
	}
}

lines.push(`SELECT COUNT(*) AS categories_count
FROM menu_categories
WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1);`);

lines.push(`SELECT COUNT(*) AS items_count
FROM menu_items
WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1);`);

lines.push(`SELECT COUNT(*) AS variants_count
FROM menu_item_variants
WHERE menu_item_id IN (
	SELECT id FROM menu_items
	WHERE business_id = (SELECT id FROM businesses WHERE slug = ${q(BUSINESS_SLUG)} LIMIT 1)
);`);

fs.writeFileSync(outPath, `${lines.join("\n\n")}\n`, "utf8");
console.log(`Wrote ${outPath} with ${lines.length} statements.`);
