-- ============================================================
-- Phase 0 privilege hardening - EXACT ROLLBACK
-- Project: haycqbugzklclostauiy (AgriSmart)
-- Prepared: 2026-10-31
--
-- Restores the exact state observed live on 2026-10-30/31:
--   * four admin policies back to role PUBLIC, PERMISSIVE,
--     USING is_admin(), no WITH CHECK
--   * all 16 public tables: anon, authenticated and service_role
--     each have SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--     REFERENCES, TRIGGER, MAINTAIN
--   * all five functions: PUBLIC, postgres, anon, authenticated
--     and service_role have EXECUTE
--   * postgres/public default ACLs: tables arwdDxtm, sequences
--     rwU, functions X, to anon/authenticated/service_role
--   * avatars bucket: public = true, file_size_limit = NULL,
--     allowed_mime_types = NULL
--
-- The guard accepts a fully applied OR partially applied Phase 0
-- state (any Phase 0 signature is enough to proceed). It aborts
-- only when nothing from Phase 0 is present, or when the fixed
-- object set this file restores is not the expected one.
--
-- This file is intentionally OUTSIDE supabase/migrations/ so that
-- `supabase db push` cannot apply it.
--
-- Run manually only, as role postgres, after review. It is
-- wrapped in one transaction so a failure leaves nothing partial.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Guard: object set must be the audited one, and at least one
--    Phase 0 signature must be present. Any signature is enough,
--    so a partially applied migration can still be repaired.
-- ------------------------------------------------------------
do $$
declare
  v_applied boolean;
  v_problem text;
begin
  if current_user::text <> 'postgres' then
    raise exception 'Rollback aborted: must run as postgres, got %', current_user;
  end if;

  select string_agg(x.relname, ', ')
    into v_problem
  from (
    (select e.relname::text as relname
       from (values
         ('animal_feed_logs'),('animal_growth_records'),('animal_health_records'),
         ('animal_vaccinations'),('articles'),('crop_plots'),('enterprises'),
         ('farms'),('livestock_animals'),('market_prices'),('marketplace_listings'),
         ('notifications'),('profiles'),('species_templates'),('transactions'),
         ('weather_cache')
       ) as e(relname)
     except
     select c.relname::text
       from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind = 'r')
    union all
    (select c.relname::text
       from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     except
     select e.relname::text
       from (values
         ('animal_feed_logs'),('animal_growth_records'),('animal_health_records'),
         ('animal_vaccinations'),('articles'),('crop_plots'),('enterprises'),
         ('farms'),('livestock_animals'),('market_prices'),('marketplace_listings'),
         ('notifications'),('profiles'),('species_templates'),('transactions'),
         ('weather_cache')
       ) as e(relname))
  ) as x;

  if v_problem is not null then
    raise exception 'Rollback aborted: public table set differs from the audited set: %', v_problem;
  end if;

  select string_agg(x.proname, ', ')
    into v_problem
  from (
    (select e.proname::text as proname
       from (values
         ('get_platform_stats'),('handle_new_user'),('is_admin'),
         ('protect_profile_role'),('rls_auto_enable')
       ) as e(proname)
     except
     select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public')
    union all
    (select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
     except
     select e.proname::text
       from (values
         ('get_platform_stats'),('handle_new_user'),('is_admin'),
         ('protect_profile_role'),('rls_auto_enable')
       ) as e(proname))
  ) as x;

  if v_problem is not null then
    raise exception 'Rollback aborted: public function set differs from the audited set: %', v_problem;
  end if;

  select string_agg(format('%s.%s', e.tablename, e.policyname), ', ')
    into v_problem
  from (values
    ('articles', 'Admins can view all articles'),
    ('articles', 'Admins can update any article'),
    ('articles', 'Admins can delete any article'),
    ('profiles', 'Admins can view all profiles')
  ) as e(tablename, policyname)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.tablename
      and p.policyname = e.policyname
  );

  if v_problem is not null then
    raise exception 'Rollback aborted: missing audited policy/policies: %', v_problem;
  end if;

  select (
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'articles'
        and policyname in
          ('Admins can view all articles','Admins can update any article','Admins can delete any article')
        and roles::text = '{authenticated}'
    )
    or exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles'
        and policyname = 'Admins can view all profiles'
        and roles::text = '{authenticated}'
    )
    or not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
    or not has_table_privilege('anon', 'public.articles', 'INSERT')
    or exists (
      select 1 from storage.buckets
      where id = 'avatars'
        and (file_size_limit is not null or allowed_mime_types is not null)
    )
    or (
      select count(*)
      from pg_default_acl d
      where pg_get_userbyid(d.defaclrole) = 'postgres'
        and d.defaclnamespace = 'public'::regnamespace
        and d.defaclacl::text in (
          '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}',
          '{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}',
          '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
        )
    ) <> 3
  ) into v_applied;

  if not v_applied then
    raise exception 'Rollback aborted: no Phase 0 change detected; nothing to restore';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Restore the four admin policy roles. Expressions were never
