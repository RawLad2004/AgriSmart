/*==========================================================
                    LIVESTOCK MODULE
==========================================================*/

let currentUserId = null;
let userFarms = [];
let selectedEnterpriseId = null;

const LIVESTOCK_TYPES = ["livestock", "dairy", "poultry", "aquaculture", "apiary"];

async function loadFarmsForDropdown() {
  const { data: farms } = await sb
    .from("farms")
    .select("id, name")
    .eq("owner_id", currentUserId)
    .order("name");

  userFarms = farms || [];

  const select = document.getElementById("ent_farm");
  select.innerHTML = `<option value="">Select a farm…</option>` +
    userFarms.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
}

async function loadEnterprises() {
  const listBox = document.getElementById("enterprises-list");

  if (userFarms.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>Add a farm first, then come back to create a livestock enterprise.</p>
        <a href="farms.html" class="primary-btn" style="display:inline-block;margin-top:20px;">Go to My Farms</a>
      </div>`;
    return;
  }

  const farmIds = userFarms.map(f => f.id);

  const { data: enterprises, error } = await sb
    .from("enterprises")
    .select("id, name, type, farm_id, created_at")
    .in("type", LIVESTOCK_TYPES)
    .in("farm_id", farmIds)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load enterprises: ${error.message}</p>`;
    return;
  }

  if (!enterprises || enterprises.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-cow"></i>
        <p>No livestock enterprises yet. Add one to start tracking animals.</p>
      </div>`;
    return;
  }

  const farmNameById = Object.fromEntries(userFarms.map(f => [f.id, f.name]));

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Enterprise</th><th>Type</th><th>Farm</th><th></th></tr>
      </thead>
      <tbody>
        ${enterprises.map(e => `
          <tr>
            <td>${e.name}</td>
            <td><span class="badge">${e.type}</span></td>
            <td>${farmNameById[e.farm_id] || "—"}</td>
            <td>
              <button class="secondary-btn manage-animals-btn" data-id="${e.id}" data-name="${e.name}" style="padding:8px 16px;font-size:.85rem;">
                Manage Animals
              </button>
              <button class="secondary-btn delete-enterprise-btn" data-id="${e.id}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".manage-animals-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedEnterpriseId = btn.dataset.id;
      document.getElementById("animals-panel-title").textContent = `Animals — ${btn.dataset.name}`;
      document.getElementById("animals-panel").style.display = "block";
      loadAnimals();
      document.getElementById("animals-panel").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".delete-enterprise-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this enterprise and all its animal records?")) return;
      const { error } = await sb.from("enterprises").delete().eq("id", btn.dataset.id);
      if (error) {
        alert("Couldn't delete: " + error.message);
      } else {
        if (selectedEnterpriseId === btn.dataset.id) {
          document.getElementById("animals-panel").style.display = "none";
        }
        loadEnterprises();
      }
    });
  });
}

async function loadAnimals() {
  const listBox = document.getElementById("animals-list");
  listBox.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: animals, error } = await sb
    .from("livestock_animals")
    .select("id, species, breed, tag_id, dob, status")
    .eq("enterprise_id", selectedEnterpriseId)
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load animals: ${error.message}</p>`;
    return;
  }

  if (!animals || animals.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-cow"></i>
        <p>No animals logged yet for this enterprise.</p>
      </div>`;
    return;
  }

  const statusColor = { active: "var(--light-green)", sold: "var(--electric-blue)", deceased: "var(--grey)" };

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Species</th><th>Breed</th><th>Tag ID</th><th>DOB</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${animals.map(a => `
          <tr>
            <td>${a.species}</td>
            <td>${a.breed || "—"}</td>
            <td>${a.tag_id || "—"}</td>
            <td>${a.dob || "—"}</td>
            <td><span class="badge" style="background:${statusColor[a.status]};color:white;">${a.status}</span></td>
            <td>
              <button class="secondary-btn delete-animal-btn" data-id="${a.id}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".delete-animal-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this animal record?")) return;
      const { error } = await sb.from("livestock_animals").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadAnimals();
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
    const type = document.getElementById("ent_type").value;

    if (!farm_id) {
      errorBox.textContent = "Please select a farm.";
      return;
    }

    const { error } = await sb.from("enterprises").insert({ farm_id, name, type });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    entModal.classList.remove("active");
    document.getElementById("add-enterprise-form").reset();
    loadEnterprises();
  });

  // ---- Add animal modal ----
  const animalModal = document.getElementById("add-animal-modal");
  document.getElementById("open-add-animal").addEventListener("click", () => {
    if (!selectedEnterpriseId) {
      alert("Select an enterprise first by clicking \"Manage Animals\".");
      return;
    }
    animalModal.classList.add("active");
  });
  document.getElementById("cancel-add-animal").addEventListener("click", () => animalModal.classList.remove("active"));

  document.getElementById("add-animal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("animal-form-error");
    errorBox.textContent = "";

    const species = document.getElementById("animal_species").value.trim();
    const breed = document.getElementById("animal_breed").value.trim() || null;
    const tag_id = document.getElementById("animal_tag").value.trim() || null;
    const dob = document.getElementById("animal_dob").value || null;
    const status = document.getElementById("animal_status").value;

    const { error } = await sb.from("livestock_animals").insert({
      enterprise_id: selectedEnterpriseId,
      species,
      breed,
      tag_id,
      dob,
      status
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    animalModal.classList.remove("active");
    document.getElementById("add-animal-form").reset();
    loadAnimals();
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();