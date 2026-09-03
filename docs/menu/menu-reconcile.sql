DELETE FROM menu_items
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND description = 'Placeholder menu item — replace before launch.';

DELETE FROM menu_categories
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) IN ('breakfast', 'grills', 'desserts', 'coffee', 'drinks', 'pizza')
  AND NOT EXISTS (SELECT 1 FROM menu_items i WHERE i.category_id = menu_categories.id);

INSERT INTO menu_categories (
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
	'Light Meals',
	NULL,
	'food',
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Light Meals')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Light Meals')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Trinchado',
	'Chicken or matured rump steak cubes with in-house made secret trinchado sauce (180g).',
	'',
	10000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Trinchado')
);

UPDATE menu_items
SET description = 'Chicken or matured rump steak cubes with in-house made secret trinchado sauce (180g).',
    option_notes = '',
    price_cents = 10000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Trinchado')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Trinchado')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_item_variants (
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
	'Chicken',
	10000,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM menu_items i
JOIN businesses b ON b.id = i.business_id
JOIN menu_categories c ON c.id = i.category_id
WHERE b.slug = 'fives-pub-and-grill'
  AND lower(c.name) = lower('Light Meals')
  AND lower(i.name) = lower('Trinchado')
  AND NOT EXISTS (
	SELECT 1
	FROM menu_item_variants v
	WHERE v.menu_item_id = i.id
	  AND lower(v.name) = lower('Chicken')
);

INSERT INTO menu_item_variants (
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
	'Matured rump steak',
	11500,
	1,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM menu_items i
JOIN businesses b ON b.id = i.business_id
JOIN menu_categories c ON c.id = i.category_id
WHERE b.slug = 'fives-pub-and-grill'
  AND lower(c.name) = lower('Light Meals')
  AND lower(i.name) = lower('Trinchado')
  AND NOT EXISTS (
	SELECT 1
	FROM menu_item_variants v
	WHERE v.menu_item_id = i.id
	  AND lower(v.name) = lower('Matured rump steak')
);

INSERT INTO menu_items (
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
	'Prego Roll',
	'100% chicken or rump steak on a traditional Portuguese roll, marinated in our secret sauce, topped with onions (paired great with an egg).',
	'',
	9500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Prego Roll')
);

UPDATE menu_items
SET description = '100% chicken or rump steak on a traditional Portuguese roll, marinated in our secret sauce, topped with onions (paired great with an egg).',
    option_notes = '',
    price_cents = 9500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Prego Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Prego Roll')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_item_variants (
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
	'Chicken',
	9500,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM menu_items i
JOIN businesses b ON b.id = i.business_id
JOIN menu_categories c ON c.id = i.category_id
WHERE b.slug = 'fives-pub-and-grill'
  AND lower(c.name) = lower('Light Meals')
  AND lower(i.name) = lower('Prego Roll')
  AND NOT EXISTS (
	SELECT 1
	FROM menu_item_variants v
	WHERE v.menu_item_id = i.id
	  AND lower(v.name) = lower('Chicken')
);

INSERT INTO menu_item_variants (
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
	'Rump steak',
	12000,
	1,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM menu_items i
JOIN businesses b ON b.id = i.business_id
JOIN menu_categories c ON c.id = i.category_id
WHERE b.slug = 'fives-pub-and-grill'
  AND lower(c.name) = lower('Light Meals')
  AND lower(i.name) = lower('Prego Roll')
  AND NOT EXISTS (
	SELECT 1
	FROM menu_item_variants v
	WHERE v.menu_item_id = i.id
	  AND lower(v.name) = lower('Rump steak')
);

INSERT INTO menu_items (
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
	'Prego Especial',
	'Traditional Portuguese infused flavored rump steak topped with a fried egg, ham, lettuce, tomato and cheese. Served in a Portuguese roll.',
	'',
	13500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Prego Especial')
);

UPDATE menu_items
SET description = 'Traditional Portuguese infused flavored rump steak topped with a fried egg, ham, lettuce, tomato and cheese. Served in a Portuguese roll.',
    option_notes = '',
    price_cents = 13500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Prego Especial')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Prego Especial')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Tuna Steak Roll',
	'Tuna steak marinated in a delicious lemon garlic butter, topped with onions.',
	'',
	13500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Tuna Steak Roll')
);

UPDATE menu_items
SET description = 'Tuna steak marinated in a delicious lemon garlic butter, topped with onions.',
    option_notes = '',
    price_cents = 13500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 1,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Tuna Steak Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Tuna Steak Roll')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Chicken Wings',
	'Slow grilled chicken wings with an option of Lemon & Herb / Peri-Peri or BBQ.',
	'Sauce options: Lemon & Herb, Peri-Peri, BBQ.',
	8500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Chicken Wings')
);

