-- Shop: only the real video skins (Hogwarts + Graduation) next to Classic.
-- The placeholder skins are hidden (is_active = FALSE), not deleted, so
-- existing purchases and inventory rows that reference them stay valid.

BEGIN;

INSERT INTO shop_items (id, name, description, price, is_active)
VALUES
  ('hogwarts', 'Hogwarts Laica', 'Ready for a magical school year', 150, TRUE),
  ('graduation', 'Graduation Laica', 'Cap on, diploma ready', 200, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  is_active = TRUE,
  updated_at = NOW();

UPDATE shop_items
SET is_active = FALSE,
    updated_at = NOW()
WHERE id IN ('lavender', 'strawberry', 'sage', 'midnight');

-- Users who had a hidden skin equipped go back to Classic.
UPDATE user_inventory
SET is_equipped = FALSE
WHERE is_equipped = TRUE
  AND item_id IN ('lavender', 'strawberry', 'sage', 'midnight');

INSERT INTO user_inventory (user_id, item_id, is_equipped)
SELECT u.id, 'classic', TRUE
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM user_inventory i
  WHERE i.user_id = u.id
    AND i.is_equipped = TRUE
)
ON CONFLICT (user_id, item_id) DO UPDATE SET
  is_equipped = TRUE;

COMMIT;
