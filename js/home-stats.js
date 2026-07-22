/*==========================================================
        HOME PAGE — LIVE PLATFORM STATS
    Calls the public get_platform_stats() function, which
    returns only aggregate counts (no personal data), so
    this works even for signed-out visitors.
==========================================================*/

(async () => {
  try {
    const { data, error } = await sb.rpc("get_platform_stats");
    if (error || !data || data.length === 0) return;

    const stats = data[0];

    const farmersEl = document.getElementById("stat-farmers");
    const articlesEl = document.getElementById("stat-articles");
    const countiesEl = document.getElementById("stat-counties");

    if (farmersEl) farmersEl.textContent = formatCount(stats.total_farmers) + "+";
    if (articlesEl) articlesEl.textContent = formatCount(stats.total_articles) + "+";
    if (countiesEl) countiesEl.textContent = stats.total_counties;
  } catch (e) {
    // Keep the static placeholder numbers already in the page
  }
})();

function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}