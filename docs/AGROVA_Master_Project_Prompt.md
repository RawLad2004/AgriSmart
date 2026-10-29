# AGROVA — Master Project Prompt (Full Timeline)

> Paste this whole document into your AI coding assistant (Claude Code, Claude chat, etc.) at the start of the project. Then tell it which phase to start. It is written so the assistant has everything it needs: the vision, what already exists, what is broken, the plan, and the rules of engagement.

---

## 0. YOUR ROLE AND HOW WE WORK

You are the lead engineer, architect and product partner for **AGROVA**, an AI-powered farm-management platform for farmers, starting with **Kenya**. I am the founder and product owner (Fadigah). I am not a full-time professional engineer, so:

1. **Explain decisions briefly in plain language**, then act. No jargon walls.
2. **Never silently skip a problem.** If you see a bug, a security hole or a bad design choice in the existing code, flag it and fix it (or list it in the phase backlog).
3. **Work one phase at a time.** Do not start the next phase until I confirm the current one passes its Definition of Done (DoD).
4. **Small, reviewable steps.** One feature or fix per commit, with a clear commit message. Tell me what changed, why, and how to test it.
5. **Ask before big decisions** (changing the tech stack, adding a paid service, deleting data or files). For small decisions, choose a sensible default, state it in one line, and continue.
6. **Never commit secrets** (API keys, service-role keys, passwords). Secrets live in environment variables or server-side secret stores only.
7. **Be honest about uncertainty.** If you are not sure an API, price or library works as you remember, check the official docs first.
8. After each phase, give me a **Phase Report**: what was built, what was tested, what is left over, risks, and the exact next step.

---

## 1. THE PRODUCT VISION

**Name:** AGROVA (working name; the current web code is called AgriSmart; final brand to be confirmed).
**Tagline:** *Grow Smarter. Farm Better.*
**Core promise:** *"Your Farm. Your Data. Your AI Farm Manager."*

AGROVA is not a pile of agricultural articles. It is a **digital farm operating system** that learns each farmer's farm and keeps answering one question: **"What does this farmer need to know or do next?"**

**The complete farming lifecycle the platform must support end-to-end:**
plant → record planting date → weather monitored → disease risk identified → alert sent → treatment recorded → expenses tracked → harvest recorded → buyers found → sale recorded → profit calculated.

**Primary users:** smallholder and commercial farmers (crops and livestock). **Secondary users:** buyers (restaurants, hotels, wholesalers, supermarkets, processors), agronomists/experts, cooperatives.

**Platforms required:** Android, iPhone, Windows, macOS. Mobile = "farm in your pocket"; Desktop = "farm command center" (richer dashboard, not a stretched phone UI).

**Design principle:** See → Understand → Act.
**Feel:** modern, intelligent, trustworthy, natural, premium, accessible. A premium fintech feel, not an old government portal.

### 1.1 Design system (from my design board — follow it)
- **Primary greens:** `#1E7A3D` (deep), `#2ECC71`, `#7ED957` (accent), `#E8F5E9` (tint)
- **Neutrals:** `#111827`, `#374151`, `#6B7280`, `#E5E7EB`, `#F8FAFC`, `#FFFFFF`
- **Semantic:** Success `#22C55E`, Warning `#F59E0B`, Error `#EF4444`, Info `#3B82F6`, Purple `#8B5CF6`
- **Typography:** Poppins (Light/Regular/Medium/Semibold/Bold). H1 32/Bold, H2 24/Semibold, H3 20/Semibold, Body 16/Regular, Body-2 14, Caption 12
- **Spacing:** 8-point grid (4, 8, 16, 24, 32, 48, 64)
- **Components:** rounded cards, soft shadows, minimal line icons, primary/secondary/tertiary buttons with hover and pressed states, progress rings and bars, tags (New, Popular, Sale, Verified, Organic), checkboxes, radios, switches, charts (profit line, expense donut, crop status bars)
- **Dark mode:** required from the start (design tokens, not hard-coded colors)
- **Navigation:** mobile = 5-tab bottom nav (Home, My Farm, **AI** as prominent center button, Market, Profile); desktop = left sidebar (Dashboard, My Farm, Crops, Livestock, Tasks, Finance, Market, Community, Services, AI Assistant, Settings)

