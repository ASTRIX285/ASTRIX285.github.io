import {mountForgeShell} from './platform-forge-shell.mjs';

/* ========================================================================== 
   ASTRIX PARADOX - GUARDIAN CHARACTER CARDS
   Renders the 3-character top ribbon (Hunter, Warlock, Titan) from either
   live Bungie roster events or loaded Paradox beta fixtures.
   ========================================================================== */

mountForgeShell({rootSelector:'.workspace',gameId:'destiny-2',gameName:'Destiny 2',developerName:'Bungie'});

const host = () => document.querySelector("#guardianCharacterCards");
const MAX_CHARACTERS = 3;
const STAT_SYMBOLS = { Weapons: "⌖", Health: "♥", Class: "⬡", Grenade: "◉", Super: "✦", Melee: "⚔" };

const DEFAULT_CARDS = [
  {
    characterId: "hunter-beta",
    characterClass: "hunter",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Weapons", 100], ["Health", 65], ["Class", 105], ["Grenade", 100], ["Super", 40], ["Melee", 45]],
    selected: false
  },
  {
    characterId: "warlock-beta",
    characterClass: "warlock",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Weapons", 105], ["Health", 70], ["Class", 30], ["Grenade", 110], ["Super", 105], ["Melee", 40]],
    selected: false
  },
  {
    characterId: "titan-beta",
    characterClass: "titan",
    title: "TITLE DATA PENDING",
    power: 550,
    stats: [["Weapons", 94], ["Health", 23], ["Class", 94], ["Grenade", 53], ["Super", 72], ["Melee", 129]],
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
    : [["Weapons", 100], ["Health", 50], ["Class", 80], ["Grenade", 90], ["Super", 40], ["Melee", 30]];

  return statPairs
    .slice(0, 6)
    .map(
      ([name, value]) =>
        `<span class="guardian-character-card__stat" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)} ${Number(value || 0)}"><i aria-hidden="true">${
          STAT_SYMBOLS[name] || "◆"
        }</i><b>${Number(value || 0)}</b></span>`
    )
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
      const emblem = character.emblem?.icon
        ? `<img src="${escapeHtml(character.emblem.icon)}" alt="" loading="eager" decoding="async">`
        : `<span aria-hidden="true">◆</span>`;
      const title = character.title || (character.titleHash != null ? "TITLE DATA PENDING" : "NO TITLE EQUIPPED");

      return `<button type="button" class="guardian-character-card${selected ? " is-selected" : ""}" data-character-id="${escapeHtml(
        character.characterId
      )}" data-class="${escapeHtml(character.characterClass)}" aria-pressed="${selected}" aria-label="Select ${escapeHtml(
        classLabel(character.characterClass)
      )}, power ${escapeHtml(character.power ?? "unavailable")}">
        <span class="guardian-character-card__head">
          <span class="guardian-character-card__emblem">${emblem}</span>
          <span><strong>${escapeHtml(classLabel(character.characterClass).toUpperCase())}</strong><small>${escapeHtml(title)}</small></span>
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