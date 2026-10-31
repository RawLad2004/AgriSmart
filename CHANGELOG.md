# Changelog

## Phase 0 - Stabilise and secure (in progress)
- 0.1 Repo hygiene: images 15 MB -> 0.5 MB (WebP), missing favicons, .editorconfig, stricter .gitignore, .env.example.
- 0.2 XSS hardening: shared escaping helpers applied across ~140 render sites; article bodies rendered as text;
  URL validation; Netlify security headers and CSP.
- 0.3 Fixes: signup county no longer lost; removed missing script references; avatar validation; form validation;
  duplicate-notification handling.
- 0.4 Weather moved to a server-side Edge Function (API key removed from the browser); hardening migration
  (role protection, CHECK constraints, weather_cache lock, notification dedupe); audit queries.
- 0.5 Tooling and docs: tests (`npm test`), ESLint/Prettier config, CI workflow, README/SETUP/ARCHITECTURE.

- 0.8 (applied live 2026-10-31) Privilege hardening migration and exact rollback (`supabase/rollback/`); login now returns
  users to the page they asked for (`?next=` validated: same-origin dashboard pages only); admin page guard and
  role-aware Admin sidebar link; livestock page made resilient to missing elements; public nav links point to the
  dashboard pages.

- 0.9 Phase 0 closed: database access-control tests (`supabase/tests/access_control_test.sql`) and an admin
  "Pending articles" list (read, publish or delete users' drafts).

### Audit findings (2026-10-30, from the live Supabase project)
- All 16 public tables have RLS enabled; ownership policies for farms, enterprises, plots, animals, animal records,
  transactions, listings, prices and notifications are correct.
- CONFIRMED issue: `weather_cache` allowed any signed-in user to insert/update (fixed in hardening migration, section D).
- CONFIRMED issue: users can update their own `profiles` row with no column limit, so `role` could be set to `admin`
  (fixed by the `protect_profile_role` trigger, section B).
- DECISION NEEDED: any signed-in user can publish public articles (optional migration 20260729_02).
- `is_admin()` already exists in the database; the hardening migration no longer redefines it.
- Also found: `articles.published` defaulted to true (now false in migration 02); SECURITY DEFINER functions had no
  pinned search_path (fixed, section F); the signup trigger dropped the county (fixed, section G); the client-side
  profile INSERT policy was unnecessary (removed, section H). Avatar storage rules are folder-scoped and correct;
  set bucket MIME/size limits in the dashboard (see SETUP.md).
- Article form: non-admins can only save drafts; published articles can only be edited by admins.
- Baseline schema reconstructed from the audit into `supabase/baseline/00000000_baseline.sql` (for new dev/staging projects).
- A short-lived repair migration for `is_admin()` grants was withdrawn: it would undo the later privilege hardening
  (`20261031120000_phase0_privilege_hardening.sql`), which supersedes it.
- Noted for Phase 1: `profiles` has both `phone` and `phone_number` columns (duplicate); `farms` already has `lat`/`lng`.
