# Setup notes for this update

## 1. Run the new database migrations
In the Supabase Dashboard → SQL Editor, run these two files **in order** against your project
(they're also valid as CLI migrations if you use the Supabase CLI):

1. `supabase/migrations/20260725_01_profile_fields.sql` — adds `phone_number`, `avatar_url`,
   `preferred_units` to `profiles`, and creates the public `avatars` storage bucket + policies.
2. `supabase/migrations/20260725_02_animal_records.sql` — creates `animal_feed_logs`,
   `animal_vaccinations`, `animal_health_records`, `animal_growth_records`, and the reference
   table `species_templates`, all with RLS scoped through the existing
   `farms.owner_id → enterprises.farm_id → livestock_animals.enterprise_id` ownership chain.

Both are idempotent (`if not exists` / `drop policy if exists`), so re-running them is safe.

## 2. Rotate exposed keys before going further
`js/config.js` (OpenWeatherMap key) and `js/supabase-client.js` (Supabase URL/anon key) had
live-looking values committed in the copy this was built from. `js/config.js` is meant to be
git-ignored — double check it actually is in your real deploy, and rotate the OpenWeatherMap key
if this exact archive has been shared anywhere. The Supabase anon key being public is normal
*only* if RLS is locked down on every table (the new tables are; audit the older ones too).

## 3. Auth redirect URLs
Supabase needs `.../auth/reset-password.html` allow-listed under
**Authentication → URL Configuration → Redirect URLs** for the forgot-password email link to
work, both for your local/dev URL and your deployed (Netlify) URL.

## 4. What to click through to verify
- Login page → "Forgot password?" → submit an email → check inbox → land on
  `reset-password.html` → set new password → redirected to login.
- Sign up a new account → should land on `dashboard/profile.html` with a "complete your
  profile" banner (since county isn't set until you fill the form — weather depends on it).
- Any dashboard page → click your name/avatar in the topbar → goes to Profile → upload a
  photo → avatar should update immediately across the topbar.
- Livestock → open an enterprise → Add Animal → "Browse" next to Species → pick a breed →
  fields auto-fill → save → click "Records" on that animal → walk through all four tabs
  (Feed, Vaccinations, Health, Growth) → add one of each → confirm the list, delete, and
  (for a vaccination with a past due date) confirm a notification appears in the bell.
- Weather page → pick a farm → confirm the "Recommended For This Week's Weather" panel
  appears below the forecast → click a card → confirms it jumps into Market's marketplace
  tab with the search box pre-filled, and opens the want-ad form if nothing matched.

## 5. Left out of scope (flagged, not built)
- `js/admin.js` is still an empty stub — `dashboard/admin.html` has markup but no analytics/
  moderation logic behind it yet.
- `species_templates` table was created for future use but isn't read by the app yet — the
  species picker currently uses the static `js/species-catalog.js` data as originally scoped.
