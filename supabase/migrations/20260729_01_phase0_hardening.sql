-- ==========================================================
-- Phase 0 hardening
--   A. is_admin() helper
--   B. Block users from promoting themselves (profiles.role)
--   C. Data-quality CHECK constraints (existing rows are not re-checked)
--   D. Lock weather_cache so only the Edge Function can write
--   E. One notification per user/type/title per day (stops duplicates)
--
-- Safe to re-run. Review in the Supabase SQL Editor before applying.
-- Apply order for the whole Phase 0 release:
--   1) supabase functions deploy weather   (+ set OPENWEATHER_API_KEY secret)
--   2) run THIS migration
--   3) deploy the website
-- ==========================================================

-- ---------- A. is_admin() ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- B. Protect profiles.role ----------
-- Works regardless of which RLS policies exist on profiles: any change to
-- `role` made by a signed-in non-admin is rejected. Calls with no user JWT
-- (SQL editor, service role, migrations) are allowed.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only an administrator can change a user role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- C. CHECK constraints (NOT VALID = only new/updated rows are checked) ----------
-- Run `alter table ... validate constraint <name>;` later, after cleaning old data.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_amount_positive') then
    alter table public.transactions
      add constraint transactions_amount_positive check (amount > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transactions_type_valid') then
    alter table public.transactions
      add constraint transactions_type_valid check (type in ('income', 'expense')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'crop_plots_dates_ordered') then
    alter table public.crop_plots
      add constraint crop_plots_dates_ordered
      check (planted_date is null or expected_harvest is null or expected_harvest >= planted_date) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'market_prices_price_positive') then
    alter table public.market_prices
      add constraint market_prices_price_positive check (price > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'marketplace_listings_quantity_positive') then
    alter table public.marketplace_listings
      add constraint marketplace_listings_quantity_positive check (quantity > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'marketplace_listings_price_nonnegative') then
    alter table public.marketplace_listings
      add constraint marketplace_listings_price_nonnegative check (price >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'animal_feed_logs_quantity_positive') then
    alter table public.animal_feed_logs
      add constraint animal_feed_logs_quantity_positive check (quantity > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'animal_growth_records_weight_positive') then
    alter table public.animal_growth_records
      add constraint animal_growth_records_weight_positive check (weight_kg > 0) not valid;
  end if;
end $$;

-- ---------- D. weather_cache: read-only for signed-in users ----------
-- The Edge Function writes with the service role (which bypasses RLS).
alter table public.weather_cache enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'weather_cache'
  loop
    execute format('drop policy %I on public.weather_cache', r.policyname);
  end loop;
end $$;

create policy "weather_cache_read_authenticated"
  on public.weather_cache for select
  to authenticated
  using (true);

-- ---------- E. Notification de-duplication ----------
-- Remove existing same-day duplicates (keep the earliest), then forbid new ones.
-- The app treats the resulting unique-violation (23505) as "already notified".
delete from public.notifications n
using (
  select ctid as rid,
         row_number() over (
           partition by user_id, type, title, ((created_at at time zone 'UTC')::date)
           order by created_at
         ) as rn
  from public.notifications
) d
where n.ctid = d.rid and d.rn > 1;

create unique index if not exists notifications_one_per_day_idx
  on public.notifications (user_id, type, title, ((created_at at time zone 'UTC')::date));
