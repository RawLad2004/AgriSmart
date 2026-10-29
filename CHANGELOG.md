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
