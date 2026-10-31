-- ============================================================
-- Phase 0 - privilege hardening
-- Project: haycqbugzklclostauiy (AgriSmart)
-- Prepared: 2026-10-31 from the observed live state.
--
-- Scope (audit IDs):
--   H-1  over-broad table grants + permissive default ACLs
--   H-2  avatars bucket has no size/MIME limits
--   M-6  excess EXECUTE on helper/trigger functions
--
-- This migration is written against the exact live state. The
-- preflight aborts if policies, table ACLs, function ACLs,
-- default ACLs, sequences, ownership or the bucket have drifted,
-- so the companion rollback file stays exact.
--
-- Ordering is load-bearing: the four admin policies are narrowed
-- to `authenticated` BEFORE `anon` loses EXECUTE on is_admin().
-- Policy expressions are OR-ed, so an anonymous read of `articles`
-- would otherwise fail with "permission denied for function
-- is_admin". The policy expressions themselves are NOT changed.
--
-- Do NOT add BEGIN/COMMIT here when using `supabase db push` or
-- the MCP apply_migration tool; both wrap the file in a
-- transaction. If applying manually in the SQL editor, wrap the
-- whole file in BEGIN; ... COMMIT; instead.
--
-- DEFAULT ACL FACTS ESTABLISHED BY THE AUDIT
--   * pg_default_acl has 24 schema-specific rows and 0 global
--     (defaclnamespace = 0) rows.
--   * Permissive-to-anon/authenticated defaults exist for:
--       - postgres/public            (tables, sequences, functions)
--       - postgres/storage           (tables, sequences, functions)
--       - supabase_admin/public      (tables, sequences, functions)
--       - supabase_admin/graphql     (tables, sequences, functions)
--       - supabase_admin/graphql_public (tables, sequences, functions)
--   * supabase_admin/extensions, supabase_admin/realtime and
--     supabase_auth_admin/auth default ACLs only grant postgres
--     and/or dashboard_user, never anon/authenticated/PUBLIC.
--
-- NOT fixed by this file (documented residual limitations):
--   1. Default ACLs for role supabase_admin in schemas public,
--      graphql and graphql_public stay permissive. The MCP
--      connection runs as `postgres`, which is not a superuser
--      and is NOT a member of supabase_admin, so it cannot alter
--      those defaults. Objects created by supabase_admin in those
--      schemas will still be born with anon/authenticated/
--      service_role table privileges and function EXECUTE.
--   2. Default ACLs for role postgres in schema storage stay
--      permissive and are deliberately left unchanged; the app
--      does not create objects there, postgres has no CREATE on
--      storage, and Supabase Storage owns that schema.
--   3. service_role keeps its full existing privilege set.
--   4. realtime.subscription_id_seq keeps anon/authenticated
--      USAGE; it is owned by supabase_realtime_admin and is out
--      of scope for this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Preflight - exact-state assertions
-- ------------------------------------------------------------
do $$
declare
  v_problem text;
