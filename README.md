# AGROVA (AgriSmart web app)

AI-powered farm management for farmers, starting in Kenya. This repository is the current **web app**
(static HTML/CSS/vanilla JS + Supabase + Netlify). It is the starting point for the cross-platform AGROVA app
(Android, iOS, Windows, macOS). Full plan: [`docs/AGROVA_Master_Project_Prompt.md`](docs/AGROVA_Master_Project_Prompt.md).

## What works today
Accounts and password reset · farms, crop enterprises and plots · livestock with feed/vaccination/health/growth
records · income/expense tracking (KES) · market price board and marketplace · weather with equipment
suggestions · in-app notifications · knowledge-hub articles · admin link for admins.

## Status
**Phase 0 (stabilise and secure): in progress.** See `CHANGELOG.md`.

## Quick start
See [`SETUP.md`](SETUP.md). In short: `npm install`, `npm test`, then open the site with VS Code Live Server.

## Project layout
| Path | Purpose |
|---|---|
| `index.html`, `articles.html`, `article.html` | Public pages |
| `auth/` | Login, signup, forgot/reset password |
| `dashboard/` | Logged-in pages |
| `js/` | One script per page/feature; `security.js` (escaping) loads first everywhere |
| `css/` | Styles and design tokens (`variables.css`) |
| `supabase/migrations/` | Database migrations (apply in filename order) |
| `supabase/functions/weather/` | Edge Function that proxies OpenWeatherMap (keeps the API key secret) |
| `supabase/audit.sql` | Queries to audit tables, policies and functions |
| `tests/` | Automated tests (`npm test`) |
| `docs/` | Master project plan |

## Security rules (read before editing)
1. Any database text placed into HTML must go through `escapeHtml()`; URLs through `safeHttpUrl()` / `safeCssUrl()`.
2. Never put API keys or service keys in files under this repo. Secrets live in Supabase secrets / Netlify env vars.
3. Every table needs Row-Level Security and a test proving users cannot reach each other's data.
