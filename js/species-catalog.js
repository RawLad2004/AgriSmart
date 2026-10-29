/*==========================================================
                SPECIES CATALOG
    Static reference data for the "Browse Species" picker on
    the Add Animal form. Grouped by the same enterprise `type`
    values already used across the app (livestock, dairy,
    poultry, aquaculture, apiary). Purely additive — the
    species field stays free text, this just gives farmers a
    faster, guided way to fill it in with sensible breed
    suggestions.
==========================================================*/

const SPECIES_CATALOG = {
  dairy: [
    { species: "Dairy Cow", breeds: ["Friesian", "Ayrshire", "Guernsey", "Jersey", "Sahiwal Cross"] },
    { species: "Dairy Goat", breeds: ["Toggenburg", "Saanen", "Alpine", "Galla"] }
  ],
  poultry: [
    { species: "Layer Chicken", breeds: ["Isa Brown", "Lohmann Brown", "Hy-Line"] },
    { species: "Broiler Chicken", breeds: ["Cobb 500", "Ross 308"] },
    { species: "Kienyeji (Indigenous) Chicken", breeds: ["Improved Kienyeji", "Kuroiler"] },
    { species: "Duck", breeds: ["Muscovy", "Pekin", "Khaki Campbell"] },
    { species: "Turkey", breeds: ["Broad Breasted White", "Bronze"] },
    { species: "Goose", breeds: ["Embden", "Toulouse"] }
  ],
  aquaculture: [
    { species: "Tilapia", breeds: ["Nile Tilapia"] },
    { species: "Catfish", breeds: ["African Catfish"] }
  ],
  apiary: [
    { species: "Honeybee Colony", breeds: ["Langstroth Hive", "Top-Bar Hive", "Log Hive"] }
  ],
  livestock: [
    { species: "Beef Cattle", breeds: ["Boran", "Zebu", "Sahiwal", "Charolais Cross"] },
    { species: "Dairy Goat", breeds: ["Toggenburg", "Saanen", "Alpine", "Galla"] },
    { species: "Meat Goat", breeds: ["Boer", "Galla", "Small East African"] },
    { species: "Sheep", breeds: ["Dorper", "Red Maasai", "Merino"] },
    { species: "Pig", breeds: ["Large White", "Landrace", "Duroc"] },
    { species: "Rabbit", breeds: ["New Zealand White", "California White"] },
    { species: "Donkey", breeds: ["Local Donkey"] }
  ]
};

/*==========================================================
    openSpeciesPicker(enterpriseType, onSelect)
    Renders the species list for the given enterprise type
    into the #species-picker-modal and shows it. onSelect is
    called with { species, breed } when a breed chip is
    clicked; "Other / custom" always closes the modal without
    changing anything the user already typed.
==========================================================*/
function openSpeciesPicker(enterpriseType, onSelect) {
  const entries = SPECIES_CATALOG[enterpriseType] || SPECIES_CATALOG.livestock;
  const listBox = document.getElementById("species-picker-list");

  listBox.innerHTML = entries.map(entry => `
    <div style="margin-bottom:18px;">
      <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(entry.species)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button type="button" class="secondary-btn species-pick-btn" data-species="${escapeHtml(entry.species)}" data-breed=""
          style="padding:8px 14px;font-size:.85rem;">
          ${escapeHtml(entry.species)} (no specific breed)
        </button>
        ${entry.breeds.map(b => `
          <button type="button" class="secondary-btn species-pick-btn" data-species="${escapeHtml(entry.species)}" data-breed="${b}"
            style="padding:8px 14px;font-size:.85rem;">
            ${escapeHtml(b)}
          </button>
        `).join("")}
      </div>
    </div>
  `).join("");

  listBox.querySelectorAll(".species-pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      onSelect({ species: btn.dataset.species, breed: btn.dataset.breed });
      document.getElementById("species-picker-modal").classList.remove("active");
    });
  });

  document.getElementById("species-picker-modal").classList.add("active");
}
