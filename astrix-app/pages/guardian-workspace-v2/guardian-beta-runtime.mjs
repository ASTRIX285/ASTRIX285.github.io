/* ==========================================================================
   ASTRIX PARADOX - WORKSPACE BETA RUNTIME
   Pure telemetry runtime: manages armour inspector drawer, weapon cards,
   and stat bars without 2D/3D platform or hero canvas overhead.
   ========================================================================== */

const PLAYER_POWER_CAP = 550;
const STAT_CAP = 200;

const VALID_CLASSES = ["hunter", "titan", "warlock"];
const VALID_SUBCLASSES = ["void", "solar", "arc", "stasis", "strand", "prismatic"];
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

const previewStats = [
  ["Weapons", 100],
  ["Health", 42],
  ["Class", 70],
  ["Grenade", 101],
  ["Super", 28],
  ["Melee", 38]
];

const workspaceState = {
  characterId: null,
  characterClass: "hunter",
  subclass: "void",
  power: PLAYER_POWER_CAP,
  stats: null,
  weapons: [],
  armour: []
};

function normaliseSelection(detail = {}) {
  const characterClass = String(detail.characterClass ?? detail.className ?? detail.classType ?? workspaceState.characterClass).toLowerCase();
  const subclass = String(detail.subclass ?? workspaceState.subclass).toLowerCase();
  if (!VALID_CLASSES.includes(characterClass) || !VALID_SUBCLASSES.includes(subclass)) return null;
  return { ...workspaceState, ...detail, characterClass, subclass };
}

function setStageState(title, message = "") {
  const titleEl = byId("stageStateTitle");
  const msgEl = byId("stageStateMessage");
  if (titleEl && title) titleEl.textContent = title;
  if (msgEl && message) msgEl.innerHTML = message;
}

function renderStats(stats) {
  const values = Array.isArray(stats) && stats.length ? stats : previewStats;
  const target = byId("statsRow");
  if (!target) return;

  const total = values.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  target.innerHTML =
    values
      .map(
        ([name, value]) =>
          `<div class="st"><span class="nm">${escapeHtml(name)}</span><span class="bar"><i style="width:${Math.min(
            100,
            (Number(value || 0) / STAT_CAP) * 100
          )}%"></i></span><span class="v">${Number(value || 0)}</span></div>`
      )
      .join("") + `<div class="st total"><span class="nm">Total</span><span></span><span class="v">${total}</span></div>`;
}

function renderWeapons(weapons = []) {
  const cards = Array.from(document.querySelectorAll(".weap-grid .weap"));
  if (!cards.length) return;

  const slotOrder = { Kinetic: 0, Special: 0, Primary: 1, Energy: 1, Power: 2, Heavy: 2 };
  const ordered = [null, null, null];

  weapons.forEach((weapon, index) => {
    const ammo = String(weapon?.ammoType ?? "");
    let slot = slotOrder[ammo];
    if (!Number.isInteger(slot)) slot = Math.min(index, 2);
    while (slot < 3 && ordered[slot]) slot++;
    if (slot < 3) ordered[slot] = weapon;
  });

  cards.forEach((card, index) => {
    const weapon = ordered[index];
    const art = card.querySelector(".art");
    const name = card.querySelector(".cap b");
    const meta = card.querySelector(".cap small");

    if (!weapon) {
      if (art) {
        art.classList.add("ph");
        art.innerHTML = '<span class="pw">—</span><span class="ph-glyph">⌖</span>';
      }
      if (meta) meta.textContent = "awaiting build data";
      return;
    }

    if (art) {
      art.classList.remove("ph");
      const icon = weapon.icon
        ? `<img src="${escapeHtml(weapon.icon)}" alt="${escapeHtml(weapon.name || "Weapon")}" onerror="this.style.display='none'">`
        : '<span class="ph-glyph">⌖</span>';
      art.innerHTML = `<span class="pw">${escapeHtml(String(weapon.power ?? ""))}</span>${icon}`;
    }

    if (name) name.textContent = weapon.name || "Unknown weapon";
    if (meta) {
      const details = [weapon.weaponType, weapon.element, weapon.ammoType].filter(Boolean);
      meta.textContent = details.join(" · ") || "Bungie identity resolved";
    }
    card.title = [weapon.name, weapon.weaponType, weapon.element, weapon.ammoType].filter(Boolean).join(" — ");
  });
}

