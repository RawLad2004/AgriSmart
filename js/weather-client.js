/*==========================================================
                WEATHER CLIENT
    Weather is fetched through the "weather" Supabase Edge
    Function (supabase/functions/weather). The OpenWeatherMap
    API key lives only on the server as a secret - it is NOT
    in any browser file. The function also owns the shared
    30-minute cache, so browsers cannot write to weather_cache.
==========================================================*/

/*==========================================================
    getWeatherForLocation(locationQuery)
    locationQuery: a place name, e.g. a farm's county ("Nakuru").
    Returns the weather payload:
      { current: {...}, daily_forecast: [...], location_name }
==========================================================*/
async function getWeatherForLocation(locationQuery) {
  const { data, error } = await sb.functions.invoke("weather", {
    body: { location: String(locationQuery || "").trim() }
  });

  if (error) {
    // For non-2xx responses the function's JSON error body is on error.context.
    let message = `Weather lookup failed for "${locationQuery}"`;
    try {
      const body = await error.context.json();
      if (body && body.error) message = body.error;
    } catch (e) { /* keep the generic message */ }
    throw new Error(message);
  }

  if (!data || data.error) {
    throw new Error((data && data.error) || `Weather lookup failed for "${locationQuery}"`);
  }

  return data;
}

function weatherIconUrl(icon) {
  // Icon codes look like "10d" / "01n". Anything else (e.g. a tampered cache
  // entry) falls back to a neutral default so it can never inject a URL.
  const safeIcon = /^[0-9]{2}[dn]$/.test(String(icon)) ? icon : "03d";
  return `https://openweathermap.org/img/wn/${safeIcon}@2x.png`;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}