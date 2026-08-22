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

function armourSetStrip(set) {
  if (!set) return "";
  if (!set.identity || set.unresolved) return `<div class="armour-set-strip is-unresolved" title="Exact Bungie armour-set definition has not been returned by the backend"><span class="armour-set-unresolved"><b>SET DATA UNRESOLVED</b><small>${set.hash ? `BUNGIE HASH ${esc(set.hash)}` : "AWAITING VERIFIED MANIFEST DATA"}</small></span></div>`;
  const identityIcon = set.identity?.icon ?? "";
  const thresholds = [set.twoPiece, set.fourPiece].filter(Boolean);
  return `<div class="armour-set-strip" title="${esc(set.identity.name ?? "Resolved armour set")}">
    <span class="armour-set-identity">${identityIcon ? `<img src="${esc(identityIcon)}" alt="">` : ""}<b>${esc(set.identity.name ?? "Armour set")}</b><small>${esc(set.equippedCount ?? 0)}pc</small></span>
    <span class="armour-set-thresholds">${thresholds.map(effect => `<span class="armour-set-threshold ${effect.active ? "is-active" : ""}" title="${esc([effect.name, effect.description].filter(Boolean).join(" — "))}">${effect.icon ? `<img src="${esc(effect.icon)}" alt="">` : ""}<b>${esc(effect.requiredSetCount)}</b></span>`).join("")}</span>
  </div>`;
}

function exoticPerkStrip(trait) {
  if (!trait) return "";
  const name = trait?.name ?? "Exotic intrinsic trait";
  const description = trait?.description ?? "";
  const hash = trait?.bungieHash ?? trait?.hash ?? "";
  const icon = trait?.icon ?? "";
  const title = [name, description, hash ? `Bungie hash: ${hash}` : ""].filter(Boolean).join(" — ");
  return `<div class="armour-exotic-strip" title="${esc(title)}"><span class="armour-exotic-icon">${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">✦</span>'}</span><span><small>EXOTIC ARMOUR PERK</small><b>${esc(name)}</b></span></div>`;
}

function armourCard(index, item) {
  const name = item?.name ?? armourNames[index];
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? "";
  const rarity = String(item?.rarity ?? item?.tier ?? "").toLowerCase();
  const isExotic = item?.isExotic === true || rarity.includes("exotic");
  const trait = isExotic ? item?.intrinsicTrait ?? null : null;
  const mods = Array.isArray(item?.mods) ? item.mods : [];
  const slotCount = 6;
  const armourTier = Number(item?.armourTier ?? item?.armourSemantics?.tier);
  const isTierFive = Number.isFinite(armourTier) && armourTier >= 5;
  const setStrip = !isExotic ? armourSetStrip(item?.armourSemantics?.set) : "";
  const exoticStrip = isExotic ? exoticPerkStrip(trait) : "";

  return `<article class="gear-slot ${isExotic ? "exotic" : ""} ${isTierFive ? "is-level-gold" : ""}" data-armour-index="${index}">
    <div class="gear-slot-label">${esc(name)}</div>
    <div class="gear-arm-row">
      <div class="gear-arm-anchor">
        <div class="arm ${icon ? "" : "ph"}" tabindex="0" role="button" title="${esc(name)}">
          <span class="lv">${esc(item?.power ?? "—")}</span>${Number.isFinite(armourTier) && armourTier < 5 ? `<span class="item-rank" title="Resolved armour tier">T${esc(armourTier)}</span>` : ""}
          ${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◇</span>'}
        </div>
      </div>
      ${isExotic && trait ? traitTile(trait) : ""}
    </div>
    ${exoticStrip}
    ${setStrip}
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
