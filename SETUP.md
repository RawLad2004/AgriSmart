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

## 5. Database
1. Run `supabase/audit.sql` block by block in the SQL Editor and save the results (needed to write the baseline
   migration `00000000_baseline.sql` - or run `supabase db dump --schema public > baseline.sql`).
2. Apply migrations in order (SQL Editor or `supabase db push`):
   - `20260725_01_profile_fields.sql`
   - `20260725_02_animal_records.sql`
   - `20260729_01_phase0_hardening.sql` (after the weather function is deployed)

## 6. Verify (manual checklist)
- Sign up with email confirmation on/off: county ends up on the profile after first login.
- Forgot password > email > reset page > new password > login.
- Weather page loads for a farm that has a county; the browser Network tab shows NO `appid=` / API key.
- Try `<img src=x onerror=alert(1)>` as a farm name, listing description and article body: it must show as text.
- As a normal user, try to set your own profile role to `admin` (browser console: update on `profiles`): must fail.
- Upload a `.svg` or 5 MB image as avatar: must be refused.

## 7. Deploy
Netlify serves the folder as-is; `netlify.toml` adds the security headers.
