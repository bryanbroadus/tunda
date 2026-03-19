-- ============================================================
-- Tunda — Wave Redesign Migration 004
-- New tables: vendors, purchase_bills/items/payments,
--             invoices/items/payments, bank_accounts/transactions, accounts
-- Migrates existing sales data. Old tables kept for fallback.
-- ============================================================

-- 1. Add invoice/bill counters to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS next_invoice_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_bill_number    integer NOT NULL DEFAULT 1;

-- 2. vendors
CREATE TABLE vendors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  phone       text,
  email       text,
  address     text,
  notes       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. purchase_bills
CREATE TABLE purchase_bills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor_id    uuid REFERENCES vendors(id) ON DELETE SET NULL,
  bill_number  text NOT NULL,
  status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','open','partial','paid')),
  issue_date   date NOT NULL DEFAULT CURRENT_DATE,
  due_date     date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid  numeric(12,2) NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, bill_number)
);

-- 4. purchase_bill_items
CREATE TABLE purchase_bill_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  description text,
  qty         integer NOT NULL CHECK (qty > 0),
  unit_cost   numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. purchase_bill_payments
CREATE TABLE purchase_bill_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      uuid NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 6. invoices (replaces sales)
CREATE TABLE invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id    uuid REFERENCES employees(id) ON DELETE SET NULL,
  customer_id    uuid REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  status         text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('draft','open','partial','paid','overdue','void')),
  issue_date     date NOT NULL DEFAULT CURRENT_DATE,
  due_date       date,
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid    numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash','credit','mobile_money','bank')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, invoice_number)
);

-- 7. invoice_items (replaces sale_items)
CREATE TABLE invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES products(id) ON DELETE SET NULL,
  description text,
  qty         integer NOT NULL CHECK (qty > 0),
  unit_price  numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost   numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 8. invoice_payments (replaces credit_payments)
CREATE TABLE invoice_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id    uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date   date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text CHECK (payment_method IN ('cash','mobile_money','bank')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 9. bank_accounts
CREATE TABLE bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            text NOT NULL,
  account_type    text NOT NULL DEFAULT 'cash'
                    CHECK (account_type IN ('cash','checking','savings','mobile_money')),
  institution     text,
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 10. bank_transactions
CREATE TABLE bank_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('deposit','withdrawal','transfer')),
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  description      text,
  reference        text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 11. accounts (chart of accounts)
CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

-- 12. Triggers: purchase_bill_items <-> products.stock_qty
CREATE OR REPLACE FUNCTION trg_bill_item_add_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products SET stock_qty = stock_qty + NEW.qty WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bill_item_inserted AFTER INSERT ON purchase_bill_items FOR EACH ROW EXECUTE FUNCTION trg_bill_item_add_stock();

CREATE OR REPLACE FUNCTION trg_bill_item_remove_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    UPDATE products SET stock_qty = GREATEST(0, stock_qty - OLD.qty) WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER bill_item_deleted AFTER DELETE ON purchase_bill_items FOR EACH ROW EXECUTE FUNCTION trg_bill_item_remove_stock();

CREATE OR REPLACE FUNCTION trg_bill_item_update_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products SET stock_qty = GREATEST(0, stock_qty - OLD.qty + NEW.qty) WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bill_item_updated AFTER UPDATE OF qty ON purchase_bill_items FOR EACH ROW EXECUTE FUNCTION trg_bill_item_update_stock();

-- 13. Trigger: sync bill status from payments
CREATE OR REPLACE FUNCTION trg_sync_bill_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total numeric; v_paid numeric; v_status text;
BEGIN
  SELECT total_amount INTO v_total FROM purchase_bills WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM purchase_bill_payments WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id);
  IF v_paid = 0 THEN v_status := 'open';
  ELSIF v_paid >= v_total THEN v_status := 'paid';
  ELSE v_status := 'partial'; END IF;
  UPDATE purchase_bills SET amount_paid = v_paid, status = v_status WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER bill_payment_changed AFTER INSERT OR UPDATE OR DELETE ON purchase_bill_payments FOR EACH ROW EXECUTE FUNCTION trg_sync_bill_payment();

-- 14. Trigger: sync invoice status from payments
CREATE OR REPLACE FUNCTION trg_sync_invoice_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total numeric; v_paid numeric; v_status text;
BEGIN
  SELECT total_amount INTO v_total FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM invoice_payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_paid = 0 THEN v_status := 'open';
  ELSIF v_paid >= v_total THEN v_status := 'paid';
  ELSE v_status := 'partial'; END IF;
  UPDATE invoices SET amount_paid = v_paid, status = v_status WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER invoice_payment_changed AFTER INSERT OR UPDATE OR DELETE ON invoice_payments FOR EACH ROW EXECUTE FUNCTION trg_sync_invoice_payment();

-- 15. Sequential number generation functions
CREATE OR REPLACE FUNCTION next_invoice_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_num integer;
BEGIN
  UPDATE businesses SET next_invoice_number = next_invoice_number + 1 WHERE id = p_business_id RETURNING next_invoice_number - 1 INTO v_num;
  RETURN 'INV-' || LPAD(v_num::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION next_bill_number(p_business_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_num integer;
BEGIN
  UPDATE businesses SET next_bill_number = next_bill_number + 1 WHERE id = p_business_id RETURNING next_bill_number - 1 INTO v_num;
  RETURN 'BILL-' || LPAD(v_num::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_bill_number(uuid) TO authenticated;

-- 16-18: Data migration + 19: Chart of accounts + 20: RLS
-- (Applied via Supabase MCP — see apply_migration call in session)
-- NOTE: Old tables (sales, sale_items, credit_payments) kept for fallback.
--       Drop them after verifying new data is correct:
--       DROP TABLE sales, sale_items, credit_payments;