begin
  -- 0.1 The migration must run as the role that owns the objects,
  --     so that ALTER DEFAULT PRIVILEGES FOR ROLE postgres is valid
  --     and the REVOKE/GRANT statements apply to the intended owner.
  --     The MCP SQL session is `postgres`; applying this file will
  --     confirm the role used by apply_migration. If it is not
  --     postgres, the transaction aborts before any change.
  if current_user::text <> 'postgres' then
    raise exception 'Phase 0 preflight failed: expected role postgres, got %', current_user;
  end if;

  -- 0.2 The four admin policies must match the audited definitions:
  --     exact command, PERMISSIVE, role PUBLIC, USING is_admin(),
  --     and no WITH CHECK.
  select string_agg(format('%s.%s', e.tablename, e.policyname), ', ')
    into v_problem
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

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (admin policy drift): %', v_problem;
  end if;

  -- 0.3 No other policy in any schema may expose is_admin() to
  --     PUBLIC/anon. The four above are the only allowed ones; the
  --     two authenticated article policies are checked separately.
  select string_agg(format('%s.%s.%s', p.schemaname, p.tablename, p.policyname), ', ')
    into v_problem
  from pg_policies p
  where (coalesce(p.qual, '') ilike '%is_admin%' or coalesce(p.with_check, '') ilike '%is_admin%')
    and (p.roles::text like '%public%' or p.roles::text like '%anon%')
    and not (
      p.schemaname = 'public' and p.tablename = 'articles' and p.policyname in
        ('Admins can view all articles', 'Admins can update any article', 'Admins can delete any article')
    )
    and not (
      p.schemaname = 'public' and p.tablename = 'profiles' and p.policyname = 'Admins can view all profiles'
    );

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (unexpected is_admin() policy reachable by anon/PUBLIC): %', v_problem;
  end if;

  -- 0.4 The two authenticated article policies must match the exact
  --     audited expressions. This migration does not modify them;
  --     this check catches drift before anything runs.
  select string_agg(format('%s.%s', e.tablename, e.policyname), ', ')
    into v_problem
  from (values
    ('articles', 'Authenticated users can write articles', 'INSERT', 'PERMISSIVE', '{authenticated}',
      null,
      '((auth.uid()=author_id)AND((published=false)ORis_admin()))'),
    ('articles', 'Authors can update their own articles', 'UPDATE', 'PERMISSIVE', '{authenticated}',
      '(auth.uid()=author_id)',
      '((auth.uid()=author_id)AND((published=false)ORis_admin()))')
  ) as e(tablename, policyname, cmd, permissive, roles, qual_expr, wc_expr)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = e.tablename
   and p.policyname = e.policyname
  where p.policyname is null
     or p.cmd is distinct from e.cmd
     or p.permissive is distinct from e.permissive
     or p.roles::text is distinct from e.roles
     or (case when p.qual is null then null
              else regexp_replace(p.qual, '\s+', '', 'g') end) is distinct from e.qual_expr
     or (case when p.with_check is null then null
              else regexp_replace(p.with_check, '\s+', '', 'g') end) is distinct from e.wc_expr;

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (authenticated article policy drift): %', v_problem;
  end if;

  -- 0.5 is_admin() must currently be executable by anon and
  --     authenticated; otherwise the ordering rationale no longer
  --     applies and the migration should not silently continue.
  if not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'Phase 0 preflight failed: anon already lacks EXECUTE on is_admin()';
  end if;
  if not has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') then
    raise exception 'Phase 0 preflight failed: authenticated lacks EXECUTE on is_admin()';
  end if;

  -- 0.6 The public table set, ownership and ACLs must be exact.
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
    raise exception 'Phase 0 preflight failed (public table set drift): %', v_problem;
  end if;

  select string_agg(c.relname, ', ')
    into v_problem
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and pg_get_userbyid(c.relowner) <> 'postgres';

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (table owner drift): %', v_problem;
  end if;

  select string_agg(c.relname, ', ')
    into v_problem
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relacl::text is distinct from
      '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (table ACL drift): %', v_problem;
  end if;

  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and a.attacl is not null
  ) then
    raise exception 'Phase 0 preflight failed: column-level ACLs exist in public';
  end if;

  -- 0.7 The five functions must have the exact name set, the exact
  --     owner and the exact ACL set.
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
    raise exception 'Phase 0 preflight failed (public function set drift): %', v_problem;
  end if;

  select string_agg(p.proname, ', ')
    into v_problem
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_userbyid(p.proowner) <> 'postgres';

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (function owner drift): %', v_problem;
  end if;

  --     Compare the effective ACL set, not the array order. A
  --     rollback followed by a re-apply is semantically identical
  --     even though PostgreSQL may append re-granted items in a
  --     different position.
  with expected(fn, grantee) as (
    select f.fn, g.grantee
    from (values
      ('is_admin'),('get_platform_stats'),('handle_new_user'),
      ('protect_profile_role'),('rls_auto_enable')
    ) as f(fn)
    cross join (values
      ('PUBLIC'),('postgres'),('anon'),('authenticated'),('service_role')
    ) as g(grantee)
  ),
  actual as (
    select p.proname as fn,
           case when a.grantee = 0 then 'PUBLIC'
                else pg_get_userbyid(a.grantee)::text end as grantee
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
    where n.nspname = 'public'
      and p.proname in
        ('is_admin','get_platform_stats','handle_new_user','protect_profile_role','rls_auto_enable')
      and a.privilege_type = 'EXECUTE'
  )
  select string_agg(coalesce(e.fn, a.fn) || ':' || coalesce(e.grantee, a.grantee), ', ')
    into v_problem
  from expected e
  full join actual a on a.fn = e.fn and a.grantee = e.grantee
  where e.fn is null or a.fn is null;

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (function ACL drift): %', v_problem;
  end if;

  -- 0.8 Default ACLs must match the full audited inventory:
  --     0 global rows and exactly 24 schema-specific rows.
  --     This includes the postgres/storage, supabase_admin/public,
  --     supabase_admin/graphql and supabase_admin/graphql_public
  --     defaults that this migration deliberately leaves alone.
  if (select count(*) from pg_default_acl where defaclnamespace = 0) <> 0 then
    raise exception 'Phase 0 preflight failed: unexpected global default ACL entries';
  end if;

  if (select count(*) from pg_default_acl) <> 24 then
    raise exception 'Phase 0 preflight failed: expected 24 default ACL rows, found %',
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
    into v_problem
  from diff;

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (default ACL inventory drift): %', v_problem;
  end if;

  -- 0.9 The avatars bucket must be in the audited original state.
  if not exists (
    select 1
    from storage.buckets
    where id = 'avatars'
      and name = 'avatars'
      and public is true
      and file_size_limit is null
      and allowed_mime_types is null
  ) then
    raise exception 'Phase 0 preflight failed: avatars bucket is not in the audited original state';
  end if;

  -- 0.10 Sequence inventory and ACLs must match the audit exactly.
  --      There are no sequences in public. auth.refresh_tokens_id_seq
  --      grants nothing to anon/authenticated. realtime.subscription_id_seq
  --      grants USAGE to anon/authenticated and is out of scope.
  if exists (
    select 1 from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
  ) then
    raise exception 'Phase 0 preflight failed: unexpected sequence in public';
  end if;

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
    into v_problem
  from diff;

  if v_problem is not null then
    raise exception 'Phase 0 preflight failed (sequence inventory drift): %', v_problem;
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Break the policy -> is_admin() dependency
--    Expressions are unchanged; only the role list is narrowed.
-- ------------------------------------------------------------
alter policy "Admins can view all articles"
  on public.articles to authenticated;