UPDATE menu_items
SET description = 'Slow grilled chicken wings with an option of Lemon & Herb / Peri-Peri or BBQ.',
    option_notes = 'Sauce options: Lemon & Herb, Peri-Peri, BBQ.',
    price_cents = 8500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Chicken Wings')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'Sauce options: Lemon & Herb, Peri-Peri, BBQ.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Chicken Wings')
	  AND trim(i.option_notes) = ''
)
  AND 'Sauce options: Lemon & Herb, Peri-Peri, BBQ.' <> '';

INSERT INTO menu_items (
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
	'Chicken Strips & Fries',
	'Crispy chicken strips, served with fries and sweet chill mayo sauce.',
	'',
	9500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Chicken Strips & Fries')
);

UPDATE menu_items
SET description = 'Crispy chicken strips, served with fries and sweet chill mayo sauce.',
    option_notes = '',
    price_cents = 9500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Chicken Strips & Fries')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Chicken Strips & Fries')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Breakfast Gourmet Bun',
	'Bacon and egg to your liking, cheese, caramelized onions and rocket, with a base of creamy mayo served on a gourmet bun (served all day).',
	'',
	7000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Breakfast Gourmet Bun')
);

UPDATE menu_items
SET description = 'Bacon and egg to your liking, cheese, caramelized onions and rocket, with a base of creamy mayo served on a gourmet bun (served all day).',
    option_notes = '',
    price_cents = 7000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Breakfast Gourmet Bun')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Breakfast Gourmet Bun')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Breakfast Wrap',
	'Scrambled eggs with bacon bits, avocado, caramelized onion, cream cheese and rocket (strictly served until 12pm).',
	'',
	11000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	7,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Light Meals')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Breakfast Wrap')
);

UPDATE menu_items
SET description = 'Scrambled eggs with bacon bits, avocado, caramelized onion, cream cheese and rocket (strictly served until 12pm).',
    option_notes = '',
    price_cents = 11000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Breakfast Wrap')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Light Meals')
	  AND lower(i.name) = lower('Breakfast Wrap')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Mains',
	NULL,
	'food',
	1,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Mains')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Mains')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Espetada Rump Skewer 300g',
	'Matured aged rump steak prepared in an authentic Portuguese style with coarse salt and bay leaves, drenched in garlic butter.',
	'',
	18500,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Mains')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Espetada Rump Skewer 300g')
);

UPDATE menu_items
SET description = 'Matured aged rump steak prepared in an authentic Portuguese style with coarse salt and bay leaves, drenched in garlic butter.',
    option_notes = '',
    price_cents = 18500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Rump Skewer 300g')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Rump Skewer 300g')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Espetada Chicken Skewer 300g',
	'Chicken fillet cubes grilled with your choice of sauce (Lemon & Herb / Peri-Peri / BBQ / Jozi''s Creamy Garlic).',
	'Sauce options: Lemon & Herb, Peri-Peri, BBQ, Jozi''s Creamy Garlic.',
	17500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Mains')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Espetada Chicken Skewer 300g')
);

UPDATE menu_items
SET description = 'Chicken fillet cubes grilled with your choice of sauce (Lemon & Herb / Peri-Peri / BBQ / Jozi''s Creamy Garlic).',
    option_notes = 'Sauce options: Lemon & Herb, Peri-Peri, BBQ, Jozi''s Creamy Garlic.',
    price_cents = 17500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Chicken Skewer 300g')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'Sauce options: Lemon & Herb, Peri-Peri, BBQ, Jozi''s Creamy Garlic.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Chicken Skewer 300g')
	  AND trim(i.option_notes) = ''
)
  AND 'Sauce options: Lemon & Herb, Peri-Peri, BBQ, Jozi''s Creamy Garlic.' <> '';

INSERT INTO menu_items (
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
	'Espetada Kingklip Skewer 300g',
	'Fresh kingklip charred to perfection, grilled with lemon garlic butter, accompanied with a variety of peppers and red onion.',
	'',
	19500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Mains')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Espetada Kingklip Skewer 300g')
);

