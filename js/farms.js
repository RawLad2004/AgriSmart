/*==========================================================
                    FARMS MANAGEMENT
==========================================================*/

let currentUserId = null;

async function loadFarms() {
  const listBox = document.getElementById("farms-list");

  const { data: farms, error } = await sb
    .from("farms")
    .select("id, name, county, size_acres, soil_type, created_at")
    .eq("owner_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load farms: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!farms || farms.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>No farms yet. Add your first one to get started.</p>
      </div>`;
    return;
  }

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Farm</th><th>County</th><th>Size</th><th>Soil</th><th></th></tr>
      </thead>
      <tbody>
        ${farms.map(f => `
          <tr>
            <td>${escapeHtml(f.name)}</td>
            <td>${escapeHtml(f.county || "—")}</td>
            <td>${f.size_acres ? escapeHtml(f.size_acres) + " acres" : "—"}</td>
            <td>${f.soil_type ? `<span class="badge">${escapeHtml(f.soil_type)}</span>` : "—"}</td>
            <td>
              <button class="secondary-btn delete-farm-btn" data-id="${escapeHtml(f.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".delete-farm-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this farm? This cannot be undone.")) return;
      const { error } = await sb.from("farms").delete().eq("id", btn.dataset.id);
      if (error) {
        alert("Couldn't delete farm: " + error.message);
      } else {
        loadFarms();
      }
    });
  });
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

  await loadFarms();

  // ---- Modal open/close ----
  const modal = document.getElementById("add-farm-modal");
  document.getElementById("open-add-farm").addEventListener("click", () => modal.classList.add("active"));
  document.getElementById("cancel-add-farm").addEventListener("click", () => modal.classList.remove("active"));

  // ---- Add farm ----
  let isSubmittingFarm = false;

  document.getElementById("add-farm-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isSubmittingFarm) return;
    isSubmittingFarm = true;

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;

    const errorBox = document.getElementById("farm-form-error");
    errorBox.textContent = "";

    const name = document.getElementById("farm_name").value.trim();
    const county = document.getElementById("farm_county").value.trim();
    const size_acres = document.getElementById("farm_size").value || null;
    const soil_type = document.getElementById("farm_soil").value || null;

    const { error } = await sb.from("farms").insert({
      owner_id: currentUserId,
      name,
      county,
      size_acres,
      soil_type
    });

    isSubmittingFarm = false;
    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    modal.classList.remove("active");
    document.getElementById("add-farm-form").reset();
    loadFarms();
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();