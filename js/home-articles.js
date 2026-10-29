/*==========================================================
        HOME PAGE — LATEST ARTICLES (live from Supabase)
    Falls back silently to the static placeholder cards
    already in index.html if there are no published
    articles yet, or if the fetch fails.
==========================================================*/

(async () => {
  try {
    const { data: articles, error } = await sb
      .from("articles")
      .select("title, slug, excerpt, body, cover_image_url")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error || !articles || articles.length === 0) return;

    const container = document.getElementById("home-article-container");

    container.innerHTML = articles.map(a => `
      <div class="article-card">
        ${a.cover_image_url ? `<img src="${escapeHtml(safeHttpUrl(a.cover_image_url))}" alt="${escapeHtml(a.title)}">` : `<div style="height:240px;background:var(--primary-gradient);"></div>`}
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.excerpt || a.body.slice(0, 110) + "…")}</p>
        <a href="article.html?slug=${encodeURIComponent(a.slug)}">Read More →</a>
      </div>
    `).join("");
  } catch (e) {
    // Silently keep the static placeholder cards already in the page
  }
})();