UPDATE menu_items
SET description = 'Fresh kingklip charred to perfection, grilled with lemon garlic butter, accompanied with a variety of peppers and red onion.',
    option_notes = '',
    price_cents = 19500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 1,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Kingklip Skewer 300g')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Mains')
	  AND lower(i.name) = lower('Espetada Kingklip Skewer 300g')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Sides & Sauces',
	NULL,
	'food',
	2,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Sides & Sauces')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Sides & Sauces')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Milho Frito',
	'100 year old family recipe, brought over from Madeira Island by our grandmother.',
	'',
	6000,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Milho Frito')
);

UPDATE menu_items
SET description = '100 year old family recipe, brought over from Madeira Island by our grandmother.',
    option_notes = '',
    price_cents = 6000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 1,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Milho Frito')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Milho Frito')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Fries',
	'',
	'',
	4500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Fries')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Fries')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Fries')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Salad',
	'',
	'',
	8500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Salad')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 8500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Salad')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Salad')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Free Range Egg',
	'',
	'',
	1500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Free Range Egg')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 1500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Free Range Egg')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Free Range Egg')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Portuguese Roll',
	'',
	'',
	1100,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Portuguese Roll')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 1100,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Portuguese Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Portuguese Roll')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Trinchado Sauce',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Trinchado Sauce')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Trinchado Sauce')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Trinchado Sauce')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Jozi''s Creamy Garlic Sauce',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Sides & Sauces')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Jozi''s Creamy Garlic Sauce')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Jozi''s Creamy Garlic Sauce')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Sides & Sauces')
	  AND lower(i.name) = lower('Jozi''s Creamy Garlic Sauce')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Burgers',
	NULL,
	'food',
	3,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Burgers')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Burgers')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Siuuu! CR7',
	'Mild Portuguese peri-peri chicken fillet, stacked with grilled chorizo, crispy milho frito, mature cheddar cheese, fried egg, garnished with Portuguese parsley. Served with a 5pc milho frito.',
	'',
	16000,
	NULL,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Siuuu! CR7')
);

UPDATE menu_items
SET description = 'Mild Portuguese peri-peri chicken fillet, stacked with grilled chorizo, crispy milho frito, mature cheddar cheese, fried egg, garnished with Portuguese parsley. Served with a 5pc milho frito.',
    option_notes = '',
    price_cents = 16000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Siuuu! CR7')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Siuuu! CR7')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Creamy Garlic Classic',
	'Flame-grilled chicken fillet basted in creamy garlic, layered with crispy bacon, sweet grilled pineapple, peppadew, avocado, rocket and cheese. Served with fries.',
	'',
	14500,
	NULL,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Creamy Garlic Classic')
);

UPDATE menu_items
SET description = 'Flame-grilled chicken fillet basted in creamy garlic, layered with crispy bacon, sweet grilled pineapple, peppadew, avocado, rocket and cheese. Served with fries.',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Creamy Garlic Classic')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Creamy Garlic Classic')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'5aSide',
	'200g flame-grilled pure beef BBQ burger, basted in signature BBQ sauce layered with bacon, fresh avocado, cheese, tangy gherkins, tomato, red onion, finished with a drizzle of smokey BBQ and creamy mayo. Served with crispy fries.',
	'',
	14500,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('5aSide')
);

UPDATE menu_items
SET description = '200g flame-grilled pure beef BBQ burger, basted in signature BBQ sauce layered with bacon, fresh avocado, cheese, tangy gherkins, tomato, red onion, finished with a drizzle of smokey BBQ and creamy mayo. Served with crispy fries.',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('5aSide')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('5aSide')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Jozi''s Sweet Side',
	'Flame-grilled chicken fillet basted in sweet tikka, marinated in signature basting, with cheese, bacon, sweet pineapple and crunchy shredded cabbage. Served with crispy fries.',
	'',
	13500,
	NULL,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Jozi''s Sweet Side')
);

UPDATE menu_items
SET description = 'Flame-grilled chicken fillet basted in sweet tikka, marinated in signature basting, with cheese, bacon, sweet pineapple and crunchy shredded cabbage. Served with crispy fries.',
    option_notes = '',
    price_cents = 13500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Jozi''s Sweet Side')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Jozi''s Sweet Side')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'The Benchwarmer',
	'Flame-grilled 200g pure beef patty, topped with cheese, lettuce, tomato and a signature cool-ranch drizzle. Served with fries.',
	'',
	12500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('The Benchwarmer')
);

