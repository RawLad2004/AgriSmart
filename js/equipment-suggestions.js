/*==========================================================
            EQUIPMENT SUGGESTION ENGINE
    Small, explainable rule table that turns the weather
    payload already fetched by js/weather-client.js into a
    short list of equipment/supply suggestions. Kept as data
    (not inline conditionals in the rendering code) so
    thresholds and suggested items can be tuned without
    touching the weather page's rendering logic.

    Each rule: { test(payload) => bool, item, reason, icon }
    "item" is used verbatim as a marketplace commodity search
    term when the suggestion links into the Market page.
==========================================================*/

function _anyForecastDay(payload, predicate) {
  return (payload.daily_forecast || []).some(predicate);
}

function _forecastMaxTemp(payload) {
  const maxes = (payload.daily_forecast || []).map(d => d.max);
  return maxes.length ? Math.max(...maxes) : payload.current.temp;
}

function _forecastMinTemp(payload) {
  const mins = (payload.daily_forecast || []).map(d => d.min);
  return mins.length ? Math.min(...mins) : payload.current.temp;
}

const EQUIPMENT_RULES = [
  {
    test: (p) => p.current.rain_expected || _anyForecastDay(p, d => d.rain),
    item: "Tarpaulin",
    reason: "Rain is expected — cover feed stores and harvested produce.",
    icon: "fa-solid fa-water"
  },
  {
    test: (p) => p.current.rain_expected || _anyForecastDay(p, d => d.rain),
    item: "Drainage Channels",
    reason: "Rain expected — clear or add drainage to stop waterlogging in animal housing.",
    icon: "fa-solid fa-road"
  },
  {
    test: (p) => p.current.humidity >= 80,
    item: "Anti-Fungal Spray",
    reason: "High humidity raises the risk of fungal issues in crops and animal housing.",
    icon: "fa-solid fa-spray-can"
  },
  {
    test: (p) => _forecastMaxTemp(p) >= 30,
    item: "Shade Netting",
    reason: "A hot stretch is coming — shade netting helps protect animals and seedlings.",
    icon: "fa-solid fa-umbrella-beach"
  },
  {
    test: (p) => _forecastMaxTemp(p) >= 30,
    item: "Extra Water Trough",
    reason: "Hot weather increases water demand — add trough capacity so animals don't run dry.",
    icon: "fa-solid fa-droplet"
  },
  {
    test: (p) => _forecastMaxTemp(p) >= 32 || (p.current.humidity <= 35 && p.current.temp >= 28),
    item: "Irrigation Kit",
    reason: "Hot, dry conditions ahead — irrigation keeps crops and pasture from drying out.",
    icon: "fa-solid fa-faucet-drip"
  },
  {
    test: (p) => _forecastMinTemp(p) <= 12,
    item: "Brooder Heating Lamp",
    reason: "A cold snap is coming — chicks and young animals need supplemental heat.",
    icon: "fa-solid fa-lightbulb"
  },
  {
    test: (p) => p.current.wind_speed >= 8,
    item: "Wind-Resistant Shelter Bracing",
    reason: "Strong winds expected — reinforce loose roofing on animal shelters.",
    icon: "fa-solid fa-wind"
  }
];

/*==========================================================
    getEquipmentSuggestions(payload)
    Returns an array of { item, reason, icon }, deduplicated
    by item name, for whichever rules currently match.
==========================================================*/
function getEquipmentSuggestions(payload) {
  const seen = new Set();
  const results = [];

  EQUIPMENT_RULES.forEach(rule => {
    if (seen.has(rule.item)) return;
    if (rule.test(payload)) {
      results.push({ item: rule.item, reason: rule.reason, icon: rule.icon });
      seen.add(rule.item);
    }
  });

  return results;
}
