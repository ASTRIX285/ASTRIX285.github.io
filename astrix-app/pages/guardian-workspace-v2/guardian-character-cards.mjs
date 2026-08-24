import {mountForgeShell} from './platform-forge-shell.mjs';

/* ========================================================================== 
   ASTRIX PARADOX - GUARDIAN CHARACTER CARDS
   Renders the 3-character top ribbon (Hunter, Warlock, Titan) from either
   live Bungie roster events or loaded Paradox beta fixtures.
   ========================================================================== */

mountForgeShell({rootSelector:'.workspace',gameId:'destiny-2',gameName:'Destiny 2',developerName:'Bungie'});

const host = () => document.querySelector("#guardianCharacterCards");
const MAX_CHARACTERS = 3;
const STAT_ICON_KEYS = Object.freeze({
  Mobility: "mobility",
  Resilience: "resilience",
  Recovery: "recovery",
  Discipline: "discipline",
  Intellect: "intellect",
  Strength: "strength",
  Weapons: "mobility",
  Health: "resilience",
  Class: "recovery",
  Grenade: "discipline",
  Super: "intellect",
  Melee: "strength"
});

const DEFAULT_CARDS = [
  {
    characterId: "hunter-beta",
    characterClass: "hunter",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Mobility", 100], ["Resilience", 65], ["Recovery", 105], ["Discipline", 100], ["Intellect", 40], ["Strength", 45]],
    selected: false
  },
  {
    characterId: "warlock-beta",
    characterClass: "warlock",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Mobility", 105], ["Resilience", 70], ["Recovery", 30], ["Discipline", 110], ["Intellect", 105], ["Strength", 40]],
    selected: false
  },
  {
    characterId: "titan-beta",
    characterClass: "titan",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Mobility", 94], ["Resilience", 23], ["Recovery", 94], ["Discipline", 53], ["Intellect", 72], ["Strength", 129]],
    selected: false
  }
];

let characters = [];
let selectedCharacterId = "";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const classLabel = (value) => String(value || "Guardian").replace(/^./, (letter) => letter.toUpperCase());

function renderStatus(message, state = "disconnected") {
  const target = host();
  if (!target) return;
  target.innerHTML = `<div class="guardian-character-cards__status is-${escapeHtml(state)}" role="status">${escapeHtml(message)}</div>`;
}

function statMarkup(stats = []) {
  const statPairs = Array.isArray(stats) && stats.length && Array.isArray(stats[0])
    ? stats
    : [["Mobility", 100], ["Resilience", 50], ["Recovery", 80], ["Discipline", 90], ["Intellect", 40], ["Strength", 30]];

  return statPairs
    .slice(0, 6)
    .map(([name, value]) => {
      const iconKey = STAT_ICON_KEYS[name] || "mobility";
      return `<span class="guardian-character-card__stat" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)} ${Number(value || 0)}"><i class="guardian-stat-icon guardian-stat-icon--${iconKey}" aria-hidden="true"></i><b>${Number(value || 0)}</b></span>`;
    })
    .join("");
}

function render(nextCharacters = characters, nextSelectedId = selectedCharacterId) {
  const target = host();
  if (!target) return;

  const supplied = Array.isArray(nextCharacters) ? nextCharacters.slice(0, MAX_CHARACTERS) : [];
  if (!supplied.length) {
    characters = [];
    selectedCharacterId = "";
    renderStatus("LOADING BUNGIE CHARACTERS", "pending");
    return;
  }

  characters = supplied;
  selectedCharacterId = String(nextSelectedId || "");

  target.innerHTML = characters
    .map((character) => {
      const selected = Boolean(selectedCharacterId) && String(character.characterId) === selectedCharacterId;
      const emblemBackground = character.emblem?.background || character.emblem?.icon || "";
      const emblemStyle = emblemBackground
        ? ` style="--character-emblem:url('${escapeHtml(emblemBackground)}')"`
        : "";
      const title = character.title || (character.titleHash != null ? "TITLE DATA PENDING" : "NO TITLE EQUIPPED");

      return `<button type="button" class="guardian-character-card${selected ? " is-selected" : ""}" data-character-id="${escapeHtml(
        character.characterId
      )}" data-class="${escapeHtml(character.characterClass)}" aria-pressed="${selected}" aria-label="Select ${escapeHtml(
        classLabel(character.characterClass)
      )}, power ${escapeHtml(character.power ?? "unavailable")}"${emblemStyle}>
        <span class="guardian-character-card__head">
          <span class="guardian-character-card__identity"><strong>${escapeHtml(classLabel(character.characterClass).toUpperCase())}</strong><small>${escapeHtml(title)}</small></span>
          <span class="guardian-character-card__power"><i aria-hidden="true">✦</i>${escapeHtml(character.power ?? "550")}</span>
        </span>
        <span class="guardian-character-card__stats">${statMarkup(character.stats)}</span>
      </button>`;
    })
    .join("");

  target.querySelectorAll("[data-character-id]").forEach((button) =>
    button.addEventListener("click", () => {
      const characterId = String(button.dataset.characterId || "");
      const characterClass = String(button.dataset.class || "");
      if (!characterId || !characterClass) return;

      target.querySelectorAll("[data-character-id]").forEach((card) => {
        const active = String(card.dataset.characterId) === characterId;
        card.classList.toggle("is-selected", active);
        card.setAttribute("aria-pressed", String(active));
      });
      selectedCharacterId = characterId;

      document.dispatchEvent(new CustomEvent("astrix:character-selected", { detail: { characterId, characterClass, className: classLabel(characterClass) } }));
    })
  );
}

document.addEventListener("astrix:bungie-character-roster", (event) => render(event.detail?.characters || [], event.detail?.selectedCharacterId));

document.addEventListener("astrix:guardian-selection-changed", (event) => {
  const chosenId = String(event.detail?.characterId || "");
  if (!chosenId) return;

  const target = host();
  if (!target) return;

  target.querySelectorAll("[data-character-id]").forEach((card) => {
    const matches = String(card.dataset.characterId) === chosenId;
    card.classList.toggle("is-selected", matches);
    card.setAttribute("aria-pressed", String(matches));
  });
  selectedCharacterId = chosenId;
});

renderStatus("LOADING BUNGIE CHARACTERS", "pending");

export { render as renderGuardianCharacterCards, renderStatus as renderGuardianCharacterCardStatus };
