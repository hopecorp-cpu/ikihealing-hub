
ALTER TABLE revenue_attribution ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0;
ALTER TABLE revenue_attribution ADD COLUMN IF NOT EXISTS shipping_fee numeric DEFAULT 0;
ALTER TABLE revenue_attribution ADD COLUMN IF NOT EXISTS promotion    numeric DEFAULT 0;
ALTER TABLE revenue_attribution ADD COLUMN IF NOT EXISTS tax_amount   numeric DEFAULT 0;

