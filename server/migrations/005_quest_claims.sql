-- Quest rewards: one row per claimed quest per period (day or ISO week).
-- PAW are minted on Solana; status follows the same flow as shop_purchases:
-- pending -> submitted (signature saved before broadcast) -> confirmed / failed.

CREATE TABLE IF NOT EXISTS quest_claims (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
  tx_signature TEXT,
  last_valid_block_height BIGINT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- A quest can be rewarded only once per period. Failed attempts don't count,
-- so the user can try again after a failure.
CREATE UNIQUE INDEX IF NOT EXISTS quest_claims_once_per_period
  ON quest_claims (user_id, quest_id, period_key)
  WHERE status <> 'failed';
