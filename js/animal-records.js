/*==========================================================
                ANIMAL RECORDS MODULE
    Per-animal record-keeping: feed logs, vaccinations,
    general health records, and growth (weight) records.
    Opened from the animals list on the Livestock page via
    openAnimalRecordsModal(animal). Needs #animal-records-modal
    markup (see dashboard/livestock.html) and must load after
    supabase-client.js + notifications.js.
==========================================================*/

let _recordsUserId = null;
let _recordsAnimalId = null;

function initAnimalRecords(userId) {
  _recordsUserId = userId;
}

const RECORD_TABS = ["feed", "vaccinations", "health", "growth"];

function switchRecordTab(tab) {
  RECORD_TABS.forEach(t => {
    document.getElementById(`record-tab-${t}`).style.display = (t === tab) ? "block" : "none";
  });
  document.querySelectorAll(".record-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.recordTab === tab);
  });
}

function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

async function openAnimalRecordsModal(animal) {
  _recordsAnimalId = animal.id;
  document.getElementById("animal-records-title").textContent = `Records — ${animal.species}${animal.tag_id ? " (" + animal.tag_id + ")" : ""}`;
  document.getElementById("animal-records-modal").classList.add("active");

  switchRecordTab("feed");
  await Promise.all([
    loadFeedLogs(),
    loadVaccinations(),
    loadHealthRecords(),
    loadGrowthRecords()
  ]);
}

function closeAnimalRecordsModal() {
  document.getElementById("animal-records-modal").classList.remove("active");
  _recordsAnimalId = null;
}

/*==========================================================
                    FEED LOGS
==========================================================*/
async function loadFeedLogs() {
  const box = document.getElementById("feed-logs-list");
  box.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: logs, error } = await sb
    .from("animal_feed_logs")
    .select("id, feed_type, quantity, unit, feeding_date, cost, notes")
    .eq("animal_id", _recordsAnimalId)
    .order("feeding_date", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-error">Couldn't load feed logs: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!logs || logs.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-wheat-awn"></i>
        <p>No feed records logged yet for this animal.</p>
      </div>`;
    return;
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCost = logs
    .filter(l => l.feeding_date && l.feeding_date.slice(0, 7) === thisMonth && l.cost)
    .reduce((sum, l) => sum + Number(l.cost), 0);

  box.innerHTML = `
    <div class="stat-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-label">Feed Cost This Month</div>
        <div class="stat-value">KES ${monthCost.toLocaleString()}</div>
      </div>
    </div>
    <table class="data-table">
      <thead>
        <tr><th>Date</th><th>Feed</th><th>Qty</th><th>Cost</th><th></th></tr>
      </thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td>${escapeHtml(l.feeding_date)}</td>
            <td>${escapeHtml(l.feed_type)}</td>
            <td>${escapeHtml(l.quantity)} ${escapeHtml(l.unit)}</td>
            <td>${l.cost ? "KES " + Number(l.cost).toLocaleString() : "—"}</td>
            <td>
              <button class="secondary-btn delete-feed-log-btn" data-id="${escapeHtml(l.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  box.querySelectorAll(".delete-feed-log-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this feed record?")) return;
      const { error } = await sb.from("animal_feed_logs").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadFeedLogs();
    });
  });
}