UPDATE menu_items
SET description = 'Flame-grilled 200g pure beef patty, topped with cheese, lettuce, tomato and a signature cool-ranch drizzle. Served with fries.',
    option_notes = '',
    price_cents = 12500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('The Benchwarmer')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('The Benchwarmer')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Two Cheezy Joe''s',
	'The legendary Cheezy Joe''s 100g pure beef or 100% chicken fillet burgers, drizzled with creamy mayo and rich smokey BBQ sauce, topped with cheese (two burgers).',
	'Choice of beef or chicken fillet.',
	9000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Burgers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Two Cheezy Joe''s')
);

UPDATE menu_items
SET description = 'The legendary Cheezy Joe''s 100g pure beef or 100% chicken fillet burgers, drizzled with creamy mayo and rich smokey BBQ sauce, topped with cheese (two burgers).',
    option_notes = 'Choice of beef or chicken fillet.',
    price_cents = 9000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Two Cheezy Joe''s')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'Choice of beef or chicken fillet.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Burgers')
	  AND lower(i.name) = lower('Two Cheezy Joe''s')
	  AND trim(i.option_notes) = ''
)
  AND 'Choice of beef or chicken fillet.' <> '';

INSERT INTO menu_categories (
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
	'Wraps',
	NULL,
	'food',
	4,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Wraps')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Wraps')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Philly Cheese Steak Wrap',
	'Loaded with tender shaved rump steak, a triple cheese melt, grilled onions and peppers - big flavour from the first bite to the last.',
	'',
	13500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Wraps')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Philly Cheese Steak Wrap')
);

UPDATE menu_items
SET description = 'Loaded with tender shaved rump steak, a triple cheese melt, grilled onions and peppers - big flavour from the first bite to the last.',
    option_notes = '',
    price_cents = 13500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Philly Cheese Steak Wrap')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Philly Cheese Steak Wrap')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Crummy Chicken Wrap',
	'Crispy crumbed chicken fillet paired with sweet pineapple, tangy peppadew, fresh rocket and cream cheese, drizzled with tangy mayo and sweet chilli.',
	'',
	12500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Wraps')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Crummy Chicken Wrap')
);

UPDATE menu_items
SET description = 'Crispy crumbed chicken fillet paired with sweet pineapple, tangy peppadew, fresh rocket and cream cheese, drizzled with tangy mayo and sweet chilli.',
    option_notes = '',
    price_cents = 12500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 1,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Crummy Chicken Wrap')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Crummy Chicken Wrap')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Chicken Wrap',
	'Chicken breast, cream cheese, sour cream, avocado, shredded cabbage, caramelized onion, pineapple and rocket.',
	'Choose sauce: Sweet Tikka, Jozi''s Creamy Garlic, Lemon & Herb, Peri-Peri, BBQ.',
	12500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Wraps')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Chicken Wrap')
);

UPDATE menu_items
SET description = 'Chicken breast, cream cheese, sour cream, avocado, shredded cabbage, caramelized onion, pineapple and rocket.',
    option_notes = 'Choose sauce: Sweet Tikka, Jozi''s Creamy Garlic, Lemon & Herb, Peri-Peri, BBQ.',
    price_cents = 12500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Chicken Wrap')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'Choose sauce: Sweet Tikka, Jozi''s Creamy Garlic, Lemon & Herb, Peri-Peri, BBQ.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Wraps')
	  AND lower(i.name) = lower('Chicken Wrap')
	  AND trim(i.option_notes) = ''
)
  AND 'Choose sauce: Sweet Tikka, Jozi''s Creamy Garlic, Lemon & Herb, Peri-Peri, BBQ.' <> '';

INSERT INTO menu_categories (
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
	'On The Go',
	NULL,
	'food',
	5,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('On The Go')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('On The Go')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Footlong Hotdog',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On The Go')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Footlong Hotdog')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Footlong Hotdog')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Footlong Hotdog')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Grilled Russian Roll',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On The Go')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Grilled Russian Roll')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Grilled Russian Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Grilled Russian Roll')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Boerewors Roll',
	'',
	'With or without onions.',
	4500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On The Go')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Boerewors Roll')
);

