/*==========================================================
                WEATHER CLIENT
    Uses OpenWeatherMap (free tier: 1,000 calls/day,
    60 calls/minute). OPENWEATHER_API_KEY is defined in
    js/config.js, which is NOT committed to Git — see
    .gitignore. Make sure config.js is loaded before this
    file in every page's <script> tags.
==========================================================*/

const CACHE_MAX_AGE_MINUTES = 30;

/*==========================================================
    getWeatherForLocation(locationQuery)
    locationQuery: a place name, e.g. a farm's county
    ("Nakuru") — OpenWeatherMap resolves this to coordinates
    itself via its "q" parameter.

    Checks Supabase weather_cache first; only calls the
    live API if the cached entry is missing or stale.
==========================================================*/
async function getWeatherForLocation(locationQuery) {
  const key = locationQuery.trim().toLowerCase();

  // ---- 1. Try cache ----
  const { data: cached } = await sb
    .from("weather_cache")
    .select("payload, fetched_at")
    .eq("location_key", key)
    .maybeSingle();

  if (cached) {
    const ageMinutes = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000;
    if (ageMinutes < CACHE_MAX_AGE_MINUTES) {
      return cached.payload;
    }
  }

  // ---- 2. Fetch fresh from OpenWeatherMap ----
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(locationQuery)}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(locationQuery)}&units=metric&appid=${OPENWEATHER_API_KEY}`;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(currentUrl),
    fetch(forecastUrl)
  ]);

  if (!currentRes.ok) {
    const err = await currentRes.json().catch(() => ({}));
    throw new Error(err.message || `Weather lookup failed for "${locationQuery}"`);
  }

  const current = await currentRes.json();
  const forecastRaw = forecastRes.ok ? await forecastRes.json() : null;

  const payload = {
    current: {
      temp: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      wind_speed: current.wind.speed,
      description: current.weather[0].description,
      icon: current.weather[0].icon,
      rain_expected: !!current.rain
    },
    daily_forecast: forecastRaw ? summarizeToDaily(forecastRaw.list) : [],
    location_name: current.name || locationQuery
  };

  // ---- 3. Save to cache (upsert) ----
  await sb.from("weather_cache").upsert({
    location_key: key,
    fetched_at: new Date().toISOString(),
    payload
  }, { onConflict: "location_key" });

  return payload;
}

/*==========================================================
    summarizeToDaily(list)
    OpenWeatherMap's free forecast endpoint returns 3-hour
    steps for 5 days. Collapse that into one min/max/icon
    per calendar day for a clean 5-day strip.
==========================================================*/
function summarizeToDaily(list) {
  const byDay = {};

  list.forEach(entry => {
    const date = entry.dt_txt.split(" ")[0];
    if (!byDay[date]) {
      byDay[date] = { temps: [], icon: entry.weather[0].icon, rain: false };
    }
    byDay[date].temps.push(entry.main.temp);
    if (entry.rain) byDay[date].rain = true;
    // prefer a midday icon if available for a more representative look
    if (entry.dt_txt.includes("12:00:00")) {
      byDay[date].icon = entry.weather[0].icon;
    }
  });

  return Object.entries(byDay).slice(0, 5).map(([date, info]) => ({
    date,
    min: Math.round(Math.min(...info.temps)),
    max: Math.round(Math.max(...info.temps)),
    icon: info.icon,
    rain: info.rain
  }));
}

function weatherIconUrl(icon) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}