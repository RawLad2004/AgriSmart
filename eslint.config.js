const globals = require("globals");

// Helpers defined in one script file and used in others (the site uses plain
// <script> tags, not modules), so ESLint must know they exist.
const appGlobals = {
  sb: "readonly",
  supabase: "readonly",
  requireSession: "readonly",
  signOut: "readonly",
  savePendingProfile: "readonly",
  applyPendingProfile: "readonly",
  escapeHtml: "readonly",
  safeHttpUrl: "readonly",
  safeCssUrl: "readonly",
  initNotificationBell: "readonly",
  pushNotificationOnce: "readonly",
  getWeatherForLocation: "readonly",
  weatherIconUrl: "readonly",
  formatDayLabel: "readonly",
  getEquipmentSuggestions: "readonly",
  initAnimalRecords: "readonly",
  openAnimalRecordsModal: "readonly",
  openSpeciesPicker: "readonly"
};

module.exports = [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, ...appGlobals }
    },
    rules: {
      "no-undef": "error",
      // vars: "local" -> top-level functions are shared between <script> files, so only
      // unused variables inside functions are reported. caughtErrors: "none" -> an
      // intentionally ignored `catch (e)` is fine.
      "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["warn", "always"]
    }
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node } }
  }
];
