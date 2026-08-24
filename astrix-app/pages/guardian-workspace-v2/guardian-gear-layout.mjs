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
  const rawCost = mod?.energyCost ?? mod?.cost ?? mod?.definition?.plug?.energyCost ?? mod?.plug?.energyCost ?? "";
  const cost = rawCost && typeof rawCost === "object"
    ? rawCost.energyCost ?? rawCost.value ?? ""
    : rawCost;
  const isMasterwork = mod?.semanticRole === "masterwork";
  const isMasterworkGold = isMasterwork && Number(cost) >= 5;
  return `<button class="gear-mod ${isMasterwork ? "is-masterwork" : ""} ${isMasterworkGold ? "is-masterwork-gold" : ""}" type="button" title="${esc(name)}" aria-label="${esc(name)}" ${cost !== "" ? `data-cost="${esc(cost)}"` : ""}>${
    icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◆</span>'
  }</button>`;
}

function armourSetStrip(set) {
  if (!set) return "";
  // Missing definitions are validation telemetry, not a player-facing set bonus.
  // Render only exact Bungie set identities and perk thresholds.
  if (!set.identity || set.unresolved) return "";
  const thresholds = [set.twoPiece, set.fourPiece].filter(Boolean);
  return `<div class="armour-set-strip" title="${esc(set.identity.name ?? "Resolved armour set")}">
    <span class="armour-set-thresholds">${thresholds.map(effect => `<span class="armour-set-threshold ${effect.active ? "is-active" : ""}" title="${esc([`${effect.requiredSetCount}-piece`, effect.name, effect.description].filter(Boolean).join(" — "))}">${effect.icon ? `<img src="${esc(effect.icon)}" alt="${esc(effect.name ?? `${effect.requiredSetCount}-piece set perk`)}">` : ""}</span>`).join("")}</span>
  </div>`;
}

export function armourCard(index, item) {
  const name = item?.name ?? armourNames[index];
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? "";
  const rarity = String(item?.rarity ?? item?.tier ?? "").toLowerCase();
  const isExotic = item?.isExotic === true || rarity.includes("exotic");
  const trait = isExotic ? item?.intrinsicTrait ?? null : null;
  const mods = Array.isArray(item?.mods) ? item.mods : [];
  const slotCount = 6;
  const armourTier = Number(item?.armourTier ?? item?.armourSemantics?.tier);
  const isTierFive = Number.isFinite(armourTier) && armourTier >= 5;
  const archetype = item?.armourSemantics?.archetype ?? item?.archetype ?? null;
  const archetypeIcon = archetype?.icon ?? archetype?.displayProperties?.icon ?? "";
  const archetypeTitle = [archetype?.name ?? archetype?.displayName, archetype?.description].filter(Boolean).join(" — ");
  const armourSet = !isExotic ? item?.armourSemantics?.set ?? item?.setBonus ?? null : null;
  const setStrip = armourSetStrip(armourSet);
  const twoPieceActive = armourSet?.twoPiece?.active === true;
  const fourPieceActive = armourSet?.fourPiece?.active === true;
  const setBonusIcon = armourSet?.identity?.icon ?? armourSet?.twoPiece?.icon ?? armourSet?.fourPiece?.icon ?? "";
  const setBonusTitle = [armourSet?.identity?.name, "Bungie armour set bonus"].filter(Boolean).join(" — ");
  const traitIcon = trait?.icon ?? trait?.displayProperties?.icon ?? "";
  const traitTitle = [trait?.name ?? trait?.displayName, trait?.description].filter(Boolean).join(" — ");

  return `<article class="gear-slot ${isExotic ? "exotic" : ""} ${isTierFive ? "is-level-gold" : ""} ${armourSet?.identity ? "has-set-bonus" : ""} ${twoPieceActive ? "is-set-2-active" : ""} ${fourPieceActive ? "is-set-4-active" : ""}" data-armour-index="${index}">
    <div class="gear-slot-label">${esc(name)}</div>
    <div class="gear-arm-row">
      <div class="gear-arm-anchor">
        <div class="arm ${icon ? "" : "ph"}" tabindex="0" role="button" title="${esc(name)}">
          <span class="lv">${esc(item?.power ?? "—")}</span>${Number.isFinite(armourTier) && armourTier > 0 ? `<span class="armour-tier-rail" title="Verified armour tier ${esc(armourTier)}">${Array.from({ length: Math.min(5, Math.floor(armourTier)) }, () => '<i class="armour-tier-diamond" aria-hidden="true"></i>').join("")}</span>` : ""}
          ${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◇</span>'}
          ${archetypeIcon ? `<span class="armour-archetype-icon" title="${esc(archetypeTitle || "Verified armour archetype")}"><img src="${esc(archetypeIcon)}" alt="${esc(archetype?.name ?? "Armour archetype")}"></span>` : ""}
          ${isExotic && traitIcon ? `<span class="armour-exotic-overlay" title="${esc(traitTitle || "Verified exotic armour perk")}"><img src="${esc(traitIcon)}" alt="${esc(trait?.name ?? "Exotic armour perk")}"></span>` : ""}
          ${setBonusIcon ? `<span class="armour-set-bonus-icon" title="${esc(setBonusTitle)}"><img src="${esc(setBonusIcon)}" alt="${esc(armourSet?.identity?.name ?? "Armour set bonus")}"></span>` : ""}
        </div>
      </div>
      ${setStrip}
    </div>
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
