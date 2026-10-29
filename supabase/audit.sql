-- ==========================================================
-- SCHEMA + RLS AUDIT QUERIES
-- Run each block in the Supabase SQL Editor and keep the results.
-- Phase 0 needs these to build the baseline migration and to
-- verify that every table is properly locked down.
-- ==========================================================

-- 1. Which tables have RLS enabled? (rls_enabled must be true for every app table)
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2. Every policy, in full
select tablename, policyname, cmd, roles, permissive, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3. Tables that have RLS on but NO policies (nobody can read them) or RLS off (everybody can)
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by policy_count, c.relname;

-- 4. Columns of every table (use this to write the baseline schema)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 5. Triggers and functions (profile-creation trigger, get_platform_stats, ...)
select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by 1, 2;

select p.proname as function_name, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;

-- 6. Table privileges granted to the anonymous (logged-out) role - should be minimal
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
order by 1, 2;

-- 7. Storage policies (avatars bucket)
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 8. Admin accounts (should only be people you expect)
select id, full_name, role from public.profiles where role = 'admin';
