/*==========================================================
                PUBLIC ARTICLES LISTING
    No login required — reads only published articles,
    which the RLS policy allows for anonymous visitors.
==========================================================*/

let allArticles = [];

function renderArticles(list) {
  const grid = document.getElementById("article-grid");

  if (list.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--dark-grey);">No articles match your search.</p>`;
    return;
  }

  grid.innerHTML = list.map(a => `
    <div class="article-card">
      ${a.cover_image_url ? `<img src="${a.cover_image_url}" alt="${a.title}">` : `<div style="height:240px;background:var(--primary-gradient);"></div>`}
      <h3>${a.title}</h3>
      <p>${a.excerpt || a.body.slice(0, 120) + "…"}</p>
      <a href="article.html?slug=${encodeURIComponent(a.slug)}">Read More →</a>
    </div>
  `).join("");
}

function applyFilters() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const cat = document.getElementById("category-filter").value;

  const filtered = allArticles.filter(a => {
    const matchesSearch = !q || a.title.toLowerCase().includes(q) || (a.excerpt || "").toLowerCase().includes(q);
    const matchesCategory = !cat || a.category === cat;
    return matchesSearch && matchesCategory;
  });

  renderArticles(filtered);
}

(async () => {
  const { data: articles, error } = await sb
    .from("articles")
    .select("title, slug, category, cover_image_url, excerpt, body, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  const grid = document.getElementById("article-grid");

  if (error) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#d32f2f;">Couldn't load articles: ${error.message}</p>`;
    return;
  }

  allArticles = articles || [];

  if (allArticles.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--dark-grey);">No articles published yet — check back soon.</p>`;
    return;
  }

  const categories = [...new Set(allArticles.map(a => a.category))];
  const catSelect = document.getElementById("category-filter");
  catSelect.innerHTML = `<option value="">All Categories</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join("");

  renderArticles(allArticles);

  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("category-filter").addEventListener("change", applyFilters);
})();