UPDATE menu_items
SET description = '',
    option_notes = 'With or without onions.',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Boerewors Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'With or without onions.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On The Go')
	  AND lower(i.name) = lower('Boerewors Roll')
	  AND trim(i.option_notes) = ''
)
  AND 'With or without onions.' <> '';

INSERT INTO menu_categories (
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
	'Pizzas',
	'Extras listed but no prices in source PDF: Ham, Bacon, Chicken, Salami, Chorizo, Steak, Avo, Pineapple, Peppadews, Caramelized Onions, Mushrooms, Feta, Olives.',
	'food',
	6,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Pizzas')
);

UPDATE menu_categories
SET description = 'Extras listed but no prices in source PDF: Ham, Bacon, Chicken, Salami, Chorizo, Steak, Avo, Pineapple, Peppadews, Caramelized Onions, Mushrooms, Feta, Olives.',
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Pizzas')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Gabi',
	'Classic margherita',
	'',
	11000,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Gabi')
);

UPDATE menu_items
SET description = 'Classic margherita',
    option_notes = '',
    price_cents = 11000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Gabi')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Gabi')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Aleci',
	'Ham & mushroom',
	'',
	13500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Aleci')
);

UPDATE menu_items
SET description = 'Ham & mushroom',
    option_notes = '',
    price_cents = 13500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Aleci')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Aleci')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Avi',
	'Rump steak & avocado',
	'',
	15000,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Avi')
);

UPDATE menu_items
SET description = 'Rump steak & avocado',
    option_notes = '',
    price_cents = 15000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Avi')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Avi')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Amelia',
	'Vegetarian',
	'',
	14500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Amelia')
);

UPDATE menu_items
SET description = 'Vegetarian',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Amelia')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Amelia')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Elandro',
	'Bacon & avocado',
	'',
	14500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Elandro')
);

UPDATE menu_items
SET description = 'Bacon & avocado',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Elandro')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Elandro')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Mase',
	'Salami & mushroom',
	'',
	14500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Mase')
);

UPDATE menu_items
SET description = 'Salami & mushroom',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Mase')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Mase')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Giuli',
	'Chicken, feta & peppadew',
	'',
	14500,
	NULL,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Giuli')
);

UPDATE menu_items
SET description = 'Chicken, feta & peppadew',
    option_notes = '',
    price_cents = 14500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Giuli')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Giuli')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Siana',
	'Bacon & pineapple',
	'',
	15000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	7,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Siana')
);

UPDATE menu_items
SET description = 'Bacon & pineapple',
    option_notes = '',
    price_cents = 15000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Siana')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Siana')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Bella',
	'Sweet tikka chicken & pineapple',
	'',
	15000,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	8,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Bella')
);

UPDATE menu_items
SET description = 'Sweet tikka chicken & pineapple',
    option_notes = '',
    price_cents = 15000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Bella')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Bella')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Catti',
	'Russian & caramelized onion',
	'',
	14000,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	9,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Catti')
);

UPDATE menu_items
SET description = 'Russian & caramelized onion',
    option_notes = '',
    price_cents = 14000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Catti')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('Catti')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'The Jackster',
	'BBQ chicken, caramelized onion, pineapple & avocado',
	'',
	17000,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	10,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('The Jackster')
);

UPDATE menu_items
SET description = 'BBQ chicken, caramelized onion, pineapple & avocado',
    option_notes = '',
    price_cents = 17000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The Jackster')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The Jackster')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'The Maria de Carne',
	'Chicken, bacon, pineapple, peppadew, feta, mushrooms & avocado',
	'',
	18500,
	NULL,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	11,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('The Maria de Carne')
);

UPDATE menu_items
SET description = 'Chicken, bacon, pineapple, peppadew, feta, mushrooms & avocado',
    option_notes = '',
    price_cents = 18500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The Maria de Carne')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The Maria de Carne')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'The T.O.P',
	'Mild peri-peri chicken, chorizo, cocktail tomatoes, olives, feta & avocado',
	'',
	19500,
	NULL,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	12,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Pizzas')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('The T.O.P')
);

