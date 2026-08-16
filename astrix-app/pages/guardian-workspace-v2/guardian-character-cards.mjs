/* ==========================================================================
   ASTRIX PARADOX - GUARDIAN CHARACTER CARDS MODULE
   Hydrates multi-character selection drawers and status triggers.
   ========================================================================== */

const CLASS_NAMES = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock"
};

export function renderCharacterCards(characters = [], activeCharacterId = null) {
  const container = document.querySelector("[data-character-cards]");
  if (!container) return;

  if (!characters || characters.length === 0) {
    container.innerHTML = `<div class="character-card-empty">Connect Bungie to load active characters</div>`;
    return;
  }

  container.innerHTML = characters.map(char => {
    const isActive = char.characterId === activeCharacterId;
    const className = CLASS_NAMES[char.classType] || char.className || "Guardian";
    const emblemBg = char.emblemBackgroundPath 
      ? `https://www.bungie.net${char.emblemBackgroundPath}` 
      : "";

    return `
      <button 
        type="button" 
        class="character-card ${isActive ? "is-active" : ""}" 
        data-character-id="${char.characterId}"
        style="${emblemBg ? `background-image: url('${emblemBg}')` : ""}"
      >
        <div class="character-card-meta">
          <strong>${className}</strong>
          <span>✦ ${char.light || char.power || "---"}</span>
        </div>
      </button>
    `;
  }).join("");
}

export function bindCharacterSelection(onSelect) {
  const container = document.querySelector("[data-character-cards]");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const card = e.target.closest("[data-character-id]");
    if (!card) return;

    const characterId = card.dataset.characterId;
    document.querySelectorAll("[data-character-cards] .character-card").forEach(el => el.classList.remove("is-active"));
    card.classList.add("is-active");

    if (typeof onSelect === "function") {
      onSelect(characterId);
    }
  });
}
