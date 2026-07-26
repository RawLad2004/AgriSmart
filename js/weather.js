/*==========================================================
                    WEATHER PAGE
==========================================================*/

let currentUserId = null;
let userFarms = [];

function renderWeather(payload, farmName) {
  const box = document.getElementById("weather-content");
  const c = payload.current;

  const rainBanner = c.rain_expected ? `
    <div class="alert-banner">
      <i class="fa-solid fa-triangle-exclamation"></i>
      Rain is expected right now near ${farmName}. Plan field work and spraying accordingly.
    </div>` : "";

  box.innerHTML = `
    ${rainBanner}

    <div class="weather-hero">
      <div>
        <div class="wh-location">${farmName} — ${payload.location_name}</div>
        <div class="wh-temp">${c.temp}°C</div>
        <div class="wh-desc">${c.description}</div>
      </div>
      <img class="wh-icon" src="${weatherIconUrl(c.icon)}" alt="${c.description}">
      <div class="weather-meta-grid">
        <div>
          <div class="meta-label">Feels Like</div>
          <div class="meta-value">${c.feels_like}°C</div>
        </div>
        <div>
          <div class="meta-label">Humidity</div>
          <div class="meta-value">${c.humidity}%</div>
        </div>
        <div>
          <div class="meta-label">Wind</div>
          <div class="meta-value">${c.wind_speed} m/s</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>5-Day Forecast</h2>
      </div>
      <div class="forecast-strip">
        ${payload.daily_forecast.map(d => `
          <div class="forecast-day">
            <div class="fd-label">${formatDayLabel(d.date)}</div>
            <img src="${weatherIconUrl(d.icon)}" alt="">
            <div class="fd-temps"><strong>${d.max}°</strong> / ${d.min}°</div>
            ${d.rain ? '<div style="margin-top:8px;color:var(--electric-blue);font-size:.8rem;"><i class="fa-solid fa-droplet"></i> Rain</div>' : ""}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="panel" id="equipment-suggestions-panel">
      <div class="panel-header">
        <h2>Recommended For This Week's Weather</h2>
      </div>
      <div id="equipment-suggestions-list">
        <p style="color:var(--dark-grey);">Checking the marketplace for matches…</p>
      </div>
    </div>
  `;

  renderEquipmentSuggestions(payload);
}

/*==========================================================
    renderEquipmentSuggestions(payload)
    Runs the rule engine (js/equipment-suggestions.js) against
    the current weather payload, then checks the marketplace
    for a live match on each suggested item so a card can
    either deep-link to an existing listing or offer a
    one-click want-ad shortcut.
==========================================================*/
async function renderEquipmentSuggestions(payload) {
  const box = document.getElementById("equipment-suggestions-list");
  const suggestions = getEquipmentSuggestions(payload);

  if (suggestions.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check"></i>
        <p>Nothing unusual in this week's forecast — no extra equipment needed right now.</p>
      </div>`;
    return;
  }

  const withMatches = await Promise.all(suggestions.map(async (s) => {
    const { data } = await sb
      .from("marketplace_listings")
      .select("id")
      .ilike("commodity", `%${s.item}%`)
      .eq("status", "available")
      .limit(1);
    return { ...s, hasMatch: !!(data && data.length) };
  }));

  box.innerHTML = `
    <div class="service-container">
      ${withMatches.map(s => `
        <a class="equipment-card" href="market.html?tab=marketplace&search=${encodeURIComponent(s.item)}${s.hasMatch ? "" : "&prefill=1"}"
           style="text-decoration:none;color:inherit;display:block;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <i class="${s.icon}" style="font-size:1.3rem;color:var(--primary-green);"></i>
            <strong>${s.item}</strong>
          </div>
          <p style="font-size:.9rem;color:var(--dark-grey);margin-bottom:12px;">${s.reason}</p>
          <span class="badge" style="background:${s.hasMatch ? "var(--light-green)" : "var(--electric-blue)"};color:white;">
            ${s.hasMatch ? "Available in Marketplace" : "Post a want-ad"}
          </span>
        </a>
      `).join("")}
    </div>`;
}

async function loadWeatherForFarm(farm) {
  const box = document.getElementById("weather-content");
  box.innerHTML = `<p style="color:var(--dark-grey);">Fetching weather for ${farm.name}…</p>`;

  if (!farm.county) {
    box.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-location-dot"></i>
        <p>${farm.name} doesn't have a county set — add one on the Farms page so we can look up its weather.</p>
      </div>`;
    return;
  }

  try {
    const payload = await getWeatherForLocation(farm.county);
    renderWeather(payload, farm.name);

    if (payload.current.rain_expected) {
      pushNotificationOnce(
        currentUserId,
        "weather",
        `Rain expected at ${farm.name}`,
        `Current conditions near ${farm.county}: ${payload.current.description}. Plan field work accordingly.`
      );
    }
  } catch (err) {
    box.innerHTML = `<p class="form-error">Couldn't fetch weather: ${err.message}</p>`;
  }
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
    .select("id, name, county")
    .eq("owner_id", currentUserId)
    .order("name");

  userFarms = farms || [];

  const select = document.getElementById("farm-select");

  if (userFarms.length === 0) {
    document.getElementById("weather-content").innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-tractor"></i>
        <p>Add a farm first, then come back to see its weather.</p>
        <a href="farms.html" class="primary-btn" style="display:inline-block;margin-top:20px;">Go to My Farms</a>
      </div>`;
  } else {
    select.innerHTML = `<option value="">Select a farm…</option>` +
      userFarms.map(f => `<option value="${f.id}">${f.name}</option>`).join("");

    select.addEventListener("change", () => {
      const farm = userFarms.find(f => f.id === select.value);
      if (farm) loadWeatherForFarm(farm);
    });

    // Auto-load the first farm
    select.value = userFarms[0].id;
    loadWeatherForFarm(userFarms[0]);
  }

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();