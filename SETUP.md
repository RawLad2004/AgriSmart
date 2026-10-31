# Setup guide

## 1. Install tools
Git, Node.js (LTS), and the Supabase CLI (`npm i -g supabase` or see supabase.com/docs/guides/cli).
In VS Code install the extensions recommended in `.vscode/extensions.json`.

## 2. Get the code running
```bash
npm install
npm test            # should show all tests passing
```
Open `index.html` with **Live Server** (right-click > Open with Live Server).

## 3. Supabase project
1. In the Supabase dashboard open **Project Settings > API** and copy the project URL and anon key into
   `js/supabase-client.js`. (The anon key is public by design, so it is only safe when Row-Level Security is
   correct on every table - see step 5.)
2. **Authentication > URL Configuration > Redirect URLs**: add `.../auth/reset-password.html` for both your local
   URL and your deployed Netlify URL (needed for "forgot password").
3. Decide whether **Confirm email** is on (Authentication > Providers > Email). The app handles both.

## 4. Rotate the exposed weather key (do this first)
The OpenWeatherMap key used to be shipped to the browser, so treat the old key as public:
1. Create a new key at openweathermap.org and delete the old one.
2. Deploy the server-side proxy:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENWEATHER_API_KEY=your-new-key
supabase functions deploy weather
```
3. Do NOT put the new key in any file in this repo. `js/config.js` no longer exists.

**No command line? Use the dashboard instead:** Supabase dashboard > **Edge Functions** > **Deploy a new function** >
**Via Editor**. Name it exactly `weather`, paste the full contents of `supabase/functions/weather/index.ts`, and deploy.
Then open the Edge Functions **Secrets** page and add `OPENWEATHER_API_KEY` with your new key. (New OpenWeatherMap keys
can take up to a couple of hours to start working.)

## 5. Database
1. `supabase/baseline/00000000_baseline.sql` recreates the original schema on a NEW empty project (e.g. a dev
   project). Do not run it on your existing project. See the header of that file for the exact order.
   `supabase/audit.sql` re-checks tables, policies and functions at any time.
2. The avatars bucket limits (JPG/PNG/WebP, 2 MB) are applied by `20261031120000_phase0_privilege_hardening.sql`
   (step 3 below), so no manual bucket step is needed.
3. Apply migrations in order (SQL Editor or `supabase db push`):
   - `20260725_01_profile_fields.sql`
   - `20260725_02_animal_records.sql`
   - `20260729_01_phase0_hardening.sql` (after the weather function is deployed)
   - `20260729_02_articles_publish_admin_only.sql` (only admins can publish articles)
   - `20261031120000_phase0_privilege_hardening.sql` (table/function permissions, bucket limits). Its first section
     asserts the exact state of the original project and aborts if anything differs, so on a NEW project it may stop
     at that check; that is expected, ask for an adapted version. Its exact undo is in `supabase/rollback/`
     (never applied by `supabase db push`).

## 6. Verify (manual checklist)
- Sign up with email confirmation on/off: county ends up on the profile after first login.
- Forgot password > email > reset page > new password > login.
- Weather page loads for a farm that has a county; the browser Network tab shows NO `appid=` / API key.
- Try `<img src=x onerror=alert(1)>` as a farm name, listing description and article body: it must show as text.
- As a normal user, try to set your own profile role to `admin` (browser console: update on `profiles`): must fail.
- Upload a `.svg` or 5 MB image as avatar: must be refused.

## 7. Access-control tests (re-run after every migration or policy change)
Open `supabase/tests/access_control_test.sql`, paste it into the Supabase SQL Editor and run it. It creates two
temporary users, tries to break the rules (read someone else's farm, become admin, publish an article, write the
weather cache, read data while logged out) and then rolls everything back, so nothing is saved.
A result that starts with **ALL ACCESS TESTS PASSED** is a success (it is shown as an error on purpose).
A message starting with **FAIL:** means a protection is missing.

## 8. Deploy
Netlify serves the folder as-is; `netlify.toml` adds the security headers.