/*==========================================================
                    VACCINATIONS
==========================================================*/
async function loadVaccinations() {
  const box = document.getElementById("vaccinations-list");
  box.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: vaccinations, error } = await sb
    .from("animal_vaccinations")
    .select("id, vaccine_name, date_administered, next_due_date, dosage, administered_by, notes")
    .eq("animal_id", _recordsAnimalId)
    .order("date_administered", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-error">Couldn't load vaccinations: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!vaccinations || vaccinations.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-syringe"></i>
        <p>No vaccinations logged yet for this animal.</p>
      </div>`;
    return;
  }

  box.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Vaccine</th><th>Given</th><th>Next Due</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${vaccinations.map(v => {
          const daysOut = daysFromToday(v.next_due_date);
          let statusHtml = "—";
          if (daysOut !== null) {
            if (daysOut < 0) statusHtml = `<span class="badge" style="background:#d32f2f;color:white;">Overdue</span>`;
            else if (daysOut <= 14) statusHtml = `<span class="badge" style="background:#f9a825;color:white;">Due soon</span>`;
            else statusHtml = `<span class="badge" style="background:var(--light-green);color:white;">Scheduled</span>`;
          }
          return `
            <tr>
              <td>${escapeHtml(v.vaccine_name)}</td>
              <td>${escapeHtml(v.date_administered)}</td>
              <td>${escapeHtml(v.next_due_date || "—")}</td>
              <td>${statusHtml}</td>
              <td>
                <button class="secondary-btn delete-vaccination-btn" data-id="${escapeHtml(v.id)}" style="padding:8px 16px;font-size:.85rem;">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  box.querySelectorAll(".delete-vaccination-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this vaccination record?")) return;
      const { error } = await sb.from("animal_vaccinations").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadVaccinations();
    });
  });

  // ---- Due/overdue notifications ----
  vaccinations.forEach(v => {
    const daysOut = daysFromToday(v.next_due_date);
    if (daysOut === null || !_recordsUserId) return;
    if (daysOut < 0) {
      pushNotificationOnce(
        _recordsUserId,
        "vaccination",
        `Overdue: ${v.vaccine_name}`,
        `${v.vaccine_name} was due on ${v.next_due_date} and hasn't been logged as given again.`
      );
    } else if (daysOut <= 14) {
      pushNotificationOnce(
        _recordsUserId,
        "vaccination",
        `Due soon: ${v.vaccine_name}`,
        `${v.vaccine_name} is due on ${v.next_due_date}.`
      );
    }
  });
}

/*==========================================================
                    HEALTH RECORDS
==========================================================*/
async function loadHealthRecords() {
  const box = document.getElementById("health-records-list");
  box.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: records, error } = await sb
    .from("animal_health_records")
    .select("id, record_type, description, date_recorded, treatment_given, vet_name, cost, follow_up_date")
    .eq("animal_id", _recordsAnimalId)
    .order("date_recorded", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-error">Couldn't load health records: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!records || records.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-notes-medical"></i>
        <p>No health records logged yet for this animal.</p>
      </div>`;
    return;
  }

  const typeLabel = {
    illness: "Illness", treatment: "Treatment", injury: "Injury",
    checkup: "Checkup", deworming: "Deworming", other: "Other"
  };

  box.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Date</th><th>Type</th><th>Description</th><th>Follow-up</th><th></th></tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td>${escapeHtml(r.date_recorded)}</td>
            <td><span class="badge">${escapeHtml(typeLabel[r.record_type] || r.record_type)}</span></td>
            <td>${escapeHtml(r.description)}</td>
            <td>${escapeHtml(r.follow_up_date || "—")}</td>
            <td>
              <button class="secondary-btn delete-health-record-btn" data-id="${escapeHtml(r.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  box.querySelectorAll(".delete-health-record-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this health record?")) return;
      const { error } = await sb.from("animal_health_records").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadHealthRecords();
    });
  });
}

/*==========================================================
                    GROWTH RECORDS
==========================================================*/
async function loadGrowthRecords() {
  const box = document.getElementById("growth-records-list");
  box.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: records, error } = await sb
    .from("animal_growth_records")
    .select("id, weight_kg, date_recorded, notes")
    .eq("animal_id", _recordsAnimalId)
    .order("date_recorded", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-error">Couldn't load growth records: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!records || records.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-weight-scale"></i>
        <p>No weight records logged yet for this animal.</p>
      </div>`;
    return;
  }

  box.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Date</th><th>Weight</th><th>Notes</th><th></th></tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td>${escapeHtml(r.date_recorded)}</td>
            <td>${escapeHtml(r.weight_kg)} kg</td>
            <td>${escapeHtml(r.notes || "—")}</td>
            <td>
              <button class="secondary-btn delete-growth-record-btn" data-id="${escapeHtml(r.id)}" style="padding:8px 16px;font-size:.85rem;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  box.querySelectorAll(".delete-growth-record-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this weight record?")) return;
      const { error } = await sb.from("animal_growth_records").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadGrowthRecords();
    });
  });
}