### 1.2 The first 10 screens (from my design board)
1 Splash · 2–4 Onboarding (3 screens) · 5 Login/Register · 6 Create account · 7 Select user type (Farmer / Buyer-Business) · 8 Farm setup · 9 Home dashboard · 10 AI assistant chat (+10A voice input, +10B response example)

### 1.3 The home screen must answer, at a glance
How is my farm doing? · What needs my attention? · What should I do today? · What is the weather doing? · How is my money doing?

---

## 2. FEATURE MAP AND PRIORITY

| Tier | Features |
|---|---|
| **MVP (must work beautifully)** | Farmer profile + farm management · AI agricultural assistant · Crop disease and pest photo analysis ("Scan My Crop") · Crop calendar + task reminders · Farm expense and profit tracking |
| **Version 2** | Marketplace (inputs and produce) · Market prices · Farmer community · Equipment sharing · Weather and farm alerts |
| **Advanced** | Satellite monitoring · Soil testing integration · Financing and insurance connections · Logistics and produce transport · IoT sensors / smart irrigation · Yield prediction |
| **Engagement** | Farmer achievement badges · Reputation and verified profiles |

**Signature ideas to protect:**
- **Farm Intelligence Engine:** farm data + external data (weather, market, satellite) + AI = a short list of *insights* and *actions*, not raw data. Example: "Heavy rain expected and fungal risk is elevated; your tomatoes are in a sensitive stage. Inspect after rainfall."
- **Smart Weather:** convert "Rain: 80%" into "Delay irrigation, inspect leaves tomorrow morning".
- **Smart Farm Calendar:** choose crop + planting date, get an auto-generated, weather-adjusted timeline.
- **Local language + voice:** English and Kiswahili first (text and voice); more African languages later.
- **AI honesty rule:** every AI diagnosis is *advisory*, shows a confidence level, and tells the farmer when to consult a local extension officer or agronomist. Never claim certainty. Never recommend specific pesticide doses; point to locally approved guidance.

---

## 3. WHAT ALREADY EXISTS (the "AgriSmart" codebase)

**Stack today:** static multi-page website (HTML + CSS + vanilla JavaScript), **Supabase** (Postgres, Auth, Storage, RLS), **OpenWeatherMap** for weather, deployed on **Netlify**, Git history of about 25 commits.

**Folders:** `auth/` (login, signup, forgot/reset password) · `dashboard/` (dashboard, farms, crops, livestock, finances, market, weather, articles, profile, admin) · `js/` · `css/` · `supabase/migrations/` (2 files) · `images/`.

**Working features (use as the starting point, do not throw away):**
- Auth: signup, login, forgot password, reset password, profile setup (county, phone, avatar, units)
- Farms → Enterprises (crop or livestock type) → Crop plots (planted date, expected harvest, status)
- Livestock: animals with species/breed picker (static catalog), plus feed logs, vaccinations, health records, growth records, and vaccination-due notifications
- Finances: income/expense transactions per farm with totals (KES)
- Market: crowd-sourced price board + marketplace listings with search
- Weather: current + 5-day forecast per farm county, 30-minute shared cache, rule-based equipment suggestions linked into the marketplace
- Notifications bell (in-app), Knowledge Hub (articles CMS + public articles), admin-gated analytics link, public landing page with live platform stats
- Currency is KES; location is by Kenyan county

**Data model in use (tables):** `profiles`, `farms`, `enterprises`, `crop_plots`, `livestock_animals`, `animal_feed_logs`, `animal_vaccinations`, `animal_health_records`, `animal_growth_records`, `species_templates` (unused), `transactions`, `market_prices`, `marketplace_listings`, `notifications`, `weather_cache`, `articles`, plus RPC `get_platform_stats()`.