alter policy "Admins can update any article"
  on public.articles to authenticated;

alter policy "Admins can delete any article"
  on public.articles to authenticated;

alter policy "Admins can view all profiles"
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 2. Function EXECUTE
-- ------------------------------------------------------------

-- Public homepage statistics: index.html -> js/home-stats.js calls
-- sb.rpc("get_platform_stats") while signed out. The function is
-- SECURITY DEFINER and returns aggregate counts only.
revoke all on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to anon, authenticated, service_role;

-- is_admin() is only needed by authenticated now that the four
-- policies above no longer run for anon. protect_profile_role()
-- calls it internally and is SECURITY DEFINER, so it executes as
-- its owner postgres.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Trigger / event-trigger functions are not invoked through
-- PostgREST. PostgreSQL does not check EXECUTE when firing a
-- trigger (the function runs as its owner for SECURITY DEFINER),
-- so these grants are unused attack surface.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.handle_new_user() to service_role;
grant execute on function public.protect_profile_role() to service_role;
grant execute on function public.rls_auto_enable() to service_role;

-- ------------------------------------------------------------
-- 3. Table privileges
-- ------------------------------------------------------------

-- Remove every public-schema table privilege from PUBLIC and from
-- the two browser-facing roles, then grant back only the surface
-- the current frontend actually uses. service_role is untouched.
revoke all on all tables in schema public from public, anon, authenticated;

-- Anonymous visitors read published articles only. RLS policy
-- "Anyone can view published articles" still filters the rows.
grant select on table public.articles to anon;

-- Signed-in article authors/admins: js/articles.js uses select,
-- insert, update and delete on articles.
grant select, insert, update, delete on table public.articles to authenticated;

