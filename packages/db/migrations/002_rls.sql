-- ============================================================
-- Tunda — Row Level Security Policies
-- ============================================================

-- Helper function: get the business_id for the current user
create or replace function get_my_business_id()
returns uuid language sql security definer stable as $$
  select business_id from employees where user_id = auth.uid() limit 1;
$$;

-- Helper function: get the role for the current user
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from employees where user_id = auth.uid() limit 1;
$$;

-- -------------------------------------------------------
-- businesses
-- -------------------------------------------------------
alter table businesses enable row level security;

create policy "Owner can manage their business"
on businesses for all
using (owner_id = auth.uid());

create policy "Employees can view their business"
on businesses for select
using (
  id in (select business_id from employees where user_id = auth.uid())
);

-- -------------------------------------------------------
-- employees
-- -------------------------------------------------------
alter table employees enable row level security;

create policy "Users access their own employee records"
on employees for all
using (
  business_id = get_my_business_id()
);

-- -------------------------------------------------------
-- products
-- -------------------------------------------------------
alter table products enable row level security;

create policy "Business members can view products"
on products for select
using (business_id = get_my_business_id());

create policy "Owners can manage products"
on products for insert
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "Owners can update products"
on products for update
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "Owners can delete products"
on products for delete
using (business_id = get_my_business_id() and get_my_role() = 'owner');

-- -------------------------------------------------------
-- customers
-- -------------------------------------------------------
alter table customers enable row level security;

create policy "Business members can view customers"
on customers for select
using (business_id = get_my_business_id());

create policy "Owners and employees can insert customers"
on customers for insert
using (business_id = get_my_business_id());

create policy "Owners can update customers"
on customers for update
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "Owners can delete customers"
on customers for delete
using (business_id = get_my_business_id() and get_my_role() = 'owner');

-- -------------------------------------------------------
-- sales
-- -------------------------------------------------------
alter table sales enable row level security;

create policy "Business members can view sales"
on sales for select
using (business_id = get_my_business_id());

create policy "Business members can insert sales"
on sales for insert
using (business_id = get_my_business_id());

create policy "Owners can update/delete sales"
on sales for update
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "Owners can delete sales"
on sales for delete
using (business_id = get_my_business_id() and get_my_role() = 'owner');

-- -------------------------------------------------------
-- sale_items
-- -------------------------------------------------------
alter table sale_items enable row level security;

create policy "Business members can view sale items"
on sale_items for select
using (
  sale_id in (select id from sales where business_id = get_my_business_id())
);

create policy "Business members can insert sale items"
on sale_items for insert
using (
  sale_id in (select id from sales where business_id = get_my_business_id())
);

-- -------------------------------------------------------
-- credit_payments
-- -------------------------------------------------------
alter table credit_payments enable row level security;

create policy "Business members can view credit payments"
on credit_payments for select
using (business_id = get_my_business_id());

create policy "Business members can insert credit payments"
on credit_payments for insert
using (business_id = get_my_business_id());

-- -------------------------------------------------------
-- cash_log
-- -------------------------------------------------------
alter table cash_log enable row level security;

create policy "Owners can view cash log"
on cash_log for select
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "All members can insert cash log entries"
on cash_log for insert
using (business_id = get_my_business_id());

-- -------------------------------------------------------
-- reminder_config
-- -------------------------------------------------------
alter table reminder_config enable row level security;

create policy "Owners can manage reminder config"
on reminder_config for all
using (business_id = get_my_business_id() and get_my_role() = 'owner');

-- -------------------------------------------------------
-- stock_adjustments
-- -------------------------------------------------------
alter table stock_adjustments enable row level security;

create policy "Business members can view stock adjustments"
on stock_adjustments for select
using (business_id = get_my_business_id());

create policy "Owners can manage stock adjustments"
on stock_adjustments for insert
using (business_id = get_my_business_id() and get_my_role() = 'owner');
