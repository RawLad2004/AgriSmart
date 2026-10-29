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
The first ten base tables were created outside version control; the baseline migration (Phase 0, task 3)
will capture them.

## Security model
- Row-Level Security is the real access control; the browser is untrusted.
- Output escaping: `js/security.js` (`escapeHtml`, `safeHttpUrl`, `safeCssUrl`).
- `profiles.role` can only be changed by an admin (trigger `protect_profile_role`).
- `weather_cache` is read-only for users; only the Edge Function writes it.
- Headers/CSP in `netlify.toml` (still allows inline scripts; to be tightened in Phase 1).

## Known gaps (tracked in docs/AGROVA_Master_Project_Prompt.md, section 4)
Baseline schema and RLS audit pending; no RLS integration tests yet; admin page is empty; supabase-js is loaded
unpinned from a CDN; notifications are still generated in the browser; weather is looked up by county name.