UPDATE menu_items
SET description = 'Mild peri-peri chicken, chorizo, cocktail tomatoes, olives, feta & avocado',
    option_notes = '',
    price_cents = 19500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 1,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The T.O.P')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Pizzas')
	  AND lower(i.name) = lower('The T.O.P')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Kiddies',
	NULL,
	'food',
	7,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Kiddies')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Kiddies')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Ham & Cheese Toastie',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Ham & Cheese Toastie')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Ham & Cheese Toastie')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Ham & Cheese Toastie')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Chicken Nuggets',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Chicken Nuggets')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Chicken Nuggets')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Chicken Nuggets')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Footlong Hotdog',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Footlong Hotdog')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Footlong Hotdog')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Footlong Hotdog')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Boerewors Roll',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Boerewors Roll')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Boerewors Roll')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Boerewors Roll')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Cheese Burger',
	'',
	'Choice of chicken or beef.',
	4500,
	NULL,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cheese Burger')
);

UPDATE menu_items
SET description = '',
    option_notes = 'Choice of chicken or beef.',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Cheese Burger')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = 'Choice of chicken or beef.',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Cheese Burger')
	  AND trim(i.option_notes) = ''
)
  AND 'Choice of chicken or beef.' <> '';

INSERT INTO menu_items (
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
	'Fries',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Fries')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Fries')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Fries')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Water',
	'',
	'',
	2200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Water')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Water')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Water')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Energade',
	'',
	'',
	2500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	7,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Energade')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Energade')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Energade')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Soda / Fruto Juice',
	'',
	'',
	2700,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	8,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Kiddies')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Soda / Fruto Juice')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2700,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Soda / Fruto Juice')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Kiddies')
	  AND lower(i.name) = lower('Soda / Fruto Juice')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Toasties',
	NULL,
	'food',
	8,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Toasties')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'food',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Toasties')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Cheese',
	'',
	'',
	2500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Toasties')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cheese')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Cheese')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Cheese')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Cheese Tomato Onion',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Toasties')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cheese Tomato Onion')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Cheese Tomato Onion')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Cheese Tomato Onion')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Ham & Cheese',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Toasties')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Ham & Cheese')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Ham & Cheese')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Ham & Cheese')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Ham Cheese Tomato',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Toasties')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Ham Cheese Tomato')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Ham Cheese Tomato')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Ham Cheese Tomato')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Bacon Egg Cheese',
	'',
	'',
	4500,
	NULL,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Toasties')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Bacon Egg Cheese')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 0,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Bacon Egg Cheese')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Toasties')
	  AND lower(i.name) = lower('Bacon Egg Cheese')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'On Tap',
	NULL,
	'drinks',
	9,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('On Tap')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('On Tap')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Super Bock',
	'',
	'',
	7000,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On Tap')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Super Bock')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 7000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Super Bock')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Super Bock')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Stella Artois',
	'',
	'',
	6500,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On Tap')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Stella Artois')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 6500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Stella Artois')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Stella Artois')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Castle Lite',
	'',
	'',
	5500,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('On Tap')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Castle Lite')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 5500,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Castle Lite')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('On Tap')
	  AND lower(i.name) = lower('Castle Lite')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Beers',
	NULL,
	'drinks',
	10,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Beers')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Beers')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Castle Lite/Lager',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Castle Lite/Lager')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Castle Lite/Lager')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Castle Lite/Lager')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Black Label',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Black Label')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Black Label')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Black Label')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Heineken/Silver/0.0',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Heineken/Silver/0.0')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Heineken/Silver/0.0')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Heineken/Silver/0.0')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Windhoek Draught',
	'',
	'',
	5300,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Windhoek Draught')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 5300,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Windhoek Draught')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Windhoek Draught')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Corona',
	'',
	'',
	4300,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Corona')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4300,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Corona')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Corona')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Stella Artois',
	'',
	'',
	4300,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Stella Artois')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4300,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Stella Artois')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Stella Artois')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Super Bock Green',
	'',
	'',
	4500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Beers')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Super Bock Green')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Super Bock Green')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Beers')
	  AND lower(i.name) = lower('Super Bock Green')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Ciders',
	NULL,
	'drinks',
	11,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Ciders')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Ciders')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Savana Dry/Light/0.0',
	'',
	'',
	4200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Savana Dry/Light/0.0')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Savana Dry/Light/0.0')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Savana Dry/Light/0.0')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Hunters Gold/Dry/Extreme',
	'',
	'',
	4200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Hunters Gold/Dry/Extreme')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Hunters Gold/Dry/Extreme')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Hunters Gold/Dry/Extreme')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Smirnoff Spin/Storm/Pinetwist',
	'',
	'',
	4200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Smirnoff Spin/Storm/Pinetwist')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Smirnoff Spin/Storm/Pinetwist')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Smirnoff Spin/Storm/Pinetwist')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Brutal Fruit',
	'',
	'',
	4200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Brutal Fruit')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Brutal Fruit')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Brutal Fruit')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Flying Fish',
	'',
	'',
	4200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Flying Fish')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Flying Fish')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Flying Fish')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Caribbean Twist',
	'',
	'',
	4500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Caribbean Twist')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Caribbean Twist')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Caribbean Twist')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Kopperberg',
	'',
	'',
	5500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Ciders')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Kopperberg')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 5500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Kopperberg')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Ciders')
	  AND lower(i.name) = lower('Kopperberg')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Gin',
	NULL,
	'drinks',
	12,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Gin')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Gin')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Strettons',
	'',
	'',
	2800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Gin')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Strettons')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Strettons')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Strettons')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Gordons',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Gin')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Gordons')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Gordons')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Gordons')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Tanqueray / Seville',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Gin')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Tanqueray / Seville')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Tanqueray / Seville')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Tanqueray / Seville')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Bombay',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Gin')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Bombay')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Bombay')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Gin')
	  AND lower(i.name) = lower('Bombay')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Brandy',
	NULL,
	'drinks',
	13,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Brandy')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Brandy')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Olofbergh / Klipdrift',
	'',
	'',
	2800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Olofbergh / Klipdrift')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Olofbergh / Klipdrift')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Olofbergh / Klipdrift')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Klipdrift Premium',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Klipdrift Premium')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Klipdrift Premium')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Klipdrift Premium')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Richelieu',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Richelieu')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Richelieu')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('Richelieu')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'KWV 5Y',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('KWV 5Y')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('KWV 5Y')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('KWV 5Y')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'KWV 10Y',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('KWV 10Y')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('KWV 10Y')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('KWV 10Y')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'1920',
	'',
	'',
	4000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Brandy')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('1920')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('1920')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Brandy')
	  AND lower(i.name) = lower('1920')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Vodka',
	NULL,
	'drinks',
	14,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Vodka')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Vodka')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Smirnoff 1818',
	'',
	'',
	2800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Vodka')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Smirnoff 1818')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 2800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Smirnoff 1818')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Smirnoff 1818')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Skyy',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Vodka')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Skyy')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Skyy')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Skyy')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Cruz Watermelon',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Vodka')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cruz Watermelon')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Cruz Watermelon')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Cruz Watermelon')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Cruz Vintage Black',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Vodka')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cruz Vintage Black')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Cruz Vintage Black')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Vodka')
	  AND lower(i.name) = lower('Cruz Vintage Black')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Rum',
	NULL,
	'drinks',
	15,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Rum')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Rum')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Southern Comfort',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Southern Comfort')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Southern Comfort')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Southern Comfort')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Spiced Gold',
	'',
	'',
	3000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Spiced Gold')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Spiced Gold')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Spiced Gold')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Red Heart',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Red Heart')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Red Heart')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Red Heart')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Captain Morgan Dark',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Captain Morgan Dark')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Captain Morgan Dark')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Captain Morgan Dark')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Bacardi White',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Bacardi White')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Bacardi White')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Bacardi White')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Malibu',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Malibu')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Malibu')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Malibu')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Kraken',
	'',
	'',
	4300,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Rum')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Kraken')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 4300,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Kraken')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Rum')
	  AND lower(i.name) = lower('Kraken')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Whiskey',
	NULL,
	'drinks',
	16,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Whiskey')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Whiskey')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Bells / J&B',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Bells / J&B')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Bells / J&B')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Bells / J&B')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Pogues',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Pogues')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Pogues')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Pogues')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Jameson',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Jameson')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Jameson')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Jameson')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Johnnie Walker Red',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Johnnie Walker Red')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Johnnie Walker Red')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Johnnie Walker Red')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Johnnie Walker Black',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Johnnie Walker Black')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Johnnie Walker Black')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Johnnie Walker Black')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Jack Daniels',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Jack Daniels')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Jack Daniels')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Jack Daniels')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Glenmorangie',
	'',
	'',
	5000,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	6,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Glenmorangie')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 5000,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Glenmorangie')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Glenmorangie')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Tullamore Dew',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	7,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Tullamore Dew')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Tullamore Dew')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Tullamore Dew')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Proper 12',
	'',
	'',
	3800,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	8,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Proper 12')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3800,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Proper 12')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Proper 12')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Macallan 12Y',
	'',
	'',
	9500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	9,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Whiskey')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Macallan 12Y')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 9500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Macallan 12Y')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Whiskey')
	  AND lower(i.name) = lower('Macallan 12Y')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Shooters',
	NULL,
	'drinks',
	17,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Shooters')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Shooters')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'Jagermeister / Jose Cuervo',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Jagermeister / Jose Cuervo')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Jagermeister / Jose Cuervo')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Jagermeister / Jose Cuervo')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Caramel Vodka',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Caramel Vodka')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Caramel Vodka')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Caramel Vodka')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Cactus Jack',
	'',
	'',
	3200,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	2,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Cactus Jack')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3200,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Cactus Jack')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Cactus Jack')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Portuguese Poncha',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	3,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Portuguese Poncha')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Portuguese Poncha')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Portuguese Poncha')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Ponchos',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	4,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Ponchos')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Ponchos')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Ponchos')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_items (
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
	'Shanky''s Whip',
	'',
	'',
	3500,
	NULL,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	5,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Shooters')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('Shanky''s Whip')
);

