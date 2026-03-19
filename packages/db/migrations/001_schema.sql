-- ============================================================
-- Tunda — Full Schema Migration
-- ============================================================

-- businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id),
  plan text default 'free', -- free | starter | business | shop_plus
  created_at timestamptz default now()
);

-- employees
create table employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid references auth.users(id),
  role text default 'employee', -- owner | employee
  created_at timestamptz default now()
);

-- products
create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  category text,
  buy_price numeric(12,2) not null,
  sell_price numeric(12,2) not null,
  stock_qty integer default 0,
  low_stock_threshold integer default 5,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  credit_limit numeric(12,2) default 0,
  credit_balance numeric(12,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- sales
create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  employee_id uuid references employees(id),
  customer_id uuid references customers(id),
  payment_type text not null, -- cash | credit
  total_amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

-- sale_items
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id),
  qty integer not null,
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null
);

-- credit_payments
create table credit_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id),
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

-- cash_log
create table cash_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  type text not null, -- sale | bank_deposit | expense | credit_payment
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

-- reminder_config
create table reminder_config (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade unique,
  is_enabled boolean default false,
  schedule text default 'weekly', -- daily | weekly | monthly | custom
  custom_cron text,
  message_template text default 'Hello {name}, you have an outstanding balance of UGX {balance} at {business}. Please make a payment. Thank you.',
  updated_at timestamptz default now()
);

-- stock_adjustments
create table stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  product_id uuid references products(id),
  qty_change integer not null,
  reason text,
  created_at timestamptz default now()
);