function createArmourDrawer() {
  if (byId("armourDrawer")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="armour-drawer-backdrop" data-close-drawer hidden></div>
     <aside class="armour-drawer" id="armourDrawer" aria-hidden="true" hidden>
       <div class="armour-drawer-head">
         <div><small class="eyebrow">ARMOUR INSPECTOR</small><h2 id="armourDrawerTitle">Armour slot</h2></div>
         <button class="armour-drawer-close" type="button" data-close-drawer aria-label="Close armour inspector">✕</button>
       </div>
       <div class="armour-drawer-tabs" role="tablist">
         <button class="armour-tab" data-tab="build" aria-selected="true">BUILD</button>
         <button class="armour-tab" data-tab="appearance" aria-selected="false">APPEARANCE</button>
         <button class="armour-tab" data-tab="mods" aria-selected="false">MODS</button>
       </div>
       <section class="armour-panel active" data-panel="build"></section>
       <section class="armour-panel" data-panel="appearance"></section>
       <section class="armour-panel" data-panel="mods"></section>
     </aside>`
  );

  document.querySelectorAll("[data-close-drawer]").forEach((el) => el.addEventListener("click", closeArmourDrawer));
  document.querySelectorAll(".armour-tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".armour-tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      document.querySelectorAll(".armour-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === tab.dataset.tab));
    })
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeArmourDrawer();
  });
}

export function openArmourDrawer(index, item) {
  const names = ["Helmet", "Gauntlets", "Chest Armour", "Leg Armour", "Class Item"];
  const resolved = item || null;
  byId("armourDrawerTitle").textContent = resolved?.name || names[index] || "Armour";
  const fallback = '<div class="inspector-empty">Awaiting Bungie character and inventory data.</div>';
  const field = (label, value) => `<div class="inspector-field"><small>${escapeHtml(label)}</small><b>${escapeHtml(value ?? "Awaiting live data")}</b></div>`;

  document.querySelector('[data-panel="build"]').innerHTML = resolved
    ? `<div class="inspector-grid">${field("Power", resolved.power)}${field("Energy", resolved.energy?.type || resolved.energy)}${field("Tier", resolved.tier)}${field("Manifest hash", resolved.hash)}</div>`
    : fallback;
  document.querySelector('[data-panel="appearance"]').innerHTML = resolved
    ? `<div class="inspector-grid">${field("Shader", resolved.shader?.name || resolved.shader)}${field("Ornament", resolved.ornament?.name || resolved.ornament)}${field("Default appearance", resolved.defaultAppearance || "Available from manifest")}${field("Cosmetic state", resolved.cosmeticState)}</div>`
    : fallback;
  document.querySelector('[data-panel="mods"]').innerHTML = resolved?.mods?.length
    ? (resolved.intrinsicTrait ? field("Exotic trait", resolved.intrinsicTrait.name || "Intrinsic trait") : "") +
      resolved.mods.map((mod) => field("Armour mod", mod.name || mod)).join("")
    : fallback;

  document.body.classList.add("armour-drawer-open");
  document.querySelector(".armour-drawer-backdrop")?.removeAttribute("hidden");
  byId("armourDrawer")?.removeAttribute("hidden");
  byId("armourDrawer")?.setAttribute("aria-hidden", "false");
}

export function closeArmourDrawer() {
  document.body.classList.remove("armour-drawer-open");
  document.querySelector(".armour-drawer-backdrop")?.setAttribute("hidden", "");
  byId("armourDrawer")?.setAttribute("aria-hidden", "true");
  byId("armourDrawer")?.setAttribute("hidden", "");
}

function applyGuardianSelection(detail) {
  const next = normaliseSelection(detail);
  if (!next) return;
  Object.assign(workspaceState, next);

  if (next.power != null) document.querySelectorAll("[data-power-cap]").forEach((el) => (el.textContent = next.power));
  if (next.stats) renderStats(next.stats);
  if (Array.isArray(next.weapons)) renderWeapons(next.weapons);

  setStageState("GUARDIAN PROFILE ACTIVE", `${next.className ? next.className.toUpperCase() : "GUARDIAN"} · ${next.subclassName ? next.subclassName.toUpperCase() : "SUBCLASS"}<br><small style="color:#8e7bb0">Telemetry synchronized from Paradox beta fixture</small>`);
}

document.addEventListener("astrix:guardian-selection-changed", (event) => {
  try {
    applyGuardianSelection(event.detail);
  } catch (error) {
    console.error("[ASTRIX Guardian render]", error);
  }
});

createArmourDrawer();
renderStats(previewStats);

document.dispatchEvent(new CustomEvent("astrix:guardian-workspace-ready", { detail: { version: "0.2.0-beta" } }));