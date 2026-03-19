-- ============================================================
-- Tunda — Migration 005
-- UAC roles, payment accounts, receipt settings, purchase catalog
-- ============================================================

-- 1. Extend employees role to include manager and waiter
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('owner', 'manager', 'waiter', 'employee'));

-- 2. Extend bank_accounts account_type to include cash_drawer
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_account_type_check;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_account_type_check
  CHECK (account_type IN ('cash_drawer', 'cash', 'checking', 'savings', 'mobile_money'));

-- 3. Add provider column to bank_accounts (for MTN MM, Airtel MM)
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS provider text
  CHECK (provider IN ('mtn', 'airtel', NULL));

-- 4. Link invoice_payments to a bank account
ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- 5. Link purchase_bill_payments to a bank account
ALTER TABLE purchase_bill_payments
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- 6. Add receipt/invoice settings to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS receipt_template  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS invoice_template  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business_phone    text,
  ADD COLUMN IF NOT EXISTS business_address  text,
  ADD COLUMN IF NOT EXISTS receipt_header    text,
  ADD COLUMN IF NOT EXISTS receipt_footer    text DEFAULT 'Thank you for your business!';

-- 7. Purchase catalog — vendor items/services not in the product list
CREATE TABLE IF NOT EXISTS purchase_catalog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         text NOT NULL,
  category     text,
  unit         text,
  default_cost numeric(12,2) NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can manage purchase catalog" ON purchase_catalog
  USING  (business_id = get_my_business_id())
  WITH CHECK (business_id = get_my_business_id());

-- 8. Add purchase_catalog reference to purchase_bill_items
ALTER TABLE purchase_bill_items
  ADD COLUMN IF NOT EXISTS purchase_item_id uuid REFERENCES purchase_catalog(id) ON DELETE SET NULL;

-- 9. Auto-create Cash Drawer for every business that doesn't have one
INSERT INTO bank_accounts (business_id, name, account_type, opening_balance, current_balance)
SELECT id, 'Cash Drawer', 'cash_drawer', 0, 0
FROM   businesses
WHERE  id NOT IN (
  SELECT business_id FROM bank_accounts WHERE account_type = 'cash_drawer'
);

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_payments_account      ON invoice_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_account         ON purchase_bill_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_catalog_business     ON purchase_catalog(business_id);