-- The 11 tables below are used by the dashboard with select,
-- insert and delete only. No current frontend code calls update()
-- on them. Their UPDATE RLS policies remain in place for future
-- explicit grants, but the table privilege is withheld.
grant select, insert, delete on table
  public.farms,
  public.enterprises,
  public.crop_plots,
  public.livestock_animals,
  public.animal_feed_logs,
  public.animal_vaccinations,
  public.animal_health_records,
  public.animal_growth_records,
  public.transactions,
  public.market_prices,
  public.marketplace_listings
to authenticated;

-- js/notifications.js uses select, insert and update. The table's
-- DELETE RLS policy is not used by the current frontend, so DELETE
-- is withheld.
grant select, insert, update on table public.notifications to authenticated;

-- profiles has no INSERT or DELETE policy; rows are created by
-- handle_new_user() (SECURITY DEFINER) and updated by the owner.
grant select, update on table public.profiles to authenticated;

-- Read-only tables. species_templates and weather_cache are not
-- used by the current frontend, but SELECT preserves their
-- existing read paths.
grant select on table public.species_templates to authenticated;
grant select on table public.weather_cache to authenticated;

-- ------------------------------------------------------------
-- 4. Default privileges for future objects (role postgres only)
--    This is the root-cause fix for H-1: new objects created by
--    postgres in public are no longer born with anon/authenticated
--    privileges. New objects must be granted explicitly.
--    supabase_admin defaults are NOT changed (see header).
-- ------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Storage bucket limits
--    js/profile.js already restricts uploads to JPEG/PNG/WebP and
--    2 MB; this enforces the same rules server-side.
-- ------------------------------------------------------------
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
 where id = 'avatars';

-- ------------------------------------------------------------
-- 6. Post-checks - fail the transaction if the target state is
--    not reached.
-- ------------------------------------------------------------
do $$
declare
  v_bad text;
  v_limit bigint;
  v_mime text[];
  v_residual text;
