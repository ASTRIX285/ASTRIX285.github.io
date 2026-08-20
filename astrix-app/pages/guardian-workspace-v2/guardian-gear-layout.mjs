/* ==========================================================================
   ASTRIX PARADOX - GEAR & MOD MATRIX LAYOUT
   Builds the 5-column ARMOUR & MODS grid (Helmet, Gauntlets, Chest, Legs, Class Item)
   with 6 functional mod tiles each without tearing down sibling DOM blocks.
   ========================================================================== */

import "./guardian-semantic-ui.mjs";
import { openArmourDrawer } from "./guardian-beta-runtime.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const armourNames = ["Helmet", "Gauntlets", "Chest", "Legs", "Class Item"];

function syncModSizeToArtifact() {
  const mod = document.querySelector(".gear-mod");
  const slot = mod?.closest(".gear-slot");
  if (!mod || !slot) return;

  const fragment = document.querySelector("#fragList .ico-badge");
  const fragmentSize = fragment?.getBoundingClientRect().width || 36;
  const available = slot.clientWidth - 12;
  const maximumFit = Math.floor((available - 4) / 2);
  const target = Math.max(30, Math.min(fragmentSize, maximumFit));
  document.documentElement.style.setProperty("--pf-mod-size", `${target}px`);
}

function modTile(mod) {
  const name = mod?.name ?? mod?.displayName ?? "Empty mod slot";
  const icon = mod?.icon ?? mod?.iconUrl ?? mod?.displayProperties?.icon ?? "";
  const cost = mod?.energyCost ?? mod?.cost ?? "";
  return `<button class="gear-mod" type="button" title="${esc(name)}" aria-label="${esc(name)}" ${cost !== "" ? `data-cost="${esc(cost)}"` : ""}>${
    icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◆</span>'
  }</button>`;
}

function appearanceTile(item) {
  if (!item) return "";
  const name = item?.name ?? item?.displayName ?? "Appearance plug";
  const description = item?.description ?? "";
  const hash = item?.bungieHash ?? item?.hash ?? "";
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? "";
  const title = [name, description, hash ? `Bungie hash: ${hash}` : ""].filter(Boolean).join(" — ");
  return `<button class="gear-appearance" type="button" title="${esc(title)}" aria-label="${esc(name)}">${
    icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◇</span>'
  }</button>`;
}

function traitTile(trait) {
  if (!trait) return "";
  const name = trait?.name ?? "Exotic intrinsic trait";
  const description = trait?.description ?? "";
  const hash = trait?.bungieHash ?? trait?.hash ?? "";
  const icon = trait?.icon ?? "";
  const title = [name, description, hash ? `Bungie hash: ${hash}` : ""].filter(Boolean).join(" — ");
  return `<button class="gear-intrinsic" type="button" title="${esc(title)}" aria-label="${esc(name)}">${
    icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">✦</span>'
  }</button>`;
}

function armourCard(index, item) {
  const name = item?.name ?? armourNames[index];
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? "";
  const rarity = String(item?.rarity ?? item?.tier ?? "").toLowerCase();
  const isExotic = item?.isExotic === true || rarity.includes("exotic");
  const trait = isExotic ? item?.intrinsicTrait ?? null : null;
  const mods = Array.isArray(item?.mods) ? item.mods : [];
  const appearance = Array.isArray(item?.appearancePlugs) ? item.appearancePlugs : [];
  const slotCount = 6;

  return `<article class="gear-slot ${isExotic ? "exotic" : ""}" data-armour-index="${index}">
    <div class="gear-slot-label">${esc(name)}</div>
    <div class="gear-arm-row">
      <div class="gear-arm-anchor">
        <div class="arm ${icon ? "" : "ph"}" tabindex="0" role="button" title="${esc(name)}">
          <span class="lv">${esc(item?.power ?? "—")}</span>
          ${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◇</span>'}
        </div>
      </div>
      ${isExotic && trait ? traitTile(trait) : ""}
    </div>
    ${appearance.length ? `<div class="gear-appearance-row">${appearance.slice(0, 2).map(appearanceTile).join("")}</div>` : ""}
    <div class="gear-slot-divider"></div>
    <div class="gear-mods" data-slot-count="${slotCount}">${Array.from({ length: slotCount }, (_, i) => modTile(mods[i])).join("")}</div>
  </article>`;
}

export function buildGear(armour = []) {
  const gear = document.querySelector(".gear-combined");
  if (!gear) return;
  const columns = gear.querySelector(".gear-columns");
  if (!columns) return;

  columns.innerHTML = Array.from({ length: 5 }, (_, i) => armourCard(i, armour[i])).join("");

  columns.querySelectorAll(".gear-slot").forEach((slotEl, idx) => {
    slotEl.querySelector(".arm")?.addEventListener("click", () => openArmourDrawer(idx, armour[idx]));
  });

  requestAnimationFrame(() => {
    syncModSizeToArtifact();
    requestAnimationFrame(syncModSizeToArtifact);
  });
}

function initialise() {
  const equip = document.querySelector(".equip");
  if (!equip) return;
  equip.classList.add("gear-layout-active");
  buildGear([]);
}

document.addEventListener("astrix:guardian-selection-changed", (e) => {
  if (Array.isArray(e.detail?.armour)) buildGear(e.detail.armour);
});

window.addEventListener("resize", () => requestAnimationFrame(syncModSizeToArtifact));
initialise();