/*==========================================================
                    FINANCES MODULE
==========================================================*/

let currentUserId = null;
let userFarms = [];
let selectedFarmId = null;

async function loadFinancesForFarm(farmId) {
  const box = document.getElementById("finances-content");
  box.innerHTML = `<p style="color:var(--dark-grey);">Loading…</p>`;

  const { data: txns, error } = await sb
    .from("transactions")
    .select("id, type, category, amount, txn_date, note")
    .eq("farm_id", farmId)
    .order("txn_date", { ascending: false });

  if (error) {
    box.innerHTML = `<p class="form-error">Couldn't load transactions: ${error.message}</p>`;
    return;
  }

  const income = (txns || []).filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = (txns || []).filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const net = income - expenses;

  const summaryHtml = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total Income</div>
        <div class="stat-value" style="color:var(--primary-green);">KES ${income.toLocaleString()}</div>
      </div>
      <div class="stat-card" style="border-left-color:#d32f2f;">
        <div class="stat-label">Total Expenses</div>
        <div class="stat-value" style="color:#d32f2f;">KES ${expenses.toLocaleString()}</div>
      </div>
      <div class="stat-card" style="border-left-color:var(--electric-blue);">
        <div class="stat-label">Net</div>
        <div class="stat-value" style="color:${net >= 0 ? 'var(--dark-green)' : '#d32f2f'};">KES ${net.toLocaleString()}</div>
      </div>
    </div>`;

  if (!txns || txns.length === 0) {
    box.innerHTML = summaryHtml + `
      <div class="panel">
        <div class="empty-state">
          <i class="fa-solid fa-wallet"></i>
          <p>No transactions logged yet for this farm.</p>
        </div>
      </div>`;
    return;
  }

  const tableHtml = `
    <div class="panel">
      <div class="panel-header">
        <h2>Transaction Log</h2>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Note</th><th></th></tr>
        </thead>
        <tbody>
          ${txns.map(t => `
            <tr>
              <td>${t.txn_date}</td>
              <td><span class="badge" style="background:${t.type === 'income' ? 'var(--light-green)' : '#f5c6c6'};color:${t.type === 'income' ? 'var(--dark-green)' : '#8a1c1c'};">${t.type}</span></td>
              <td>${t.category}</td>
              <td>${t.type === 'income' ? '+' : '-'} KES ${Number(t.amount).toLocaleString()}</td>
              <td>${t.note || "—"}</td>
              <td>
                <button class="secondary-btn delete-txn-btn" data-id="${t.id}" style="padding:8px 16px;font-size:.85rem;">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

  box.innerHTML = summaryHtml + tableHtml;

  document.querySelectorAll(".delete-txn-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this transaction?")) return;
      const { error } = await sb.from("transactions").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadFinancesForFarm(selectedFarmId);
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

  const { data: farms } = await sb
    .from("farms")
    .select("id, name")
    .eq("owner_id", currentUserId)
    .order("name");

  userFarms = farms || [];

  const select = document.getElementById("farm-select");

  if (userFarms.length === 0) {
    document.getElementById("finances-content").innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>Add a farm first, then come back to track its finances.</p>
        <a href="farms.html" class="primary-btn" style="display:inline-block;margin-top:20px;">Go to My Farms</a>
      </div>`;
  } else {
    select.innerHTML = `<option value="">Select a farm…</option>` +
      userFarms.map(f => `<option value="${f.id}">${f.name}</option>`).join("");

    select.addEventListener("change", () => {
      selectedFarmId = select.value || null;
      if (selectedFarmId) loadFinancesForFarm(selectedFarmId);
    });

    selectedFarmId = userFarms[0].id;
    select.value = selectedFarmId;
    loadFinancesForFarm(selectedFarmId);
  }

  // ---- Add transaction modal ----
  const modal = document.getElementById("add-txn-modal");
  document.getElementById("open-add-txn").addEventListener("click", () => {
    if (!selectedFarmId) {
      alert("Select a farm first.");
      return;
    }
    document.getElementById("txn_date").value = new Date().toISOString().split("T")[0];
    modal.classList.add("active");
  });
  document.getElementById("cancel-add-txn").addEventListener("click", () => modal.classList.remove("active"));

  document.getElementById("add-txn-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("txn-form-error");
    errorBox.textContent = "";

    const { error } = await sb.from("transactions").insert({
      farm_id: selectedFarmId,
      type: document.getElementById("txn_type").value,
      category: document.getElementById("txn_category").value.trim(),
      amount: document.getElementById("txn_amount").value,
      txn_date: document.getElementById("txn_date").value,
      note: document.getElementById("txn_note").value.trim() || null
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    modal.classList.remove("active");
    document.getElementById("add-txn-form").reset();
    loadFinancesForFarm(selectedFarmId);
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();