**Gap between today and the vision:** the current app is a solid record-keeping + information web app. It has **no AI, no crop scanner, no voice, no farm map, no task/calendar engine, no insights engine, no mobile/desktop apps, no payments, no community, no Kiswahili.** Branding and colors also differ from the AGROVA design system (current green `#2E8B57`/`#0B5D1E`, fonts Poppins + Open Sans).

---

## 4. CORRECTIONS REQUIRED IN THE EXISTING CODE (audit results)

Fix these in **Phase 0** before building new features. Priority: 🔴 critical, 🟠 high, 🟡 medium.

### 🔴 Security
1. **Secrets exposed in the browser.** The OpenWeatherMap key (`js/config.js`) must be sent to the browser to be used, so it is public once deployed even though the file is git-ignored; and `js/supabase-client.js` has the real Supabase URL and anon key committed. The config and key were also inside the zip I shared. → **Rotate the OpenWeatherMap key and review the Supabase keys. Move weather calls to a Supabase Edge Function (server-side proxy); keep the key only as a server secret.** The Supabase anon key may stay public *only if* RLS is correct on every table (see 3).
2. **Cross-site scripting (XSS) everywhere.** User text is inserted into the page with `innerHTML` and template strings with no escaping (around 75 places across `farms.js`, `crops.js`, `finances.js`, `market.js`, `livestock.js`, `animal-records.js`, `notifications.js`, `weather.js`, `articles*.js`, `dashboard.js`). Worst cases: `article.html` renders `article.body` as raw HTML; `market.js` echoes the `?search=` URL parameter into the page (reflected XSS); avatar and cover image URLs go into `url("…")` / `src` unchecked; weather data from a *shared* cache table is rendered unescaped. → Add one shared `escapeHtml()` helper (or build DOM nodes with `textContent`), sanitize article bodies with DOMPurify or render as Markdown safely, validate URLs (https only), and add a **Content-Security-Policy** header in `netlify.toml`.
3. **Row-Level Security cannot be verified.** The repo only contains 2 migrations (animal records and profile fields). The base schema (profiles, farms, enterprises, crop_plots, livestock_animals, transactions, market_prices, marketplace_listings, notifications, weather_cache, articles, `get_platform_stats`) is not in version control. → Export the full current schema and policies into a baseline migration, then audit every table. Specifically verify: users **cannot change their own `profiles.role`** to admin; `weather_cache` cannot be written or poisoned by ordinary users (move writes to the Edge Function); users can only insert notifications for themselves; only owners can edit/delete their rows; only admins can publish or moderate articles; anonymous users can read only published articles and aggregate stats.
4. **Admin protection is client-side only** (`dashboard.js` shows the admin link if `role === "admin"`; `js/admin.js` is an empty file). → Enforce admin through RLS/`is_admin()` database function, and build or remove the admin page.
5. **Avatar upload is not validated** (`profile.js`): file extension comes from the filename, no type or size limit, the bucket is public, and the update policy has no `WITH CHECK`. → Allow only jpeg/png/webp up to about 2 MB, generate the filename server-side-safe, block SVG, add `WITH CHECK`.

### 🟠 Functional bugs
6. **Signup loses the county.** `auth.js` updates `profiles.county` right after `signUp()`; if email confirmation is enabled there is no session yet, so RLS blocks it silently and the county is never saved (weather then breaks). → Pass county in `options.data` and let the profile-creation trigger read it, or collect it after first login. Also handle "check your email to confirm" explicitly and enforce a password policy.
7. **Landing page 404s.** `index.html` loads `js/animations.js` and `js/app.js`, which do not exist. `css/responsive.css` and `js/admin.js` are empty. → Create, or remove the references.
8. **Weather by county name text** (`q=Nakuru`) is ambiguous and imprecise; rain is "expected" if `current.rain` exists (that means raining *now*) and daily rain uses presence of rain rather than probability. → Store latitude/longitude per farm (map pin or geocoding), use the forecast's probability-of-precipitation, and return interpreted recommendations, not raw numbers.
9. **Notifications can duplicate** (`pushNotificationOnce` checks then inserts, which races) and are only created when a page is opened. → Add a unique index (user, type, title, day) and generate alerts server-side on a schedule (Supabase scheduled function) so they arrive even when the app is closed.
10. **No input validation** beyond HTML attributes: numbers are sent as strings; no checks like amount > 0 or harvest date ≥ planting date. → Add client validation *and* database `CHECK` constraints and types.
11. **Marketplace is incomplete:** no seller contact method, no "mark as sold", no photos, no reporting/moderation; the price board is crowd-sourced with no outlier or spam control; listings are fetched unpaginated and searched client-side.

