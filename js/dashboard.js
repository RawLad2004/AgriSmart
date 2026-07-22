/*==========================================================
                DASHBOARD OVERVIEW
==========================================================*/

(async () => {

  const session = await requireSession();
  if (!session) return;

  const user = session.user;

  // ---- Profile / topbar ----
  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name || user.email;
  document.getElementById("user-name").textContent = displayName;
  document.getElementById("user-avatar").textContent = displayName.charAt(0).toUpperCase();

  if (profile?.role === "admin") {
    document.getElementById("admin-sidebar-link").style.display = "flex";
  }

  await initNotificationBell(user.id);

  // ---- Farms ----
  const { data: farms, error: farmsError } = await sb
    .from("farms")
    .select("id, name, county, size_acres")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  document.getElementById("stat-farms").textContent = farms ? farms.length : "0";

  const recentFarmsBox = document.getElementById("recent-farms");

  if (farmsError) {
    recentFarmsBox.innerHTML = `<p class="form-error">Couldn't load farms: ${farmsError.message}</p>`;
  } else if (!farms || farms.length === 0) {
    recentFarmsBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>You haven't added a farm yet.</p>
        <a href="farms.html" class="primary-btn" style="display:inline-block;margin-top:20px;">Add Your First Farm</a>
      </div>`;
  } else {
    recentFarmsBox.innerHTML = `
      <table class="data-table">
        <thead>
          <tr><th>Farm</th><th>County</th><th>Size</th></tr>
        </thead>
        <tbody>
          ${farms.slice(0, 5).map(f => `
            <tr>
              <td>${f.name}</td>
              <td>${f.county || "—"}</td>
              <td>${f.size_acres ? f.size_acres + " acres" : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  // ---- Enterprises count (across all farms) ----
  if (farms && farms.length > 0) {
    const farmIds = farms.map(f => f.id);
    const { count } = await sb
      .from("enterprises")
      .select("id", { count: "exact", head: true })
      .in("farm_id", farmIds);
    document.getElementById("stat-enterprises").textContent = count ?? "0";
  } else {
    document.getElementById("stat-enterprises").textContent = "0";
  }

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();