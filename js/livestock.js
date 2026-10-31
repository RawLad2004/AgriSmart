/*==========================================================
                    LIVESTOCK MODULE
==========================================================*/

let currentUserId = null;
let userFarms = [];
let selectedEnterpriseId = null;
let currentAnimalsCache = [];
let selectedEnterpriseType = "livestock";

const LIVESTOCK_TYPES = ["livestock", "dairy", "poultry", "aquaculture", "apiary"];

/* Small DOM helpers: a missing element should never abort the whole page. */
function byId(id) {
  return document.getElementById(id);
}

function bindEvent(id, event, handler) {
  const el = byId(id);
  if (!el) {
    console.warn(`[livestock] Missing #${id}; skipped ${event} binding.`);
    return null;
  }
  el.addEventListener(event, handler);
  return el;
}


async function loadFarmsForDropdown() {
  const { data: farms, error } = await sb
    .from("farms")
    .select("id, name")
    .eq("owner_id", currentUserId)
    .order("name");

  if (error) {
    userFarms = [];
    const listBox = byId("enterprises-list");
    if (listBox) {
      listBox.innerHTML = `<p class="form-error">Couldn't load farms: ${escapeHtml(error.message)}</p>`;
    }
    return false;
  }

  userFarms = farms || [];

  const select = byId("ent_farm");
  if (select) {
    select.innerHTML = `<option value="">Select a farm…</option>` +
      userFarms.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join("");
  }

  return true;
}

async function loadEnterprises() {
  const listBox = byId("enterprises-list");
  if (!listBox) return;

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
    listBox.innerHTML = `<p class="form-error">Couldn't load enterprises: ${escapeHtml(error.message)}</p>`;
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
            <td>${escapeHtml(e.name)}</td>
            <td><span class="badge">${escapeHtml(e.type)}</span></td>
            <td>${escapeHtml(farmNameById[e.farm_id] || "—")}</td>
            <td>
              <button class="secondary-btn manage-animals-btn" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.name)}" data-type="${escapeHtml(e.type)}" style="padding:8px 16px;font-size:.85rem;">
                Manage Animals
              </button>
              <button class="secondary-btn delete-enterprise-btn" data-id="${escapeHtml(e.id)}" style="padding:8px 16px;font-size:.85rem;">
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
      selectedEnterpriseType = btn.dataset.type;
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
          selectedEnterpriseId = null;
          currentAnimalsCache = [];
          document.getElementById("animals-panel").style.display = "none";
        }
        loadEnterprises();
      }
    });
  });
}

