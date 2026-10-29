/*==========================================================
                SECURITY HELPERS (load first)
    Everything that puts user-controlled text into HTML must
    go through these helpers. Rules of thumb:
      - Text from the database  -> escapeHtml(value)
      - Image / link URLs       -> safeHttpUrl(value)
      - CSS background images   -> safeCssUrl(value)
    Never put raw database values inside innerHTML.
==========================================================*/

const _HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;"
};

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"'`]/g, ch => _HTML_ESCAPES[ch]);
}

/* Returns the URL only if it is a plain http(s) URL; otherwise "".
   Blocks javascript:, data:, vbscript: and malformed values. */
function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(String(value), window.location.href);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
  } catch (e) {
    return "";
  }
}

/* Builds a safe CSS `url("...")` value, or "" if the URL is not http(s). */
function safeCssUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  return `url("${url.replace(/["\\\n\r]/g, encodeURIComponent)}")`;
}
