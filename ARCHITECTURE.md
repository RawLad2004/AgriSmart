# Architecture

```
Browser (static pages, vanilla JS)
   |-- supabase-js ------------------> Supabase: Auth, Postgres (RLS), Storage (avatars)
   `-- sb.functions.invoke("weather") -> Edge Function -> OpenWeatherMap (secret key, 30-min shared cache)
```

## Ownership chain (who can see what)
`farms.owner_id` -> `enterprises.farm_id` -> `crop_plots.enterprise_id` / `livestock_animals.enterprise_id`
-> `animal_*` record tables. `transactions.farm_id` -> farms. Marketplace/prices are public to signed-in users,
writable by their author. `notifications.user_id` is private to the user.

## Tables
profiles, farms, enterprises, crop_plots, livestock_animals, animal_feed_logs, animal_vaccinations,
animal_health_records, animal_growth_records, species_templates (unused), transactions, market_prices,
marketplace_listings, notifications, weather_cache, articles; RPC `get_platform_stats()`.
The core tables were created outside version control; `supabase/baseline/00000000_baseline.sql` now captures them
(reconstructed from the live database audit; untested on an empty project).

## Security model
- Row-Level Security is the real access control; the browser is untrusted.
- Output escaping: `js/security.js` (`escapeHtml`, `safeHttpUrl`, `safeCssUrl`).
- `profiles.role` can only be changed by an admin (trigger `protect_profile_role`).
- `weather_cache` is read-only for users; only the Edge Function writes it.
- Privilege hardening (`20261031120000_phase0_privilege_hardening.sql`, live): logged-out visitors can only SELECT
  `articles` (plus the `get_platform_stats()` function); signed-in users get only the table actions the app uses
  (e.g. no UPDATE on farms/crops/animals/transactions/listings/prices, no DELETE on notifications); helper and
  trigger functions are not callable from the browser; new objects created by `postgres` in `public` are no longer
  granted to anon/authenticated by default.
- **Rule for every new table (Phase 1 onwards):** create it, enable RLS, write policies, AND add explicit `grant`
  lines for the actions the app needs (e.g. `grant select, insert, update, delete on public.tasks to authenticated;`).
  Without the grants the app gets "permission denied". Add a test that another user cannot read the rows.
- Headers/CSP in `netlify.toml` (still allows inline scripts; to be tightened in Phase 1).

## Known gaps (tracked in docs/AGROVA_Master_Project_Prompt.md, section 4)
automated database tests run by hand in the SQL Editor (`supabase/tests/access_control_test.sql`), not yet in CI; admin page is empty; supabase-js is loaded
unpinned from a CDN; notifications are still generated in the browser; weather is looked up by county name.
