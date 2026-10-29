/*==========================================================
                    CROPS MODULE
==========================================================*/

let currentUserId = null;
let userFarms = [];
let selectedEnterpriseId = null;

async function loadFarmsForDropdown() {
  const { data: farms } = await sb
    .from("farms")
    .select("id, name")
    .eq("owner_id", currentUserId)
    .order("name");

  userFarms = farms || [];

  const select = document.getElementById("ent_farm");
  select.innerHTML = `<option value="">Select a farm…</option>` +
    userFarms.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
}

async function loadEnterprises() {
  const listBox = document.getElementById("enterprises-list");

  if (userFarms.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>Add a farm first, then come back to create a crop enterprise.</p>
        <a href="farms.html" class="primary-btn" style="display:inline-block;margin-top:20px;">Go to My Farms</a>
      </div>`;
    return;
  }

  const farmIds = userFarms.map(f => f.id);

  const { data: enterprises, error } = await sb
    .from("enterprises")
    .select("id, name, farm_id, created_at")
    .eq("type", "crop")
    .in("farm_id", farmIds)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load enterprises: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!enterprises || enterprises.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-wheat-awn"></i>
        <p>No crop enterprises yet. Add one to start tracking plots.</p>
      </div>`;
    return;
  }

  const farmNameById = Object.fromEntries(userFarms.map(f => [f.id, f.name]));

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Enterprise</th><th>Farm</th><th></th></tr>
      </thead>
      <tbody>
        ${enterprises.map(e => `
          <tr>
            <td>${escapeHtml(e.name)}</td>
            <td>${escapeHtml(farmNameById[e.farm_id] || "—")}</td>
            <td>
              <button class="secondary-btn manage-plots-btn" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.name)}" style="padding:8px 16px;font-size:.85rem;">
                Manage Plots
              </button>
              <button class="secondary-btn delete-enterprise-btn" data-id="${escapeHtml(e.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".manage-plots-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedEnterpriseId = btn.dataset.id;
      document.getElementById("plots-panel-title").textContent = `Plots — ${btn.dataset.name}`;
      document.getElementById("plots-panel").style.display = "block";
      loadPlots();
      document.getElementById("plots-panel").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".delete-enterprise-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this crop enterprise and all its plots?")) return;
      const { error } = await sb.from("enterprises").delete().eq("id", btn.dataset.id);
      if (error) {
        alert("Couldn't delete: " + error.message);
      } else {
        if (selectedEnterpriseId === btn.dataset.id) {
          document.getElementById("plots-panel").style.display = "none";
        }
        loadEnterprises();
      }
    });
  });
}

async function loadPlots() {
  const listBox = document.getElementById("plots-list");
  listBox.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: plots, error } = await sb
    .from("crop_plots")
    .select("id, crop_name, planted_date, expected_harvest, status")
    .eq("enterprise_id", selectedEnterpriseId)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load plots: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!plots || plots.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-seedling"></i>
        <p>No plots logged yet for this enterprise.</p>
      </div>`;
    return;
  }

  const statusColor = { planned: "var(--grey)", growing: "var(--light-green)", harvested: "var(--electric-blue)" };

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Crop</th><th>Planted</th><th>Expected Harvest</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${plots.map(p => `
          <tr>
            <td>${escapeHtml(p.crop_name)}</td>
            <td>${escapeHtml(p.planted_date || "—")}</td>
            <td>${escapeHtml(p.expected_harvest || "—")}</td>
            <td><span class="badge" style="background:${statusColor[p.status]};color:white;">${escapeHtml(p.status)}</span></td>
            <td>
              <button class="secondary-btn delete-plot-btn" data-id="${escapeHtml(p.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".delete-plot-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this plot?")) return;
      const { error } = await sb.from("crop_plots").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadPlots();
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

  await loadFarmsForDropdown();
  await loadEnterprises();

  // ---- Add enterprise modal ----
  const entModal = document.getElementById("add-enterprise-modal");
  document.getElementById("open-add-enterprise").addEventListener("click", () => entModal.classList.add("active"));
  document.getElementById("cancel-add-enterprise").addEventListener("click", () => entModal.classList.remove("active"));

  document.getElementById("add-enterprise-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("enterprise-form-error");
    errorBox.textContent = "";

    const farm_id = document.getElementById("ent_farm").value;
    const name = document.getElementById("ent_name").value.trim();

    if (!farm_id) {
      errorBox.textContent = "Please select a farm.";
      return;
    }

    const { error } = await sb.from("enterprises").insert({ farm_id, name, type: "crop" });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    entModal.classList.remove("active");
    document.getElementById("add-enterprise-form").reset();
    loadEnterprises();
  });

  // ---- Add plot modal ----
  const plotModal = document.getElementById("add-plot-modal");
  document.getElementById("open-add-plot").addEventListener("click", () => {
    if (!selectedEnterpriseId) {
      alert("Select an enterprise first by clicking \"Manage Plots\".");
      return;
    }
    plotModal.classList.add("active");
  });
  document.getElementById("cancel-add-plot").addEventListener("click", () => plotModal.classList.remove("active"));

  document.getElementById("add-plot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("plot-form-error");
    errorBox.textContent = "";

    const crop_name = document.getElementById("plot_crop").value.trim();
    const planted_date = document.getElementById("plot_planted").value || null;
    const expected_harvest = document.getElementById("plot_harvest").value || null;
    const status = document.getElementById("plot_status").value;

    if (planted_date && expected_harvest && expected_harvest < planted_date) {
      errorBox.textContent = "Expected harvest can't be before the planting date.";
      return;
    }

    const { error } = await sb.from("crop_plots").insert({
      enterprise_id: selectedEnterpriseId,
      crop_name,
      planted_date,
      expected_harvest,
      status
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    plotModal.classList.remove("active");
    document.getElementById("add-plot-form").reset();
    loadPlots();
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();