begin
  -- 6.1 The four policies must now be authenticated-only with the
  --     same command/permissive/expression and still no WITH CHECK.
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
     or p.roles::text is distinct from '{authenticated}'
     or regexp_replace(coalesce(p.qual, ''), '\s+', '', 'g') is distinct from 'is_admin()'
     or p.with_check is not null;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (policy target not reached): %', v_bad;
  end if;

  -- 6.2 The two authenticated article policies must be untouched:
  --     exact cmd, permissive, role and expressions.
  select string_agg(format('%s.%s', e.tablename, e.policyname), ', ')
    into v_bad
  from (values
    ('articles', 'Authenticated users can write articles', 'INSERT', 'PERMISSIVE', '{authenticated}',
      null,
      '((auth.uid()=author_id)AND((published=false)ORis_admin()))'),
    ('articles', 'Authors can update their own articles', 'UPDATE', 'PERMISSIVE', '{authenticated}',
      '(auth.uid()=author_id)',
      '((auth.uid()=author_id)AND((published=false)ORis_admin()))')
  ) as e(tablename, policyname, cmd, permissive, roles, qual_expr, wc_expr)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = e.tablename
   and p.policyname = e.policyname
  where p.policyname is null
     or p.cmd is distinct from e.cmd
     or p.permissive is distinct from e.permissive
     or p.roles::text is distinct from e.roles
     or (case when p.qual is null then null
              else regexp_replace(p.qual, '\s+', '', 'g') end) is distinct from e.qual_expr
     or (case when p.with_check is null then null
              else regexp_replace(p.with_check, '\s+', '', 'g') end) is distinct from e.wc_expr;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (authenticated article policy changed): %', v_bad;
  end if;

  -- 6.3 anon must have no write or DDL privilege on any public table.
  select string_agg(format('%s(%s)', c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) as p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, p.priv);

  if v_bad is not null then
    raise exception 'Phase 0 check failed: anon retains write/DDL privileges: %', v_bad;
  end if;

  -- 6.4 anon must keep SELECT on articles and nothing else.
  select string_agg(c.relname, ', ')
    into v_bad
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relname <> 'articles'
    and has_table_privilege('anon', c.oid, 'SELECT');

  if v_bad is not null then
    raise exception 'Phase 0 check failed: anon can still SELECT: %', v_bad;
  end if;

  if not has_table_privilege('anon', 'public.articles', 'SELECT') then
    raise exception 'Phase 0 check failed: anon lost SELECT on public.articles';
  end if;

  -- 6.5 authenticated must have no TRUNCATE/REFERENCES/TRIGGER/
  --     MAINTAIN on any public table.
  select string_agg(format('%s(%s)', c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  cross join (values ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) as p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, p.priv);

  if v_bad is not null then
    raise exception 'Phase 0 check failed: authenticated retains DDL privileges: %', v_bad;
  end if;

  -- 6.6 The 11 select/insert/delete tables must have exactly that
  --     surface: SELECT/INSERT/DELETE true, UPDATE false.
  select string_agg(format('%s(%s)', c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  cross join (values
    ('SELECT', true),('INSERT', true),('DELETE', true),('UPDATE', false)
  ) as p(priv, expected)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relname in (
      'farms','enterprises','crop_plots','livestock_animals',
      'animal_feed_logs','animal_vaccinations','animal_health_records','animal_growth_records',
      'transactions','market_prices','marketplace_listings'
    )
    and has_table_privilege('authenticated', c.oid, p.priv) is distinct from p.expected;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (authenticated 11-table matrix): %', v_bad;
  end if;

  -- 6.7 articles: SELECT/INSERT/UPDATE/DELETE all true.
  select string_agg(p.priv, ', ')
    into v_bad
  from (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) as p(priv)
  where not has_table_privilege('authenticated', 'public.articles', p.priv);

  if v_bad is not null then
    raise exception 'Phase 0 check failed: authenticated missing articles privileges: %', v_bad;
  end if;

  -- 6.8 notifications: SELECT/INSERT/UPDATE true, DELETE false.
  select string_agg(p.priv, ', ')
    into v_bad
  from (values
    ('SELECT', true),('INSERT', true),('UPDATE', true),('DELETE', false)
  ) as p(priv, expected)
  where has_table_privilege('authenticated', 'public.notifications', p.priv) is distinct from p.expected;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (authenticated notifications matrix): %', v_bad;
  end if;

  -- 6.9 profiles: SELECT/UPDATE true, INSERT/DELETE false.
  select string_agg(p.priv, ', ')
    into v_bad
  from (values
    ('SELECT', true),('UPDATE', true),('INSERT', false),('DELETE', false)
  ) as p(priv, expected)
  where has_table_privilege('authenticated', 'public.profiles', p.priv) is distinct from p.expected;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (authenticated profiles matrix): %', v_bad;
  end if;

  -- 6.10 species_templates / weather_cache: SELECT true, writes false.
  select string_agg(format('%s(%s)', c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) as p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relname in ('species_templates','weather_cache')
    and has_table_privilege('authenticated', c.oid, p.priv) is distinct from (p.priv = 'SELECT');

  if v_bad is not null then
    raise exception 'Phase 0 check failed (authenticated read-only matrix): %', v_bad;
  end if;

  -- 6.11 PUBLIC must have no table privileges, and no unexpected
  --      grantee may remain in any public table ACL.
  select string_agg(c.relname, ', ')
    into v_bad
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and exists (
      select 1 from aclexplode(c.relacl) a where a.grantee = 0
    );

  if v_bad is not null then
    raise exception 'Phase 0 check failed: PUBLIC retains table privileges on: %', v_bad;
  end if;

  select string_agg(format('%s:%s', c.relname, pg_get_userbyid(a.grantee)), ', ')
    into v_bad
  from pg_class c
  cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and a.grantee <> 0
    and pg_get_userbyid(a.grantee) not in ('postgres','anon','authenticated','service_role');

  if v_bad is not null then
    raise exception 'Phase 0 check failed (unexpected table grantee): %', v_bad;
  end if;

  -- 6.12 service_role must keep the exact original table matrix.
  select string_agg(format('%s(%s)', c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  cross join (values
    ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
  ) as p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and not has_table_privilege('service_role', c.oid, p.priv);

  if v_bad is not null then
    raise exception 'Phase 0 check failed: service_role lost table privileges: %', v_bad;
  end if;

  -- 6.13 Exact function matrix for all five functions.
  select string_agg(format('%s:%s', e.fn, e.role), ', ')
    into v_bad
  from (values
    ('get_platform_stats',  'anon',          true),
    ('get_platform_stats',  'authenticated', true),
    ('get_platform_stats',  'service_role',  true),
    ('is_admin',            'anon',          false),
    ('is_admin',            'authenticated', true),
    ('is_admin',            'service_role',  true),
    ('handle_new_user',     'anon',          false),
    ('handle_new_user',     'authenticated', false),
    ('handle_new_user',     'service_role',  true),
    ('protect_profile_role','anon',          false),
    ('protect_profile_role','authenticated', false),
    ('protect_profile_role','service_role',  true),
    ('rls_auto_enable',     'anon',          false),
    ('rls_auto_enable',     'authenticated', false),
    ('rls_auto_enable',     'service_role',  true)
  ) as e(fn, role, expected)
  where has_function_privilege(e.role::name, format('public.%s()', e.fn), 'EXECUTE')
        is distinct from e.expected;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (function matrix): %', v_bad;
  end if;

  -- 6.13b Exact stored function ACL text, so no extra grantee of any
  --       kind can survive.
  select string_agg(format('%s=%s', p.proname, p.proacl::text), '; ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in
      ('is_admin','get_platform_stats','handle_new_user','protect_profile_role','rls_auto_enable')
    and p.proacl::text is distinct from case p.proname
      when 'get_platform_stats' then '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
      when 'is_admin' then '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
      else '{postgres=X/postgres,service_role=X/postgres}'
    end;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (function ACL not exact): %', v_bad;
  end if;

  -- 6.14 No PUBLIC EXECUTE may remain on any of the five functions
  --      (also covered by 6.13b, kept as an explicit assertion).
  select string_agg(p.proname, ', ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in
      ('is_admin','get_platform_stats','handle_new_user','protect_profile_role','rls_auto_enable')
    and (
      p.proacl is null
      or exists (
        select 1 from aclexplode(p.proacl) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
    );

  if v_bad is not null then
    raise exception 'Phase 0 check failed: PUBLIC EXECUTE remains on: %', v_bad;
  end if;

  -- 6.15 No sequence may appear in public. Across all other schemas,
  --      anon/authenticated must have no sequence privilege except
  --      the documented realtime residual. The full inventory must
  --      be byte-identical to the audit.
  if exists (
    select 1 from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
  ) then
    raise exception 'Phase 0 check failed: sequence appeared in public';
  end if;

  select string_agg(format('%s.%s(%s)', n.nspname, c.relname, p.priv), ', ')
    into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('USAGE'),('SELECT'),('UPDATE')) as p(priv)
  where c.relkind = 'S'
    and n.nspname <> 'realtime'
    and n.nspname not in ('pg_catalog','information_schema')
    and (
      has_sequence_privilege('anon', c.oid, p.priv)
      or has_sequence_privilege('authenticated', c.oid, p.priv)
    );

  if v_bad is not null then
    raise exception 'Phase 0 check failed: anon/authenticated retain sequence privileges: %', v_bad;
  end if;

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
    raise exception 'Phase 0 check failed (sequence inventory changed): %', v_bad;
  end if;

  select string_agg(format('%s.%s(%s)', n.nspname, c.relname, p.priv), ', ')
    into v_residual
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('USAGE'),('SELECT'),('UPDATE')) as p(priv)
  where c.relkind = 'S'
    and n.nspname = 'realtime'
    and (
      has_sequence_privilege('anon', c.oid, p.priv)
      or has_sequence_privilege('authenticated', c.oid, p.priv)
    );

  if v_residual is not null then
    raise warning 'Residual (out of scope, owned by supabase_realtime_admin): %', v_residual;
  end if;

  -- 6.16 postgres/public default ACLs must no longer grant anything
  --      to anon, authenticated or PUBLIC.
  select string_agg(format('%s/%s=%s', d.defaclobjtype, g.grantee_name, a.privilege_type), ', ')
    into v_bad
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  cross join lateral (
    select case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee_name
  ) g
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclnamespace = 'public'::regnamespace
    and g.grantee_name in ('anon','authenticated','PUBLIC');

  if v_bad is not null then
    raise exception 'Phase 0 check failed: postgres/public default ACL still grants: %', v_bad;
  end if;

  -- 6.17 postgres/public default ACLs must now be exactly the
  --      owner plus service_role.
  select string_agg(format('%s=%s', d.defaclobjtype, d.defaclacl::text), '; ')
    into v_bad
  from pg_default_acl d
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclnamespace = 'public'::regnamespace
    and d.defaclacl::text is distinct from case d.defaclobjtype
      when 'r' then '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
      when 'S' then '{postgres=rwU/postgres,service_role=rwU/postgres}'
      when 'f' then '{postgres=X/postgres,service_role=X/postgres}'
    end;

  if v_bad is not null then
    raise exception 'Phase 0 check failed (postgres/public default ACL not exact): %', v_bad;
  end if;

  if (select count(*)
      from pg_default_acl d
      where pg_get_userbyid(d.defaclrole) = 'postgres'
        and d.defaclnamespace = 'public'::regnamespace) <> 3 then
    raise exception 'Phase 0 check failed: expected exactly 3 postgres/public default ACL rows';
  end if;

  -- 6.18 The full default ACL inventory must still be 24 rows with
  --      0 global rows, and every row other than the three
  --      postgres/public rows must be byte-identical to the audit.
  if (select count(*) from pg_default_acl where defaclnamespace = 0) <> 0 then
    raise exception 'Phase 0 check failed: global default ACL entries appeared';
  end if;

  if (select count(*) from pg_default_acl) <> 24 then
    raise exception 'Phase 0 check failed: expected 24 default ACL rows, found %',
      (select count(*) from pg_default_acl);
  end if;

  with expected(owner_role, schema_scope, objtype, acl) as (values
    ('postgres','public','S','{postgres=rwU/postgres,service_role=rwU/postgres}'),
    ('postgres','public','f','{postgres=X/postgres,service_role=X/postgres}'),
    ('postgres','public','r','{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
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
    raise exception 'Phase 0 check failed (default ACL inventory changed): %', v_bad;
  end if;

  -- 6.19 Bucket limits and unchanged public flag.
  select file_size_limit, allowed_mime_types
    into v_limit, v_mime
  from storage.buckets
  where id = 'avatars';

  if v_limit is distinct from 2097152 then
    raise exception 'Phase 0 check failed: avatars file_size_limit is %', v_limit;
  end if;

  if v_mime is null
     or not (v_mime @> array['image/jpeg','image/png','image/webp']::text[])
     or not (v_mime <@ array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'Phase 0 check failed: avatars allowed_mime_types is %', v_mime;
  end if;

  if not exists (
    select 1 from storage.buckets where id = 'avatars' and public is true
  ) then
    raise exception 'Phase 0 check failed: avatars bucket is not public';
  end if;

  -- 6.20 Report, do not fail, the residual default ACLs that this
  --      migration cannot change. These are real, browser-reachable
  --      gaps for objects created by supabase_admin.
  select string_agg(format('%s/%s=%s', schema_scope, objtype, acl), '; ')
    into v_residual
  from (
    select coalesce(n.nspname, '(GLOBAL)')::text as schema_scope,
           d.defaclobjtype::text as objtype,
           d.defaclacl::text as acl
    from pg_default_acl d
    left join pg_namespace n on n.oid = d.defaclnamespace
    where pg_get_userbyid(d.defaclrole) = 'supabase_admin'
      and d.defaclnamespace in (
        'public'::regnamespace,
        'graphql'::regnamespace,
        'graphql_public'::regnamespace
      )
  ) r;

  if v_residual is not null then
    raise warning 'RESIDUAL LIMITATION: supabase_admin defaults still grant anon/authenticated (cannot be changed by postgres): %', v_residual;
  end if;

  select string_agg(format('%s=%s', d.defaclobjtype, d.defaclacl::text), '; ')
    into v_residual
  from pg_default_acl d
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclnamespace = 'storage'::regnamespace;

  if v_residual is not null then
    raise warning 'RESIDUAL LIMITATION: postgres/storage defaults are unchanged (postgres has no CREATE on storage): %', v_residual;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. Ask PostgREST to reload privileges
-- ------------------------------------------------------------
notify pgrst, 'reload schema';
