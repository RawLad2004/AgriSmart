-- ==========================================================
-- ACCESS-CONTROL TESTS  (run in the Supabase SQL Editor)
--
-- Proves, against the REAL database rules, that:
--   * one signed-in user cannot read or change another user's data
--   * a user cannot make themselves an admin or publish articles
--   * logged-out visitors can only read published articles
--   * admins can review and publish drafts, but still can't read other users' farms
--
-- SAFE TO RUN: everything happens inside ONE statement that always ends with an
-- intentional error, so the database rolls back and NOTHING is saved
-- (the temporary test users and data disappear).
--
-- HOW TO READ THE RESULT
--   "ALL ACCESS TESTS PASSED (N checks)"  -> success (it is shown as an error ON PURPOSE)
--   "FAIL: ..."                           -> a protection is missing; send me the message
--   any other error                       -> the test setup hit a snag; send me the message
-- Re-run this file after EVERY migration or policy change.
-- ==========================================================

do $$
declare
  v_a        uuid := gen_random_uuid();   -- user A: ordinary at first, promoted to admin later
  v_b        uuid := gen_random_uuid();   -- user B: ordinary user
  v_farm_a   uuid;
  v_ent_a    uuid;
  v_art_a    uuid;                        -- A's draft article
  v_art_b    uuid;                        -- B's draft article
  v_pub      uuid;                        -- a published article
  v_n        int;
  v_s        text;
  v_txt      text;
  v_checks   int := 0;
  v_none     text[];
  v_denied   text[];
