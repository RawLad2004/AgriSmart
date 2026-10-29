/*==========================================================
                    KNOWLEDGE HUB (AUTHOR SIDE)
==========================================================*/

let currentUserId = null;

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function loadMyArticles() {
  const listBox = document.getElementById("my-articles-list");

  const { data: articles, error } = await sb
    .from("articles")
    .select("id, title, category, published, created_at, slug")
    .eq("author_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load articles: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!articles || articles.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-book"></i>
        <p>You haven't written anything yet. Share what you know with other farmers.</p>
      </div>`;
    return;
  }

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th><th></th></tr>
      </thead>
      <tbody>
        ${articles.map(a => `
          <tr>
            <td>${escapeHtml(a.title)}</td>
            <td>${escapeHtml(a.category)}</td>
            <td><span class="badge" style="background:${a.published ? 'var(--light-green)' : 'var(--grey)'};color:${a.published ? 'var(--dark-green)' : 'white'};">${a.published ? 'Published' : 'Draft'}</span></td>
            <td>${new Date(a.created_at).toLocaleDateString()}</td>
            <td>
              <button class="secondary-btn edit-article-btn" data-id="${escapeHtml(a.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="secondary-btn delete-article-btn" data-id="${escapeHtml(a.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".edit-article-btn").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });

  document.querySelectorAll(".delete-article-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this article? This cannot be undone.")) return;
      const { error } = await sb.from("articles").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadMyArticles();
    });
  });
}

async function openEditModal(articleId) {
  const { data: article, error } = await sb
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (error || !article) {
    alert("Couldn't load article for editing.");
    return;
  }

  document.getElementById("article-modal-title").textContent = "Edit Article";
  document.getElementById("article_id").value = article.id;
  document.getElementById("article_title").value = article.title;
  document.getElementById("article_category").value = article.category;
  document.getElementById("article_cover").value = article.cover_image_url || "";
  document.getElementById("article_excerpt").value = article.excerpt || "";
  document.getElementById("article_body").value = article.body;
  document.getElementById("article_published").value = String(article.published);

  document.getElementById("add-article-modal").classList.add("active");
}

(async () => {

  const session = await requireSession();
  if (!session) return;

  currentUserId = session.user.id;

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name")
    .eq("id", currentUserId)
    .single();

  const displayName = profile?.full_name || session.user.email;
  document.getElementById("user-name").textContent = displayName;
  document.getElementById("user-avatar").textContent = displayName.charAt(0).toUpperCase();

  await initNotificationBell(currentUserId);
  await loadMyArticles();

  // ---- Modal open/close ----
  const modal = document.getElementById("add-article-modal");

  document.getElementById("open-add-article").addEventListener("click", () => {
    document.getElementById("article-modal-title").textContent = "Write an Article";
    document.getElementById("add-article-form").reset();
    document.getElementById("article_id").value = "";
    document.getElementById("article_category").value = "General";
    modal.classList.add("active");
  });

  document.getElementById("cancel-add-article").addEventListener("click", () => modal.classList.remove("active"));

  // ---- Save (create or update) ----
  document.getElementById("add-article-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("article-form-error");
    errorBox.textContent = "";

    const id = document.getElementById("article_id").value;
    const title = document.getElementById("article_title").value.trim();
    const category = document.getElementById("article_category").value.trim();
    const cover_image_url = document.getElementById("article_cover").value.trim() || null;
    const excerpt = document.getElementById("article_excerpt").value.trim() || null;
    const body = document.getElementById("article_body").value.trim();
    const published = document.getElementById("article_published").value === "true";

    if (id) {
      // ---- Update existing ----
      const { error } = await sb.from("articles").update({
        title, category, cover_image_url, excerpt, body, published
      }).eq("id", id);

      if (error) {
        errorBox.textContent = error.message;
        return;
      }
    } else {
      // ---- Create new — generate a unique slug ----
      let slug = slugify(title);
      const { data: existing } = await sb.from("articles").select("id").eq("slug", slug).maybeSingle();
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      const { error } = await sb.from("articles").insert({
        author_id: currentUserId,
        title, slug, category, cover_image_url, excerpt, body, published
      });

      if (error) {
        errorBox.textContent = error.message;
        return;
      }
    }

    modal.classList.remove("active");
    document.getElementById("add-article-form").reset();
    loadMyArticles();
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();