UPDATE menu_items
SET description = '',
    option_notes = '',
    price_cents = 3500,
    active = 1,
    available = 1,
    popular = 0,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Shanky''s Whip')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Shooters')
	  AND lower(i.name) = lower('Shanky''s Whip')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

INSERT INTO menu_categories (
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
	'Double Up Specials',
	NULL,
	'drinks',
	18,
	1,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_categories c
	WHERE c.business_id = b.id
	  AND lower(c.name) = lower('Double Up Specials')
);

UPDATE menu_categories
SET description = NULL,
    menu_group = 'drinks',
    updated_at = (unixepoch('now') * 1000)
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
  AND lower(name) = lower('Double Up Specials')
  AND (description IS NULL OR trim(description) = '');

INSERT INTO menu_items (
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
	'2 x Brandy / Rum / Whiskey / Vodka / Gin',
	'Includes pouring chasers (Coke / Coke Zero / Tonic / Soda Water / Lemonade).',
	'',
	8000,
	NULL,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	(unixepoch('now') * 1000),
	(unixepoch('now') * 1000)
FROM businesses b
JOIN menu_categories c
  ON c.business_id = b.id
 AND lower(c.name) = lower('Double Up Specials')
WHERE b.slug = 'fives-pub-and-grill'
  AND NOT EXISTS (
	SELECT 1
	FROM menu_items i
	WHERE i.business_id = b.id
	  AND i.category_id = c.id
	  AND lower(i.name) = lower('2 x Brandy / Rum / Whiskey / Vodka / Gin')
);

UPDATE menu_items
SET description = 'Includes pouring chasers (Coke / Coke Zero / Tonic / Soda Water / Lemonade).',
    option_notes = '',
    price_cents = 8000,
    active = 1,
    available = 1,
    popular = 1,
    vegetarian = 1,
    spicy = 0,
    is_new = 0,
    subject_to_availability = 0,
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Double Up Specials')
	  AND lower(i.name) = lower('2 x Brandy / Rum / Whiskey / Vodka / Gin')
	  AND (trim(i.description) = '' OR i.description = 'Placeholder menu item — replace before launch.')
);

UPDATE menu_items
SET option_notes = '',
    updated_at = (unixepoch('now') * 1000)
WHERE id IN (
	SELECT i.id
	FROM menu_items i
	JOIN businesses b ON b.id = i.business_id
	JOIN menu_categories c ON c.id = i.category_id
	WHERE b.slug = 'fives-pub-and-grill'
	  AND lower(c.name) = lower('Double Up Specials')
	  AND lower(i.name) = lower('2 x Brandy / Rum / Whiskey / Vodka / Gin')
	  AND trim(i.option_notes) = ''
)
  AND '' <> '';

SELECT COUNT(*) AS categories_count
FROM menu_categories
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1);

SELECT COUNT(*) AS items_count
FROM menu_items
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1);

SELECT COUNT(*) AS variants_count
FROM menu_item_variants
WHERE menu_item_id IN (
	SELECT id FROM menu_items
	WHERE business_id = (SELECT id FROM businesses WHERE slug = 'fives-pub-and-grill' LIMIT 1)
);
