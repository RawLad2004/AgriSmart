/*==========================================================
                    ADMIN PAGE
    1. Access guard: session + role check. This is a UX
       boundary only - Supabase RLS is the real enforcement
       (only admins can see other people's drafts or publish).
    2. Pending articles: drafts written by users, waiting for
       an admin to publish or delete them.
==========================================================*/

(async () => {

  const session = await requireSession();
  if (!session) return; // requireSession() already redirected to login

  const { data: profile, error } = await sb
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  if (error || profile?.role !== "admin") {
    window.location.replace("dashboard.html");
    return;
  }

  const displayName = profile.full_name || session.user.email;
  const userName = document.getElementById("user-name");
  const userAvatar = document.getElementById("user-avatar");
  if (userName) userName.textContent = displayName;
  if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();

  const adminLink = document.getElementById("admin-sidebar-link");
  if (adminLink) adminLink.style.display = "flex";

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      signOut();
    });
  }

  try {
    await initNotificationBell(session.user.id);
  } catch (err) {
    console.error("[admin] Notifications failed to initialise:", err);
  }

  /*==========================================================
                    PENDING ARTICLES
  ==========================================================*/

  const content = document.getElementById("admin-content");
  if (!content) return;

  content.innerHTML = `
    <h2 style="margin:0 0 6px;">Pending articles</h2>
    <p style="color:var(--dark-grey);margin:0 0 16px;">
      Drafts written by users. Publishing makes an article public on the Knowledge Hub.
    </p>
    <p id="admin-status" class="form-error" role="status" style="min-height:1.2em;"></p>
    <div id="pending-articles"></div>
  `;

  const statusBox = document.getElementById("admin-status");
  const listBox = document.getElementById("pending-articles");
  let pendingCache = [];

  function setStatus(message) {
    statusBox.textContent = message || "";
  }

  async function loadPendingArticles() {
    listBox.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

    const { data: drafts, error: draftsError } = await sb
      .from("articles")
      .select("id, title, category, excerpt, body, created_at, author_id")
      .eq("published", false)
      .order("created_at", { ascending: false });

    if (draftsError) {
      listBox.innerHTML = `<p class="form-error">Couldn't load drafts: ${escapeHtml(draftsError.message)}</p>`;
      return;
    }

    pendingCache = drafts || [];

    if (pendingCache.length === 0) {
      listBox.innerHTML = `<p style="color:var(--dark-grey);">No drafts are waiting. 🎉</p>`;
      return;
    }

    // Look up author names (admins are allowed to read all profiles).
    const authorIds = [...new Set(pendingCache.map(a => a.author_id))];
    const { data: authors } = await sb
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    const authorName = {};
    (authors || []).forEach(a => { authorName[a.id] = a.full_name; });

    listBox.innerHTML = pendingCache.map(a => `
      <div class="panel" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
          <div style="min-width:220px;">
            <strong>${escapeHtml(a.title)}</strong>
            <div style="color:var(--dark-grey);font-size:0.9rem;margin-top:4px;">
              ${escapeHtml(a.category)} · by ${escapeHtml(authorName[a.author_id] || "Unknown author")} ·
              ${escapeHtml(String(a.created_at).slice(0, 10))}
            </div>
            ${a.excerpt ? `<p style="margin:8px 0 0;">${escapeHtml(a.excerpt)}</p>` : ""}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="primary-btn publish-article-btn" data-id="${escapeHtml(a.id)}">Publish</button>
            <button type="button" class="secondary-btn delete-article-btn" data-id="${escapeHtml(a.id)}">Delete</button>
          </div>
        </div>
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;">Read the draft</summary>
          <div style="white-space:pre-wrap;margin-top:10px;">${escapeHtml(a.body)}</div>
        </details>
      </div>
    `).join("");
  }

  listBox.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;

    const id = btn.dataset.id;
    const article = pendingCache.find(a => a.id === id);
    if (!article) return;

    setStatus("");

    if (btn.classList.contains("publish-article-btn")) {
      if (!confirm(`Publish "${article.title}"? It will be visible to everyone.`)) return;
      btn.disabled = true;

      const { data, error: publishError } = await sb
        .from("articles")
        .update({ published: true })
        .eq("id", id)
        .select("id");

      if (publishError || !data || data.length === 0) {
        btn.disabled = false;
        setStatus("Couldn't publish: " + (publishError ? publishError.message : "no permission or article not found."));
        return;
      }
      setStatus(`Published "${article.title}".`);
      await loadPendingArticles();
    }

    if (btn.classList.contains("delete-article-btn")) {
      if (!confirm(`Delete the draft "${article.title}"? This cannot be undone.`)) return;
      btn.disabled = true;

      const { data, error: deleteError } = await sb
        .from("articles")
        .delete()
        .eq("id", id)
        .select("id");

      if (deleteError || !data || data.length === 0) {
        btn.disabled = false;
        setStatus("Couldn't delete: " + (deleteError ? deleteError.message : "no permission or article not found."));
        return;
      }
      setStatus(`Deleted "${article.title}".`);
      await loadPendingArticles();
    }
  });

  await loadPendingArticles();

})();