### 🟡 Quality and maintenance
12. Every page repeats the same boilerplate (session check, profile fetch, logout, modal wiring) and shares global variable names. → Extract shared modules.
13. No pagination on transactions/listings; no loading or empty-state consistency; `alert()`/`confirm()` used for UX.
14. `supabase-js@2` loaded from a CDN unpinned and without integrity hashes. → Pin the version and add SRI, or bundle.
15. Repo hygiene: uncommitted modified files and deleted `.patch` files in the working tree; a vim swap file inside `.git`; CRLF line endings; about 15 MB of unoptimized PNG/JPG images (several are 1–4 MB each). → Commit or discard cleanly, add `.gitattributes`/`.editorconfig`, convert images to WebP and size them properly.
16. No tests, no linting, no CI, no error monitoring. → Add them (see Section 6).
17. `species_templates` table exists but is unused while the UI uses a static JS catalog. → Pick one source of truth.
18. Branding and design tokens do not match the AGROVA design system. → Align in Phase 1.

---

## 5. TARGET ARCHITECTURE (decisions to confirm in Phase 1)

**Recommended default (confirm with me before Phase 1 coding begins):**

- **Client:** **Flutter**, one codebase for Android, iOS, Windows and macOS, with a responsive layout (bottom-nav on phones, sidebar on desktop). Use a clean architecture with feature folders and a design-token theme (light + dark).
- **Backend:** keep **Supabase** (Postgres + Auth + Storage + Row-Level Security + Realtime) because it is already in use and fits the data model. Add **Edge Functions** for anything with a secret: weather proxy, AI calls, payments, scheduled alerts.
- **AI:** a vision-capable LLM called **only from an Edge Function** (never from the app). Use a farm-context builder that attaches the farmer's farm, crops, planting dates, weather and history to each request. Store conversations and scans per user. Add rate limits and cost tracking per user.
- **Maps:** a map SDK for farm boundaries and zones (polygons per crop zone). Satellite later.
- **Payments (Phase 3+):** M-Pesa (Safaricom Daraja API) first, cards later. Verify current requirements and fees in official docs before building.
- **Push notifications:** Firebase Cloud Messaging (Android/iOS) plus local notifications on desktop.
- **Offline-first:** Kenyan rural connectivity is unreliable. The app must open, show last-known farm data, and queue records (tasks, expenses, harvests) while offline, then sync.
- **Web:** keep the existing AgriSmart site alive as the public marketing site, articles and admin panel until the Flutter app reaches parity; then migrate or retire pages deliberately.
- **Alternative if Flutter is rejected:** evolve the web app into a PWA and wrap it for stores. State the trade-offs (less native feel, weaker desktop and camera/voice support) and let me decide.

**Environments:** `dev` and `prod` Supabase projects, separate keys, migrations applied through the Supabase CLI, never edited by hand in prod.

---

## 6. CROSS-CUTTING STANDARDS (apply in every phase)