--    changed by the forward migration.
-- ------------------------------------------------------------
alter policy "Admins can view all articles"
  on public.articles to public;

alter policy "Admins can update any article"
  on public.articles to public;

alter policy "Admins can delete any article"
  on public.articles to public;

alter policy "Admins can view all profiles"
  on public.profiles to public;

-- ------------------------------------------------------------
-- 2. Restore the exact table ACL: all eight privileges on all 16
--    tables for anon, authenticated and service_role.
--    Explicit privilege lists, not GRANT ALL. The ACL is rebuilt
--    from empty (owner entry untouched) so the stored array also
--    matches the original text.
-- ------------------------------------------------------------
revoke all on all tables in schema public from public, anon, authenticated, service_role;

grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.animal_feed_logs,
  public.animal_growth_records,
  public.animal_health_records,
  public.animal_vaccinations,
  public.articles,
  public.crop_plots,
  public.enterprises,
  public.farms,
  public.livestock_animals,
  public.market_prices,
  public.marketplace_listings,
  public.notifications,
  public.profiles,
  public.species_templates,
  public.transactions,
  public.weather_cache
to anon;

grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.animal_feed_logs,
  public.animal_growth_records,
  public.animal_health_records,
  public.animal_vaccinations,
  public.articles,
  public.crop_plots,
  public.enterprises,
  public.farms,
  public.livestock_animals,
  public.market_prices,
  public.marketplace_listings,
  public.notifications,
  public.profiles,
  public.species_templates,
  public.transactions,
  public.weather_cache
to authenticated;

grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.animal_feed_logs,
  public.animal_growth_records,
  public.animal_health_records,
  public.animal_vaccinations,
  public.articles,
  public.crop_plots,
  public.enterprises,
  public.farms,
  public.livestock_animals,
  public.market_prices,
  public.marketplace_listings,
  public.notifications,
  public.profiles,
  public.species_templates,
  public.transactions,
  public.weather_cache
to service_role;

-- ------------------------------------------------------------
-- 3. Restore the exact function ACL: PUBLIC plus the three
--    browser/server roles plus the explicit owner entry.
--    Revoke first so no Phase 0 subset or stray grantee remains;
--    the owner entry is never revoked.
-- ------------------------------------------------------------
revoke all on function public.get_platform_stats() from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.protect_profile_role() from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

grant execute on function public.get_platform_stats()
  to postgres, public, anon, authenticated, service_role;

grant execute on function public.is_admin()
  to postgres, public, anon, authenticated, service_role;

grant execute on function public.handle_new_user()
  to postgres, public, anon, authenticated, service_role;

grant execute on function public.protect_profile_role()
  to postgres, public, anon, authenticated, service_role;

grant execute on function public.rls_auto_enable()
  to postgres, public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Restore the exact postgres/public default ACLs.
