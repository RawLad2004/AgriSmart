/*==========================================================
                    MARKET MODULE
==========================================================*/

let currentUserId = null;

/*==========================================================
                    TAB SWITCHING
==========================================================*/
function initTabs() {
  document.querySelectorAll(".market-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".market-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      document.getElementById("tab-prices").style.display = tab === "prices" ? "block" : "none";
      document.getElementById("tab-marketplace").style.display = tab === "marketplace" ? "block" : "none";
    });
  });
}

/*==========================================================
                    PRICE BOARD
==========================================================*/
async function loadPrices() {
  const listBox = document.getElementById("prices-list");

  const { data: prices, error } = await sb
    .from("market_prices")
    .select("id, commodity, county, price, unit, price_date, submitted_by")
    .order("price_date", { ascending: false })
    .limit(50);

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load prices: ${error.message}</p>`;
    return;
  }

  if (!prices || prices.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-chart-line"></i>
        <p>No prices submitted yet. Be the first to add one.</p>
      </div>`;
    return;
  }

  listBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Commodity</th><th>County</th><th>Price</th><th>Date</th><th></th></tr>
      </thead>
      <tbody>
        ${prices.map(p => `
          <tr>
            <td>${p.commodity}</td>
            <td>${p.county}</td>
            <td><strong>KES ${Number(p.price).toLocaleString()}</strong> / ${p.unit}</td>
            <td>${p.price_date}</td>
            <td>
              ${p.submitted_by === currentUserId ? `
                <button class="secondary-btn delete-price-btn" data-id="${p.id}" style="padding:8px 16px;font-size:.85rem;">
                  <i class="fa-solid fa-trash"></i>
                </button>` : ""}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll(".delete-price-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this price entry?")) return;
      const { error } = await sb.from("market_prices").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadPrices();
    });
  });
}

/*==========================================================
                    MARKETPLACE
==========================================================*/
async function loadListings() {
  const listBox = document.getElementById("listings-list");

  const { data: listings, error } = await sb
    .from("marketplace_listings")
    .select("id, commodity, quantity, unit, price, county, description, status, seller_id")
    .order("created_at", { ascending: false });

  if (error) {
    listBox.innerHTML = `<p class="form-error">Couldn't load listings: ${error.message}</p>`;
    return;
  }

  if (!listings || listings.length === 0) {
    listBox.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-store"></i>
        <p>No produce listed yet. Post the first one.</p>
      </div>`;
    return;
  }

  const statusColor = { available: "var(--light-green)", sold: "var(--grey)", expired: "var(--grey)" };

  listBox.innerHTML = `
    <div class="service-container">
      ${listings.map(l => `
        <div class="service-card" style="text-align:left;cursor:default;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <h3>${l.commodity}</h3>
            <span class="badge" style="background:${statusColor[l.status]};color:white;">${l.status}</span>
          </div>
          <p style="margin:12px 0;"><strong>${l.quantity} ${l.unit}</strong> available</p>
          <p style="margin-bottom:12px;color:var(--dark-green);font-weight:700;font-size:1.2rem;">KES ${Number(l.price).toLocaleString()} / ${l.unit}</p>
          <p style="font-size:.9rem;"><i class="fa-solid fa-location-dot"></i> ${l.county}</p>
          ${l.description ? `<p style="margin-top:10px;font-size:.9rem;">${l.description}</p>` : ""}
          ${l.seller_id === currentUserId ? `
            <button class="secondary-btn delete-listing-btn" data-id="${l.id}" style="margin-top:15px;padding:8px 16px;font-size:.85rem;">
              <i class="fa-solid fa-trash"></i> Remove Listing
            </button>` : ""}
        </div>
      `).join("")}
    </div>`;

  document.querySelectorAll(".delete-listing-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this listing?")) return;
      const { error } = await sb.from("marketplace_listings").delete().eq("id", btn.dataset.id);
      if (error) alert("Couldn't delete: " + error.message);
      else loadListings();
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

  initTabs();
  await loadPrices();
  await loadListings();

  // ---- Submit price ----
  const priceModal = document.getElementById("add-price-modal");
  document.getElementById("open-add-price").addEventListener("click", () => priceModal.classList.add("active"));
  document.getElementById("cancel-add-price").addEventListener("click", () => priceModal.classList.remove("active"));

  document.getElementById("add-price-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("price-form-error");
    errorBox.textContent = "";

    const { error } = await sb.from("market_prices").insert({
      commodity: document.getElementById("price_commodity").value.trim(),
      county: document.getElementById("price_county").value.trim(),
      price: document.getElementById("price_value").value,
      unit: document.getElementById("price_unit").value,
      submitted_by: currentUserId
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    priceModal.classList.remove("active");
    document.getElementById("add-price-form").reset();
    loadPrices();
  });

  // ---- Post listing ----
  const listingModal = document.getElementById("add-listing-modal");
  document.getElementById("open-add-listing").addEventListener("click", () => listingModal.classList.add("active"));
  document.getElementById("cancel-add-listing").addEventListener("click", () => listingModal.classList.remove("active"));

  document.getElementById("add-listing-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("listing-form-error");
    errorBox.textContent = "";

    const { error } = await sb.from("marketplace_listings").insert({
      seller_id: currentUserId,
      commodity: document.getElementById("listing_commodity").value.trim(),
      quantity: document.getElementById("listing_quantity").value,
      unit: document.getElementById("listing_unit").value,
      price: document.getElementById("listing_price").value,
      county: document.getElementById("listing_county").value.trim(),
      description: document.getElementById("listing_description").value.trim() || null
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    listingModal.classList.remove("active");
    document.getElementById("add-listing-form").reset();
    loadListings();
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();