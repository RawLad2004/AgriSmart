const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// Load js/security.js (a plain browser script) into an isolated context.
const sandbox = { window: { location: { href: "https://app.example/dashboard/x.html" } }, URL };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/security.js"), "utf8"), sandbox);
const { escapeHtml, safeHttpUrl, safeCssUrl } = sandbox;

test("escapeHtml neutralises tags, quotes and ampersands", () => {
  assert.strictEqual(escapeHtml("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
  assert.strictEqual(escapeHtml(`"a" & 'b'`), "&quot;a&quot; &amp; &#39;b&#39;");
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(undefined), "");
  assert.strictEqual(escapeHtml(0), "0");
});

test("safeHttpUrl only allows http(s)", () => {
  assert.strictEqual(safeHttpUrl("javascript:alert(1)"), "");
  assert.strictEqual(safeHttpUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.strictEqual(safeHttpUrl(""), "");
  assert.strictEqual(safeHttpUrl("https://x.supabase.co/a.png"), "https://x.supabase.co/a.png");
});

test("safeCssUrl cannot be broken out of", () => {
  assert.strictEqual(safeCssUrl("javascript:1"), "");
  const css = safeCssUrl('https://a/b.png") ;background:url("x');
  assert.ok(css.startsWith('url("https://a/b.png%22)'));
  assert.ok(!css.slice(5, -2).includes('"'));
});

const htmlFiles = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "supabase"].includes(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".html")) htmlFiles.push(full);
  }
})(root);

test("every page that loads supabase-client.js loads security.js first", () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const sc = html.indexOf("supabase-client.js");
    if (sc === -1) continue;
    const sec = html.indexOf("security.js");
    assert.ok(sec !== -1 && sec < sc, `${path.relative(root, file)} must load security.js before supabase-client.js`);
  }
});

test("every local script referenced by a page exists", () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      const target = path.resolve(path.dirname(file), m[1]);
      assert.ok(fs.existsSync(target), `${path.relative(root, file)} references missing ${m[1]}`);
    }
  }
});

test("no weather API key or config.js reference ships to the browser", () => {
  for (const f of fs.readdirSync(path.join(root, "js"))) {
    const src = fs.readFileSync(path.join(root, "js", f), "utf8");
    assert.ok(!/OPENWEATHER_API_KEY/.test(src), `js/${f} must not contain the OpenWeather key`);
  }
  for (const file of htmlFiles) {
    assert.ok(!fs.readFileSync(file, "utf8").includes("config.js"), `${path.relative(root, file)} references config.js`);
  }
});

test("raw database fields are not interpolated into HTML without escapeHtml", () => {
  // Spot-check the highest-risk render sites.
  const checks = [
    ["js/farms.js", "${escapeHtml(f.name)}"],
    ["js/market.js", "${escapeHtml(l.description)}"],
    ["js/notifications.js", "${escapeHtml(n.title)}"],
    ["js/articles-public.js", "${escapeHtml(a.title)}"],
    ["article.html", "${escapeHtml(article.body)}"]
  ];
  for (const [file, needle] of checks) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(src.includes(needle), `${file} should contain ${needle}`);
  }
});