--    Tables:  arwdDxtm  (SELECT, INSERT, UPDATE, DELETE,
--                         TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
--    Sequences: rwU     (SELECT, UPDATE, USAGE)
--    Functions: X       (EXECUTE), with NO PUBLIC entry
--    Rebuild from empty so the stored arrays match the original.
-- ------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete, truncate, references, trigger, maintain on tables
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, update, usage on sequences
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute on functions
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 5. Restore the exact avatars bucket values.
--    created_at, owner and updated_at were never changed by the
--    forward migration (no UPDATE trigger on these columns), so
--    they are left as-is.
-- ------------------------------------------------------------
update storage.buckets
   set public = true,
       file_size_limit = null,
       allowed_mime_types = null
 where id = 'avatars';

-- ------------------------------------------------------------
-- 6. Post-restore verification - fail before commit if the exact
--    audited state was not reached.
-- ------------------------------------------------------------
do $$
declare
  v_bad text;
  v_limit bigint;
  v_mime text[];
begin
  -- 6.1 Four policies: original role, command, permissive flag,
  --     expression and no WITH CHECK.
  select string_agg(format('%s.%s', e.tablename, e.policyname), ', ')
    into v_bad
  from (values
    ('articles', 'Admins can view all articles',   'SELECT'),
    ('articles', 'Admins can update any article',  'UPDATE'),
    ('articles', 'Admins can delete any article',  'DELETE'),
    ('profiles', 'Admins can view all profiles',   'SELECT')
  ) as e(tablename, policyname, cmd)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = e.tablename
   and p.policyname = e.policyname
  where p.policyname is null
     or p.cmd is distinct from e.cmd
     or p.permissive is distinct from 'PERMISSIVE'
     or p.roles::text is distinct from '{public}'
     or regexp_replace(coalesce(p.qual, ''), '\s+', '', 'g') is distinct from 'is_admin()'
     or p.with_check is not null;

  if v_bad is not null then
    raise exception 'Rollback verification failed (policy): %', v_bad;
  end if;

  -- 6.2 All 16 table ACLs must be byte-identical to the audit.
  select string_agg(c.relname, ', ')
    into v_bad
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relacl::text is distinct from
      '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';

  if v_bad is not null then
    raise exception 'Rollback verification failed (table ACL): %', v_bad;
  end if;

  select string_agg(c.relname, ', ')
    into v_bad
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and pg_get_userbyid(c.relowner) <> 'postgres';

  if v_bad is not null then
    raise exception 'Rollback verification failed (table owner): %', v_bad;
  end if;

  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and a.attacl is not null
  ) then
    raise exception 'Rollback verification failed: column-level ACLs exist in public';
  end if;

  -- 6.3 All five function ACLs must be byte-identical to the audit.
  select string_agg(format('%s=%s', p.proname, p.proacl::text), '; ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in
      ('is_admin','get_platform_stats','handle_new_user','protect_profile_role','rls_auto_enable')
    and p.proacl::text is distinct from
      '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}';

  if v_bad is not null then
    raise exception 'Rollback verification failed (function ACL): %', v_bad;
  end if;

  select string_agg(p.proname, ', ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_userbyid(p.proowner) <> 'postgres';

  if v_bad is not null then
    raise exception 'Rollback verification failed (function owner): %', v_bad;
  end if;

  -- 6.4 Default ACLs: exactly 24 schema-specific rows, 0 global,
  --     and byte-identical to the original inventory.
  if (select count(*) from pg_default_acl where defaclnamespace = 0) <> 0 then
    raise exception 'Rollback verification failed: global default ACL entries exist';
  end if;

  if (select count(*) from pg_default_acl) <> 24 then
    raise exception 'Rollback verification failed: expected 24 default ACL rows, found %',
      (select count(*) from pg_default_acl);
  end if;

  with expected(owner_role, schema_scope, objtype, acl) as (values
    ('postgres','public','S','{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}'),
    ('postgres','public','f','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('postgres','public','r','{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('postgres','storage','S','{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}'),
    ('postgres','storage','f','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('postgres','storage','r','{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('supabase_admin','extensions','S','{postgres=r*w*U*/supabase_admin}'),
    ('supabase_admin','extensions','f','{postgres=X*/supabase_admin}'),
    ('supabase_admin','extensions','r','{postgres=a*r*w*d*D*x*t*m*/supabase_admin}'),
    ('supabase_admin','graphql','S','{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}'),
    ('supabase_admin','graphql','f','{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}'),
    ('supabase_admin','graphql','r','{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}'),
    ('supabase_admin','graphql_public','S','{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}'),
    ('supabase_admin','graphql_public','f','{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}'),
    ('supabase_admin','graphql_public','r','{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}'),
    ('supabase_admin','public','S','{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}'),
    ('supabase_admin','public','f','{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}'),
    ('supabase_admin','public','r','{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}'),
    ('supabase_admin','realtime','S','{postgres=rwU/supabase_admin,dashboard_user=rwU/supabase_admin}'),
    ('supabase_admin','realtime','f','{postgres=X/supabase_admin,dashboard_user=X/supabase_admin}'),
    ('supabase_admin','realtime','r','{postgres=a*r*wdDxtm/supabase_admin,dashboard_user=arwdDxtm/supabase_admin}'),
    ('supabase_auth_admin','auth','S','{postgres=rwU/supabase_auth_admin,dashboard_user=rwU/supabase_auth_admin}'),
    ('supabase_auth_admin','auth','f','{postgres=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}'),
    ('supabase_auth_admin','auth','r','{postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}')
  ),
  actual as (
    select pg_get_userbyid(d.defaclrole)::text as owner_role,
           coalesce(n.nspname, '(GLOBAL)')::text as schema_scope,
           d.defaclobjtype::text as objtype,
           d.defaclacl::text as acl
    from pg_default_acl d
    left join pg_namespace n on n.oid = d.defaclnamespace
  ),
  diff as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select string_agg(format('%s/%s/%s=%s', owner_role, schema_scope, objtype, acl), '; ')
    into v_bad
  from diff;

  if v_bad is not null then
    raise exception 'Rollback verification failed (default ACL): %', v_bad;
  end if;

  -- 6.5 Bucket restored exactly on the fields Phase 0 changed.
  select file_size_limit, allowed_mime_types
    into v_limit, v_mime
  from storage.buckets
  where id = 'avatars';

  if v_limit is not null then
    raise exception 'Rollback verification failed: avatars file_size_limit is %', v_limit;
  end if;

  if v_mime is not null then
    raise exception 'Rollback verification failed: avatars allowed_mime_types is %', v_mime;
  end if;

  if not exists (
    select 1 from storage.buckets where id = 'avatars' and name = 'avatars' and public is true
  ) then
    raise exception 'Rollback verification failed: avatars bucket public flag/name changed';
  end if;

  -- 6.6 Sequence inventory/ACLs were not touched by Phase 0 and
  --     must still match the audit exactly.
  with expected(schema_name, seq_name, owner_role, acl) as (values
    ('auth','refresh_tokens_id_seq','supabase_auth_admin',
     '{supabase_auth_admin=rwU/supabase_auth_admin,dashboard_user=rwU/supabase_auth_admin,postgres=rwU/supabase_auth_admin}'),
    ('realtime','subscription_id_seq','supabase_realtime_admin',
     '{supabase_realtime_admin=rwU/supabase_realtime_admin,postgres=rwU/supabase_realtime_admin,dashboard_user=rwU/supabase_realtime_admin,anon=U/supabase_realtime_admin,authenticated=U/supabase_realtime_admin,service_role=U/supabase_realtime_admin}')
  ),
  actual as (
    select n.nspname::text as schema_name,
           c.relname::text as seq_name,
           pg_get_userbyid(c.relowner)::text as owner_role,
           c.relacl::text as acl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S'
      and n.nspname not in ('pg_catalog','information_schema')
  ),
  diff as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select string_agg(format('%s.%s=%s', schema_name, seq_name, acl), '; ')
    into v_bad
  from diff;

  if v_bad is not null then
    raise exception 'Rollback verification failed (sequence inventory): %', v_bad;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. Ask PostgREST to reload the restored privileges.
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