- **Security:** RLS on every table; least privilege; no secrets in client code; input validation on client and database; escape all output; rate-limit AI and auth endpoints.
- **Privacy and compliance:** farmer data belongs to the farmer. Provide export and delete-my-data. Keep a clear privacy policy and consent flow. Follow the Kenya Data Protection Act (2019) requirements; confirm details with a qualified advisor before launch.
- **Localization:** all strings externalized from day one. English + Kiswahili at launch of Phase 2 at the latest. Units (metric/imperial) and KES currency formatting via locale.
- **Accessibility:** large tap targets, high contrast, scalable text, icons with labels, voice input as an alternative to typing, simple language.
- **Performance:** compress images, paginate lists, cache reads, lazy-load heavy screens, budget app size.
- **Testing:** unit tests for business logic (profit calculations, calendar generation, insight rules); integration tests for each Supabase policy (a user can never read or write another user's data); widget tests for key screens; a manual test checklist per phase.
- **CI/CD:** GitHub Actions to lint, test and build on every push; automatic web deploy to Netlify; signed builds for Android/iOS/Windows/macOS in later phases.
- **Observability:** error tracking (e.g. Sentry), basic analytics on feature use (privacy-respecting), and AI cost/latency logging.
- **Documentation:** keep `README.md`, `ARCHITECTURE.md`, `SETUP.md` and a `CHANGELOG.md` up to date; every migration commented.

---

## 7. THE TIMELINE

Durations are estimates for one main developer working with AI assistance; adjust them with me after Phase 0. Because much of Phase 1 and 3 already exists in the web code, **port and improve, don't rebuild from scratch.**

| Phase | Name | Estimated duration | Cumulative |
|---|---|---|---|
| 0 | Stabilize and secure the existing app | 1–2 weeks | Weeks 1–2 |
| 1 | Foundation: AGROVA app shell, farm core, calendar, weather | 3–4 months | Months 1–4 |
| 2 | Intelligence: AI assistant, Crop Scanner, voice, languages, insights | 2–4 months | Months 5–8 |
| 3 | Money: finance, market prices, marketplace, payments | 2–4 months | Months 9–12 |
| 4 | Ecosystem: services, equipment sharing, community, reputation | 3–4 months | Months 13–16 |
| 5 | Advanced agriculture: satellite, soil, IoT, prediction, finance partners | ongoing | Month 17+ |
| ∞ | Launch, growth and business model (runs in parallel from Phase 2) | continuous | — |

---

### PHASE 0 — Stabilize and secure (Weeks 1–2)

**Goal:** a safe, clean, documented base to build on.

**Tasks**
1. Clean the repo: commit or discard pending changes, remove `.patch` files and stray files, add `.gitignore`, `.gitattributes`, `.editorconfig`, normalize line endings, compress images to WebP.
2. Secrets: rotate the OpenWeatherMap key; review Supabase keys; create `.env.example`; document secret handling.
3. Export the **full baseline schema + RLS policies + functions** into `supabase/migrations/00000000_baseline.sql`. Document every table (purpose, owner column, policies).
4. RLS audit and fixes (Section 4, item 3). Write automated policy tests (user A cannot see/modify user B's rows; non-admin cannot become admin).
5. XSS fixes (Section 4, item 2): shared escape helper, sanitize articles, validate URLs, add CSP in `netlify.toml`.
6. Move weather to an Edge Function proxy with server-side cache; remove the key from the browser.
7. Fix the bugs in Section 4, items 4–11 that do not need new features (signup county, missing scripts, validation, notification dedupe, avatar validation).
8. Add lint (ESLint/Prettier), a minimal test setup and a CI workflow.
9. Write `README.md`, `ARCHITECTURE.md`, `SETUP.md` (replacing/expanding `SETUP_NOTES.md`).

**Deliverables:** clean repo, baseline migration, passing policy tests, secured weather proxy, fixed list above, docs.
**DoD:** no secret in the repo or served files; every table has RLS and a test; no unescaped user input reaches the DOM; landing page has zero 404s; CI is green; I can follow `SETUP.md` and run the project myself.

---

### PHASE 1 — Foundation (Months 1–4)

**Goal:** the core loop works beautifully in the new cross-platform app: *a farmer creates their farm → adds crops → sees a smart dashboard with weather and tasks.*

**Tasks**
1. Confirm the architecture (Section 5) and set up the Flutter project, folder structure, theme tokens (light/dark), navigation (mobile bottom-nav, desktop sidebar), routing, state management, localization scaffolding, and CI builds.
2. Implement the **first 10 screens** exactly per the design board: splash, 3 onboarding screens, login/register (email/phone; Google/Apple later), create account, user type (Farmer / Buyer), farm setup, home dashboard, AI chat shell (UI only), voice input shell.
3. Port existing features to the new app on top of the same Supabase backend: profile, farms, crops/plots, livestock with animal records, notifications.
4. **Farm profile upgrade:** location via map pin (lat/lng), farm size, soil type, irrigation system, water source.
5. **My Farm Map:** draw farm boundary; divide into zones; each zone holds crop, variety, planting date, growth stage, irrigation, fertilizer records, disease history, expected harvest.
6. **Smart Farm Calendar + Task engine:** crop templates (start with 8–10 common Kenyan crops, e.g. maize, tomato, onion, kale, potato, beans, cabbage, carrot, plus basic dairy/poultry schedules) that generate planting, irrigation, fertilization, scouting, pruning and harvest tasks from the planting date; tasks can be completed, snoozed, and added manually; reminders as push/local notifications.
7. **Smart Weather:** lat/lng-based forecast through the Edge Function; rule-based recommendations ("delay irrigation", "inspect leaves", equipment suggestions) shown on the home screen.
8. **Home dashboard:** greeting, weather card, "needs attention" list, farm health summary (placeholder formula, documented), today's tasks, quick access to AI.
9. Align the public website branding with AGROVA (logo, palette, Poppins) without breaking the existing site.
10. Define the data model additions as migrations: `farm_zones`, `crop_templates`, `tasks`, `farm_activity_log`, `devices` (push tokens), with RLS and tests.

**Deliverables:** installable app builds (Android APK, iOS TestFlight if available, Windows and macOS builds), updated database with migrations and tests, user-test script.
**DoD:** a new user can sign up, create a farm, draw it, add a crop, see generated tasks and a weather-driven recommendation, mark a task done, and see it all on both phone and desktop layouts; works offline for viewing and queuing tasks; 5 real farmers (or proxies) complete the flow in a test session and their feedback is recorded.

---

### PHASE 2 — Intelligence (Months 5–8)

**Goal:** the app starts to *think* for the farmer.

**Tasks**
1. **AGROVA AI assistant:** chat with farm-aware context (crops, planting dates, location, weather, history). Server-side only, with conversation storage, safety prompt (advisory tone, no dosage claims, escalate to experts when unsure), per-user rate limits and usage/cost logging.
2. **Scan My Crop:** camera/gallery upload → Edge Function → vision analysis → structured result: crop, possible issue, confidence, severity, what was found, recommended actions, when to re-check. Buttons: *Save to Farm Record*, *Ask AI More*. Store images and results; attach to the zone/crop. Build an evaluation set of real labeled local images and track accuracy; never present confidence the system has not earned.
3. **Voice:** speech-to-text and text-to-speech, English and Kiswahili; microphone flow per screen 10A.
4. **Localization:** complete English + Kiswahili UI; AI answers in the user's language on request.
5. **Farm Intelligence Engine v1:** a scheduled job combines farm data + weather + (later) market and regional disease reports into ranked **insights** with priority levels (Urgent / Important / Reminder / Opportunity), each with a clear recommended action. Start rule-based and explainable, then add AI summarization.
6. **Smart alerts:** server-side push notifications by priority, with quiet hours and per-category settings; no spam.
7. **Disease and pest knowledge base:** curated, sourced entries (symptoms, causes, prevention, when to seek help) to ground AI answers; link to Knowledge Hub articles.
8. **Farm Health score:** replace the placeholder with a documented, tested formula.

**Deliverables:** working AI chat, Scan My Crop, voice, Kiswahili, insights feed, alert system, evaluation report.
**DoD:** a farmer can photograph a sick crop and get a useful, honest, saved result in under ~15 seconds on normal mobile data; AI answers cite the farm context; every AI screen shows the advisory disclaimer; measured scan accuracy and failure cases are documented; cost per active user is known and within budget.

---

### PHASE 3 — Money (Months 9–12)

**Goal:** the app proves its value in shillings.

**Tasks**
1. **Finance upgrade:** per-crop and per-season expenses (seeds, fertilizer, chemicals, labor, water, transport, equipment), revenue and harvest records, profit, margin and ROI, charts (profit over time, expense donut), "your fertilizer spending increased 22%" style explanations, export to PDF/CSV.
2. **Crop profitability comparison** ("What should I plant this season?") using local prices, expected yield, input cost and weather risk; clearly labelled as an estimate.
3. **Market prices:** move from open crowd entry to a trusted pipeline: official/partner price sources where available plus moderated farmer submissions with outlier detection, price trends and market-aware AI advice.
4. **Marketplace v2:** inputs and produce; photos; seller contact or in-app chat; reservation/offer flow; "mark as sold"; reviews; report/moderation tools; buyer accounts (restaurants, hotels, wholesalers) and "buyer is looking for 2 tons of carrots near you" opportunity alerts.
5. **Payments:** M-Pesa integration (STK push, confirmations, reconciliation), receipts, dispute handling design; decide escrow or direct payment with legal advice. No money movement goes live before security review.
6. **Business model:** define pricing and revenue (e.g. free tier + premium AI/insights, marketplace commission, buyer subscriptions, partner services). Build billing and plan limits.

**DoD:** a farmer can see true profit per crop; sell produce through the marketplace and get paid; every payment flow is tested end-to-end with reconciliation; a financial/security review is completed.

---

### PHASE 4 — Ecosystem (Months 13–16)

**Goal:** the place farmers go whenever they need something.

**Tasks:** **Agro Services** directory (tractor owners, transporters, soil testing, agronomists, irrigation specialists, equipment repair, greenhouse installers) · **Equipment sharing/rental** with availability, distance, price and ratings · **Agro Community** (posts with photos, groups by crop/livestock/county, expert answers with verified badges: Farmer, Experienced Farmer, Agricultural Expert, Organization) · **Reputation** (successful sales, helpful answers, verified farm info, buyer reviews) · **Achievements** (badges for recording activities, finances, soil tests, harvests) · moderation tooling and abuse reporting · cooperatives/team accounts with roles (owner, manager, worker) · **desktop command center** enhancements (multi-farm analytics, bulk edits, reports).

**DoD:** services and equipment can be listed, found, booked and rated; community has working moderation; team accounts enforce roles through RLS.

---

### PHASE 5 — Advanced Agriculture (Month 17+)

**Tasks (prioritized after real usage data):** satellite vegetation-health monitoring and field alerts · soil health system (manual results first, lab integrations later) · IoT sensors and smart irrigation · yield prediction and crop forecasting · financing and insurance partnerships · logistics and produce transport · expansion to other counties/countries and languages.

---

### CONTINUOUS TRACK — Launch, growth, operations (starts during Phase 2)

Beta group of real farmers (target 20–50) · feedback loop and bug triage · app-store/Play Store listings and policies · privacy policy and terms · support channel (WhatsApp/phone) · partnerships (cooperatives, extension officers, agro-dealers, universities) · analytics review every month · cost and unit-economics review every quarter.

---

## 8. RISKS TO WATCH

1. **Scope creep** (14+ feature ideas): protect the MVP loop above everything.
2. **AI trust and safety:** wrong diagnoses can cost a farmer a harvest. Keep advice advisory, test on local data, show confidence honestly.
3. **Connectivity and cost:** offline-first design and data-light images; AI cost caps per user.
4. **Payment, legal and data-protection compliance:** get qualified advice before handling money or sensitive data.
5. **Cold start:** a marketplace needs both sellers and buyers; launch in one or two counties first.
6. **Solo-builder bandwidth:** keep phases small and shippable; cut features, not quality.

---

## 9. HOW TO START

When I paste this prompt, reply with:
1. A **5-line summary** of your understanding of the project.
2. Any **questions or assumptions** that block Phase 0 (maximum 5).
3. The **ordered task list for Phase 0**, with an estimate for each task.

Then wait for my "go" before changing any code. Begin every later phase the same way: summary → questions → ordered tasks → wait for approval.
