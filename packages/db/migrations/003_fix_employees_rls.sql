-- Fix employees RLS: chicken-and-egg problem during onboarding.
-- The original ALL policy used get_my_business_id() for INSERT, but that
-- function queries employees to find business_id — which returns NULL for
-- a brand new user who has no employee record yet, blocking their first INSERT.

drop policy "Users access their own employee records" on employees;

-- SELECT / UPDATE / DELETE: must already be in the same business
create policy "Users can view employees in their business"
on employees for select
using (business_id = get_my_business_id());

-- INSERT: a user can only insert a record for themselves
create policy "Users can insert their own employee record"
on employees for insert
with check (user_id = auth.uid());

-- Only owners can update or remove employee records
create policy "Owners can update employees in their business"
on employees for update
using (business_id = get_my_business_id() and get_my_role() = 'owner');

create policy "Owners can delete employees in their business"
on employees for delete
using (business_id = get_my_business_id() and get_my_role() = 'owner');
