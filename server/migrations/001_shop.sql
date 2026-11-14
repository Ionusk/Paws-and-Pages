
BEGIN;

-- Catalogul oficial al Shop-ului.
CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price BIGINT NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Achizițiile și starea tranzacțiilor Solana.
CREATE TABLE IF NOT EXISTS shop_purchases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES shop_items(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
    idempotency_key TEXT NOT NULL,
    tx_signature TEXT UNIQUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,

    CONSTRAINT shop_purchase_idempotency_unique
        UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_user
    ON shop_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_shop_purchases_status
    ON shop_purchases(status);

-- Inventarul utilizatorilor.
CREATE TABLE IF NOT EXISTS user_inventory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES shop_items(id),
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purchase_id BIGINT REFERENCES shop_purchases(id),

    CONSTRAINT user_inventory_unique_item
        UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user
    ON user_inventory(user_id);

-- Un singur skin echipat per utilizator.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_inventory_one_equipped
    ON user_inventory(user_id)
    WHERE is_equipped = TRUE;

-- Catalogul inițial.
INSERT INTO shop_items (id, name, price)
VALUES
    ('classic', 'Classic Laica', 0),
    ('lavender', 'Lavender Dream', 80),
    ('strawberry', 'Strawberry Bloom', 120),
    ('sage', 'Forest Reader', 150),
    ('midnight', 'Midnight Stories', 200)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    updated_at = NOW();

-- Toți utilizatorii existenți primesc Classic Laica.
INSERT INTO user_inventory (user_id, item_id, is_equipped)
SELECT id, 'classic', TRUE
FROM users
ON CONFLICT (user_id, item_id) DO NOTHING;

-- Utilizatorii noi primesc automat Classic Laica.
CREATE OR REPLACE FUNCTION grant_default_shop_skin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_inventory (user_id, item_id, is_equipped)
    VALUES (NEW.id, 'classic', TRUE)
    ON CONFLICT (user_id, item_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_default_shop_skin ON users;

CREATE TRIGGER users_default_shop_skin
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION grant_default_shop_skin();

COMMIT;
