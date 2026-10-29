// Supabase Edge Function: weather
// Server-side proxy for OpenWeatherMap so the API key never reaches the browser.
//
// Deploy:   supabase functions deploy weather
// Secret:   supabase secrets set OPENWEATHER_API_KEY=your-new-key
// Call:     sb.functions.invoke("weather", { body: { location: "Nakuru" } })
//
// Only signed-in users can call it (JWT verification is on by default).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CACHE_MAX_AGE_MINUTES = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Letters (any language), digits, spaces and a few punctuation marks; 2-80 chars.
const LOCATION_PATTERN = /^[\p{L}\p{M}0-9 .,'’-]{2,80}$/u;

function summarizeToDaily(list: any[]) {
  const byDay: Record<string, { temps: number[]; icon: string; rain: boolean; pop: number }> = {};

  for (const entry of list) {
    const date = String(entry.dt_txt).split(" ")[0];
    if (!byDay[date]) {
      byDay[date] = { temps: [], icon: entry.weather[0].icon, rain: false, pop: 0 };
    }
    const day = byDay[date];
    day.temps.push(entry.main.temp);
    if (entry.rain) day.rain = true;
    if (typeof entry.pop === "number") day.pop = Math.max(day.pop, entry.pop);
    if (String(entry.dt_txt).includes("12:00:00")) day.icon = entry.weather[0].icon;
  }

  return Object.entries(byDay).slice(0, 5).map(([date, d]) => ({
    date,
    min: Math.round(Math.min(...d.temps)),
    max: Math.round(Math.max(...d.temps)),
    icon: d.icon,
    // "Rain" if rainfall is forecast OR the chance of rain is 50% or more.
    rain: d.rain || d.pop >= 0.5,
    rain_probability: Math.round(d.pop * 100),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) return json({ error: "Weather service is not configured." }, 500);

  let location = "";
  try {
    const body = await req.json();
    location = String(body?.location ?? "").trim();
  } catch (_e) {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!LOCATION_PATTERN.test(location)) {
    return json({ error: "Please provide a valid place name." }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cacheKey = location.toLowerCase();

  // 1. Fresh cache hit?
  const { data: cached } = await admin
    .from("weather_cache")
    .select("payload, fetched_at")
    .eq("location_key", cacheKey)
    .maybeSingle();

  if (cached) {
    const ageMinutes = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000;
    if (ageMinutes < CACHE_MAX_AGE_MINUTES) return json(cached.payload);
  }

  // 2. Fetch fresh data from OpenWeatherMap.
  const q = encodeURIComponent(location);
  const base = "https://api.openweathermap.org/data/2.5";
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${base}/weather?q=${q}&units=metric&appid=${apiKey}`),
    fetch(`${base}/forecast?q=${q}&units=metric&appid=${apiKey}`),
  ]);

  if (!currentRes.ok) {
    // Serve slightly stale data rather than an error if we have any.
    if (cached) return json(cached.payload);
    return json({ error: `Couldn't find weather for "${location}".` }, currentRes.status === 404 ? 404 : 502);
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
      rain_expected: !!current.rain, // raining right now
    },
    daily_forecast: forecastRaw ? summarizeToDaily(forecastRaw.list) : [],
    location_name: current.name || location,
  };

  // 3. Save to cache (service role bypasses RLS; browsers can no longer write here).
  await admin.from("weather_cache").upsert(
    { location_key: cacheKey, fetched_at: new Date().toISOString(), payload },
    { onConflict: "location_key" },
  );

  return json(payload);
});
