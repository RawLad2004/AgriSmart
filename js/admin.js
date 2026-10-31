/*==========================================================
                    ADMIN ACCESS GUARD
    Minimal session + role check only. Admin management tools
    are intentionally not implemented yet (Phase 0, Task 3).
    Client-side checks are a UX boundary, not security:
    Supabase RLS and RPCs must remain the real enforcement.
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

  const content = document.getElementById("admin-content");
  if (content) {
    content.innerHTML = `<p style="color:var(--dark-grey);">Admin tools are not available yet.</p>`;
  }

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

})();
