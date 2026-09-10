-- Rename the existing Pinehurst location in place without creating new rows.
UPDATE locations
SET name = 'Fives Sports Bar - Pinehurst'
WHERE name = 'Fives - Pinehurst'
  AND business_id IN (
    SELECT id
    FROM businesses
    WHERE slug = 'fives-pub-and-grill'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM locations l2
    WHERE l2.business_id = locations.business_id
      AND l2.name = 'Fives Sports Bar - Pinehurst'
  );
