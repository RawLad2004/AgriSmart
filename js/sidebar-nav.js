/*==========================================================
            SIDEBAR NAV — ROLE-AWARE ADMIN LINK
    The Admin sidebar entry is rendered hidden on every
    dashboard page. This reveals it only after confirming the
    signed-in user's profile role is "admin".

    This controls visibility only. Access control is enforced
    by each page's own requireSession()/role guard and, most
    importantly, by Supabase RLS and RPCs.
==========================================================*/

(async () => {
  const adminLink = document.getElementById("admin-sidebar-link");
  if (!adminLink) return;

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return; // the page's own requireSession() redirects

    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role === "admin") {
      adminLink.style.display = "flex";
    }
  } catch (err) {
    console.error("[sidebar-nav] Could not resolve admin link visibility:", err);
  }
})();