begin
  -- -------- setup (runs as the database owner) --------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'test-a-' || v_a || '@example.invalid', '{"full_name":"Test A","county":"Nakuru"}', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'test-b-' || v_b || '@example.invalid', '{"full_name":"Test B"}', now(), now());

  select count(*) into v_n from public.profiles where id in (v_a, v_b);
  if v_n <> 2 then raise exception 'FAIL: the signup trigger did not create both profiles (got %)', v_n; end if;

  select county into v_txt from public.profiles where id = v_a;
  if v_txt is distinct from 'Nakuru' then raise exception 'FAIL: signup did not save the county (got %)', v_txt; end if;
  v_checks := v_checks + 2;

  insert into public.farms (owner_id, name, county) values (v_a, 'Test Farm A', 'Nakuru') returning id into v_farm_a;
  insert into public.enterprises (farm_id, type, name) values (v_farm_a, 'crop', 'Maize') returning id into v_ent_a;
  insert into public.crop_plots (enterprise_id, crop_name) values (v_ent_a, 'Maize plot');
  insert into public.transactions (farm_id, type, category, amount) values (v_farm_a, 'income', 'Sales', 100);
  insert into public.notifications (user_id, title) values (v_a, 'Private to A');
  insert into public.articles (author_id, title, slug, body, published)
    values (v_a, 'A draft', 'test-a-draft-' || v_a, 'draft body', false) returning id into v_art_a;
  insert into public.articles (author_id, title, slug, body, published)
    values (v_b, 'B draft', 'test-b-draft-' || v_b, 'draft body', false) returning id into v_art_b;
  insert into public.articles (author_id, title, slug, body, published)
    values (v_a, 'Published', 'test-pub-' || v_a, 'public body', true) returning id into v_pub;

  -- ==========================================================
  -- 1. USER B (an ordinary signed-in user)
  -- ==========================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  -- 1a. B must not SEE any of A's private data
  v_none := array[
    format('select count(*) from public.farms where id = %L', v_farm_a),
    format('select count(*) from public.enterprises where id = %L', v_ent_a),
    format('select count(*) from public.crop_plots where enterprise_id = %L', v_ent_a),
    format('select count(*) from public.transactions where farm_id = %L', v_farm_a),
    format('select count(*) from public.notifications where user_id = %L', v_a),
    format('select count(*) from public.profiles where id = %L', v_a),
    format('select count(*) from public.articles where id = %L', v_art_a)
  ];
  foreach v_s in array v_none loop
    begin
      execute v_s into v_n;
      if v_n <> 0 then raise exception 'FAIL: user B can see another user''s data: %', v_s; end if;
    exception when insufficient_privilege then null;
    end;
    v_checks := v_checks + 1;
  end loop;

  -- 1b. B must not CHANGE A's data, create rows under A, become admin, or publish
  v_denied := array[
    format('update public.farms set name = ''hacked'' where id = %L', v_farm_a),
    format('delete from public.farms where id = %L', v_farm_a),
    format('insert into public.farms (owner_id, name) values (%L, ''x'')', v_a),
    format('insert into public.enterprises (farm_id, type, name) values (%L, ''crop'', ''x'')', v_farm_a),
    format('insert into public.crop_plots (enterprise_id, crop_name) values (%L, ''x'')', v_ent_a),
    format('insert into public.transactions (farm_id, type, category, amount) values (%L, ''income'', ''x'', 1)', v_farm_a),
    format('insert into public.notifications (user_id, title) values (%L, ''x'')', v_a),
    format('delete from public.notifications where user_id = %L', v_a),
    format('update public.profiles set full_name = ''hacked'' where id = %L', v_a),
    format('update public.profiles set role = ''admin'' where id = %L', v_b),
    format('update public.profiles set role = ''admin'' where id = %L', v_a),
    format('insert into public.profiles (id) values (%L)', v_b),
    format('insert into public.articles (author_id, title, slug, body, published) values (%L, ''p'', ''test-x-'' || %L, ''b'', true)', v_b, v_b),
    format('update public.articles set published = true where id = %L', v_art_b),
    format('update public.articles set title = ''hacked'' where id = %L', v_pub),
    'insert into public.weather_cache (location_key, payload) values (''test-x'', ''{}''::jsonb)',
    'update public.weather_cache set payload = ''{}''::jsonb'
  ];
  foreach v_s in array v_denied loop
    begin
      execute v_s;
      get diagnostics v_n = row_count;
      if v_n > 0 then raise exception 'FAIL: user B was allowed to run: %', v_s; end if;
    exception when insufficient_privilege then null;
    end;
    v_checks := v_checks + 1;
  end loop;

  select role into v_txt from public.profiles where id = v_b;
  if v_txt is distinct from 'farmer' then raise exception 'FAIL: user B role changed to %', v_txt; end if;
  v_checks := v_checks + 1;

  -- 1c. B CAN do the normal things
  insert into public.farms (owner_id, name) values (v_b, 'Test Farm B');
  select count(*) into v_n from public.farms where owner_id = v_b;
  if v_n <> 1 then raise exception 'FAIL: user B cannot create/read their own farm'; end if;
  select count(*) into v_n from public.articles where id = v_art_b;
  if v_n <> 1 then raise exception 'FAIL: user B cannot read their own draft'; end if;
  select count(*) into v_n from public.articles where id = v_pub;
  if v_n <> 1 then raise exception 'FAIL: user B cannot read a published article'; end if;
  select count(*) into v_n from public.weather_cache;   -- must not error
  v_checks := v_checks + 4;

  -- ==========================================================
  -- 2. LOGGED-OUT VISITOR (anon)
  -- ==========================================================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  reset role;
  set local role anon;

  v_none := array[
    'select count(*) from public.farms',
    'select count(*) from public.enterprises',
    'select count(*) from public.crop_plots',
    'select count(*) from public.transactions',
    'select count(*) from public.notifications',
    'select count(*) from public.profiles',
    'select count(*) from public.marketplace_listings',
    'select count(*) from public.market_prices',
    'select count(*) from public.livestock_animals',
    'select count(*) from public.weather_cache',
    'select count(*) from public.articles where published = false'
  ];
  foreach v_s in array v_none loop
    begin
      execute v_s into v_n;
      if v_n <> 0 then raise exception 'FAIL: a logged-out visitor can read: %', v_s; end if;
    exception when insufficient_privilege then null;
    end;
    v_checks := v_checks + 1;
  end loop;

  v_denied := array[
    format('insert into public.articles (author_id, title, slug, body, published) values (%L, ''p'', ''test-anon'', ''b'', true)', v_a),
    format('insert into public.farms (owner_id, name) values (%L, ''x'')', v_a),
    format('update public.articles set title = ''hacked'' where id = %L', v_pub),
    format('delete from public.articles where id = %L', v_pub),
    'select public.is_admin()'
  ];
  foreach v_s in array v_denied loop
    begin
      execute v_s;
      get diagnostics v_n = row_count;
      if v_n > 0 then raise exception 'FAIL: a logged-out visitor was allowed to run: %', v_s; end if;
      if v_s like 'select public.is_admin()%' then
        raise exception 'FAIL: a logged-out visitor can run is_admin()';
      end if;
    exception when insufficient_privilege then null;
    end;
    v_checks := v_checks + 1;
  end loop;

  select count(*) into v_n from public.articles where id = v_pub;
  if v_n <> 1 then raise exception 'FAIL: logged-out visitors cannot read published articles'; end if;
  select count(*) into v_n from public.get_platform_stats();
  if v_n <> 1 then raise exception 'FAIL: public homepage statistics are not available to visitors'; end if;
  v_checks := v_checks + 2;

  -- ==========================================================
  -- 3. ADMIN (promote A as the database owner, then act as A)
  -- ==========================================================
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  update public.profiles set role = 'admin' where id = v_a;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_n from public.articles where id = v_art_b;
  if v_n <> 1 then raise exception 'FAIL: an admin cannot see another user''s draft'; end if;
  select count(*) into v_n from public.profiles where id = v_b;
  if v_n <> 1 then raise exception 'FAIL: an admin cannot see other profiles'; end if;

  update public.articles set published = true where id = v_art_b;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: an admin cannot publish an article'; end if;

  -- admins are NOT supposed to read other people's farm data
  select count(*) into v_n from public.farms where owner_id = v_b;
  if v_n <> 0 then raise exception 'FAIL: an admin can read another user''s farms'; end if;
  select count(*) into v_n from public.notifications where user_id = v_b;
  if v_n <> 0 then raise exception 'FAIL: an admin can read another user''s notifications'; end if;
  v_checks := v_checks + 5;

  -- the article an admin just published is now visible to visitors
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  set local role anon;
  select count(*) into v_n from public.articles where id = v_art_b;
  if v_n <> 1 then raise exception 'FAIL: a published article is not visible to visitors'; end if;
  v_checks := v_checks + 1;

  -- ==========================================================
  -- 4. CONFIGURATION CHECKS (as the database owner)
  -- ==========================================================
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);

  if has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'FAIL: anon can execute is_admin()';
  end if;
  if has_table_privilege('anon', 'public.farms', 'SELECT') then
    raise exception 'FAIL: anon has SELECT on farms';
  end if;
  select count(*) into v_n from pg_policies
    where schemaname = 'public' and tablename = 'weather_cache' and cmd <> 'SELECT';
  if v_n <> 0 then raise exception 'FAIL: weather_cache has write policies'; end if;
  if not exists (select 1 from storage.buckets
                 where id = 'avatars' and file_size_limit = 2097152
                   and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'FAIL: the avatars bucket limits are not set';
  end if;
  select count(*) into v_n from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity;
  if v_n <> 0 then raise exception 'FAIL: % public table(s) have row-level security switched off', v_n; end if;
  v_checks := v_checks + 5;

  -- Always finish with an error so that NOTHING above is ever saved.
  raise exception 'ALL ACCESS TESTS PASSED (% checks). This message is shown as an error on purpose: it rolls back the temporary test data.', v_checks;
end $$;