async function loadAnimals() {
  const listBox = byId("animals-list");
  if (!listBox || !selectedEnterpriseId) return;
  listBox.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: animals, error } = await sb
    .from("livestock_animals")
    .select("id, species, breed, tag_id, dob, status")
    .eq("enterprise_id", selectedEnterpriseId)
    .order("created_at", { ascending: false });

  currentAnimalsCache = animals || [];

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load animals: ${escapeHtml(error.message)}</p>`;
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
            <td>${escapeHtml(a.species)}</td>
            <td>${escapeHtml(a.breed || "—")}</td>
            <td>${escapeHtml(a.tag_id || "—")}</td>
            <td>${escapeHtml(a.dob || "—")}</td>
            <td><span class="badge" style="background:${statusColor[a.status]};color:white;">${escapeHtml(a.status)}</span></td>
            <td>
              <button class="secondary-btn manage-records-btn" data-id="${escapeHtml(a.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-notes-medical"></i> Records
              </button>
              <button class="secondary-btn delete-animal-btn" data-id="${escapeHtml(a.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".manage-records-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const animal = currentAnimalsCache.find(a => a.id === btn.dataset.id);
      if (animal && typeof openAnimalRecordsModal === "function") {
        openAnimalRecordsModal(animal);
      }
    });
  });

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

  // Bind logout before anything else: a later feature failure must not
  // leave the user unable to sign out.
  bindEvent("logout-btn", "click", (e) => {
    e.preventDefault();
    signOut();
  });

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name")
    .eq("id", currentUserId)
    .single();

  const displayName = profile?.full_name || session.user.email;
  const userName = byId("user-name");
  const userAvatar = byId("user-avatar");
  if (userName) userName.textContent = displayName;
  if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();

  try {
    await initNotificationBell(currentUserId);
  } catch (err) {
    console.error("[livestock] Notifications failed to initialise:", err);
  }

  if (typeof initAnimalRecords === "function") {
    initAnimalRecords(currentUserId);
  } else {
    console.warn("[livestock] animal-records.js is not loaded; record tabs will be unavailable.");
  }

  const farmsLoaded = await loadFarmsForDropdown();
  if (farmsLoaded) {
    await loadEnterprises();
  }

  // ---- Species picker ----
  const speciesButton = bindEvent("open-species-picker", "click", () => {
    if (typeof openSpeciesPicker !== "function") return;
    openSpeciesPicker(selectedEnterpriseType, ({ species, breed }) => {
      const speciesInput = byId("animal_species");
      const breedInput = byId("animal_breed");
      if (speciesInput) speciesInput.value = species;
      if (breedInput && breed) breedInput.value = breed;
    });
  });
  if (speciesButton) speciesButton.setAttribute("aria-haspopup", "dialog");

  bindEvent("close-species-picker", "click", () => {
    byId("species-picker-modal")?.classList.remove("active");
  });

  // ---- Add enterprise modal ----
  const entModal = byId("add-enterprise-modal");

  bindEvent("open-add-enterprise", "click", () => {
    entModal?.classList.add("active");
  });
  bindEvent("cancel-add-enterprise", "click", () => entModal?.classList.remove("active"));

  bindEvent("add-enterprise-form", "submit", async (e) => {
    e.preventDefault();
    const errorBox = byId("enterprise-form-error");
    if (errorBox) errorBox.textContent = "";

    const farm_id = byId("ent_farm")?.value || "";
    const name = byId("ent_name")?.value.trim() || "";
    const type = byId("ent_type")?.value || "livestock";

    if (!farm_id) {
      if (errorBox) errorBox.textContent = "Please select a farm.";
      return;
    }
    if (!name) {
      if (errorBox) errorBox.textContent = "Please enter an enterprise name.";
      return;
    }

    const { error } = await sb.from("enterprises").insert({ farm_id, name, type });

    if (error) {
      if (errorBox) errorBox.textContent = error.message;
      return;
    }

    entModal?.classList.remove("active");
    byId("add-enterprise-form")?.reset();
    await loadEnterprises();
  });

  // ---- Add animal modal ----
  const animalModal = byId("add-animal-modal");

  bindEvent("open-add-animal", "click", () => {
    if (!selectedEnterpriseId) {
      alert("Select an enterprise first by clicking \"Manage Animals\".");
      return;
    }
    animalModal?.classList.add("active");
  });
  bindEvent("cancel-add-animal", "click", () => animalModal?.classList.remove("active"));

  bindEvent("add-animal-form", "submit", async (e) => {
    e.preventDefault();
    const errorBox = byId("animal-form-error");
    if (errorBox) errorBox.textContent = "";

    if (!selectedEnterpriseId) {
      if (errorBox) errorBox.textContent = "Select an enterprise first.";
      return;
    }

    const species = byId("animal_species")?.value.trim() || "";
    const breed = byId("animal_breed")?.value.trim() || null;
    const tag_id = byId("animal_tag")?.value.trim() || null;
    const dob = byId("animal_dob")?.value || null;
    const status = byId("animal_status")?.value || "active";

    if (!species) {
      if (errorBox) errorBox.textContent = "Please choose or enter a species.";
      return;
    }

    const { error } = await sb.from("livestock_animals").insert({
      enterprise_id: selectedEnterpriseId,
      species,
      breed,
      tag_id,
      dob,
      status
    });

    if (error) {
      if (errorBox) errorBox.textContent = error.message;
      return;
    }

    animalModal?.classList.remove("active");
    byId("add-animal-form")?.reset();
    await loadAnimals();
  });

})();
