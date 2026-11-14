ALTER TABLE public.shop_purchases
ADD COLUMN IF NOT EXISTS signed_transaction TEXT;
