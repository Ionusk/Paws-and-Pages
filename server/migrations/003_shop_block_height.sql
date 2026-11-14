ALTER TABLE public.shop_purchases
ADD COLUMN IF NOT EXISTS last_valid_block_height BIGINT;