/*==========================================================
                    FORM WIRING (runs once on page load)
==========================================================*/
document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll(".record-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchRecordTab(btn.dataset.recordTab));
  });

  const closeBtn = document.getElementById("close-animal-records");
  if (closeBtn) closeBtn.addEventListener("click", closeAnimalRecordsModal);

  // ---- Add feed log ----
  const feedForm = document.getElementById("add-feed-log-form");
  if (feedForm) {
    document.getElementById("open-add-feed-log").addEventListener("click", () => {
      document.getElementById("add-feed-log-panel").style.display = "block";
    });
    feedForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("feed-log-form-error");
      errorBox.textContent = "";

      const { error } = await sb.from("animal_feed_logs").insert({
        animal_id: _recordsAnimalId,
        feed_type: document.getElementById("feed_type").value.trim(),
        quantity: document.getElementById("feed_quantity").value,
        unit: document.getElementById("feed_unit").value,
        feeding_date: document.getElementById("feed_date").value || new Date().toISOString().slice(0, 10),
        cost: document.getElementById("feed_cost").value || null
      });

      if (error) { errorBox.textContent = error.message; return; }

      feedForm.reset();
      document.getElementById("add-feed-log-panel").style.display = "none";
      loadFeedLogs();
    });
  }

  // ---- Add vaccination ----
  const vaccForm = document.getElementById("add-vaccination-form");
  if (vaccForm) {
    document.getElementById("open-add-vaccination").addEventListener("click", () => {
      document.getElementById("add-vaccination-panel").style.display = "block";
    });
    vaccForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("vaccination-form-error");
      errorBox.textContent = "";

      const { error } = await sb.from("animal_vaccinations").insert({
        animal_id: _recordsAnimalId,
        vaccine_name: document.getElementById("vaccine_name").value.trim(),
        date_administered: document.getElementById("vaccine_date").value || new Date().toISOString().slice(0, 10),
        next_due_date: document.getElementById("vaccine_next_due").value || null,
        dosage: document.getElementById("vaccine_dosage").value.trim() || null,
        administered_by: document.getElementById("vaccine_administered_by").value.trim() || null
      });

      if (error) { errorBox.textContent = error.message; return; }

      vaccForm.reset();
      document.getElementById("add-vaccination-panel").style.display = "none";
      loadVaccinations();
    });
  }

  // ---- Add health record ----
  const healthForm = document.getElementById("add-health-record-form");
  if (healthForm) {
    document.getElementById("open-add-health-record").addEventListener("click", () => {
      document.getElementById("add-health-record-panel").style.display = "block";
    });
    healthForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("health-record-form-error");
      errorBox.textContent = "";

      const { error } = await sb.from("animal_health_records").insert({
        animal_id: _recordsAnimalId,
        record_type: document.getElementById("health_type").value,
        description: document.getElementById("health_description").value.trim(),
        date_recorded: document.getElementById("health_date").value || new Date().toISOString().slice(0, 10),
        treatment_given: document.getElementById("health_treatment").value.trim() || null,
        vet_name: document.getElementById("health_vet").value.trim() || null,
        cost: document.getElementById("health_cost").value || null,
        follow_up_date: document.getElementById("health_follow_up").value || null
      });

      if (error) { errorBox.textContent = error.message; return; }

      healthForm.reset();
      document.getElementById("add-health-record-panel").style.display = "none";
      loadHealthRecords();
    });
  }

  // ---- Add growth record ----
  const growthForm = document.getElementById("add-growth-record-form");
  if (growthForm) {
    document.getElementById("open-add-growth-record").addEventListener("click", () => {
      document.getElementById("add-growth-record-panel").style.display = "block";
    });
    growthForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("growth-record-form-error");
      errorBox.textContent = "";

      const { error } = await sb.from("animal_growth_records").insert({
        animal_id: _recordsAnimalId,
        weight_kg: document.getElementById("growth_weight").value,
        date_recorded: document.getElementById("growth_date").value || new Date().toISOString().slice(0, 10),
        notes: document.getElementById("growth_notes").value.trim() || null
      });

      if (error) { errorBox.textContent = error.message; return; }

      growthForm.reset();
      document.getElementById("add-growth-record-panel").style.display = "none";
      loadGrowthRecords();
    });
  }

});
