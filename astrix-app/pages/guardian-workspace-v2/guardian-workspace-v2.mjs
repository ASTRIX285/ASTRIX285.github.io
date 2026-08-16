import {
  normaliseLiveProfile,
  loadSelectedLoadout,
  characterRoster,
  selectLiveCharacter
} from "./guardian-bungie-profile.mjs";
import { renderGuardianLoadouts } from "./guardian-loadouts.mjs";

const PLAYER_POWER_CAP = 550;
const VALID_CLASSES = ["hunter", "titan", "warlock"];
const VALID_SUBCLASSES = ["void", "solar", "arc", "stasis", "strand", "prismatic"];

const byId = id => document.getElementById(id);

const escapeHtml = value =>
  String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

// Prepend Bungie CDN domain to any relative asset path
const bungieUrl = path => {
  if (!path) return "";
  return path.startsWith("http") ? path : `https://www.bungie.net${path}`;
};

const iconMarkup = (icon, name) => {
  const url = bungieUrl(icon);
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(name || '')}" loading="lazy" decoding="async" onerror="this.style.opacity=0">`
    : `<span class="ico-fb">◆</span>`;
};

const workspaceState = {
  characterId: null,
  characterClass: "hunter",
  subclass: "arc",
  subclassName: "Arcstrider",
  subclassIcon: "",
  renderUrl: null,
  power: PLAYER_POWER_CAP,
  stats: null,
  weapons: [],
  armour: [],
  emblem: null,
  ghost: null,
  shader: null,
  ornaments: []
};

let stageLoadingTimer = 0;

function setStageState(state, message = "") {
  const stage = document.querySelector(".stage");
  if (stage) {
    stage.dataset.state = state || "ready";
  }
  clearTimeout(stageLoadingTimer);

  const titleNode = byId("stageStateTitle");
  const msgNode = byId("stageStateMessage");

  if (titleNode) {
    if (state === "loading") {
      titleNode.textContent = "SYNCING TELEMETRY";
    } else if (state === "error") {
      titleNode.textContent = "TELEMETRY UNAVAILABLE";
    } else {
      titleNode.textContent = "GUARDIAN TELEMETRY";
    }
  }

  if (msgNode) {
    if (state === "loading") {
      msgNode.textContent = message || "Loading Guardian profile from Bungie API…";
    } else if (state === "error") {
      msgNode.textContent = message || "Guardian data could not be resolved.";
    } else {
      msgNode.textContent = message || "Select a character or loadout to inspect live data metrics.";
    }
  }

  if (state === "loading") {
    stageLoadingTimer = setTimeout(() => {
      if (stage && stage.dataset.state !== "loading") return;
      if (stage) stage.dataset.state = "error";
      if (titleNode) titleNode.textContent = "REQUEST TIMEOUT";
      if (msgNode) msgNode.textContent = "Guardian data took too long. Refresh or reconnect Bungie.";
      document.dispatchEvent(new CustomEvent("astrix:guardian-load-timeout"));
    }, 15000);
  }
}

function renderVerifiedPreview(data = {}) {
  const previewHost = byId("verifiedPreview") || byId("previewContainer") || byId("characterSummary");
  if (!previewHost) return;

  const title = escapeHtml(data.title || workspaceState.subclassName || "Equipped Setup");
  const desc = escapeHtml(data.description || "Telemetry synchronized from live Bungie profile");

  previewHost.innerHTML = `
    <div class="verified-header">
      <h4>${title}</h4>
      <p>${desc}</p>
    </div>
  `;
}

function renderSubclassBuild(build = {}, subclassName = "Subclass") {
  const crest = byId("scCrest");
  const scNameEl = byId("scSubclassName");
  const scClassEl = byId("scClassLabel");
  const clusterHost = byId("destinySuperCluster");

  if (crest && workspaceState.subclassIcon) {
    crest.src = bungieUrl(workspaceState.subclassIcon);
    crest.style.display = "block";
    crest.style.opacity = "1";
  }

  if (scNameEl) {
    scNameEl.textContent = (subclassName || workspaceState.subclassName || "SUBCLASS").toUpperCase();
  }

  if (scClassEl) {
    scClassEl.textContent = `${(workspaceState.characterClass || "GUARDIAN").toUpperCase()} SUBCLASS ▾`;
  }

  const activeElement = (workspaceState.subclass || "arc").toLowerCase();
  if (clusterHost) {
    clusterHost.dataset.subclass = activeElement;
  }
  document.documentElement.dataset.subclass = activeElement;

  const activeSuper = build.super;
  const superOptions = Array.isArray(build.superOptions) && build.superOptions.length
    ? build.superOptions
    : (activeSuper ? [activeSuper] : []);

  // Main Super Diamond
  const mainIcon = byId("superMainIcon");
  const superMainContainer = byId("superMain");
  if (mainIcon && activeSuper) {
    mainIcon.src = bungieUrl(activeSuper.icon);
    mainIcon.style.opacity = "1";
    if (superMainContainer) {
      superMainContainer.title = `Active Super: ${activeSuper.name || "Equipped"}`;
    }
  }

  // Variant Diamonds
  const alternates = superOptions.filter(opt => Number(opt.hash) !== Number(activeSuper?.hash));

  const sub0 = byId("superSub0");
  const sub0Icon = byId("superSub0Icon");
  if (sub0Icon) {
    if (alternates[0]) {
      sub0Icon.src = bungieUrl(alternates[0].icon);
      sub0Icon.style.opacity = "1";
      if (sub0) sub0.title = alternates[0].name || "Super Variant";
    } else {
      sub0Icon.style.opacity = "0";
    }
  }

  const sub1 = byId("superSub1");
  const sub1Icon = byId("superSub1Icon");
  if (sub1Icon) {
    if (alternates[1]) {
      sub1Icon.src = bungieUrl(alternates[1].icon);
      sub1Icon.style.opacity = "1";
      if (sub1) sub1.title = alternates[1].name || "Super Variant";
    } else {
      sub1Icon.style.opacity = "0";
    }
  }

  const sub2 = byId("superSub2");
  const sub2Icon = byId("superSub2Icon");
  if (sub2Icon && activeSuper) {
    sub2Icon.src = bungieUrl(activeSuper.icon);
    sub2Icon.style.opacity = "0.4";
    if (sub2) sub2.title = `${activeSuper.name || "Active Super"} (Equipped)`;
  }

  // Abilities List
  const abilities = Array.isArray(build.abilities) ? build.abilities : [];
  const abilityHost = byId("abilityList");
  if (abilityHost) {
    if (abilities.length) {
      abilityHost.innerHTML = abilities.map(item => `
        <div class="ability-row">
          <span class="ico-badge">${iconMarkup(item.icon, item.name)}</span>
          <div class="meta">
            <small>${escapeHtml(item.itemTypeDisplayName || subclassName)}</small>
            <b>${escapeHtml(item.name)}</b>
          </div>
        </div>
      `).join("");
    } else {
      abilityHost.innerHTML = "";
    }
  }

  // Aspects List
  const aspects = Array.isArray(build.aspects) ? build.aspects : [];
  const aspectHost = byId("aspectList");
  if (aspectHost) {
    if (aspects.length) {
      aspectHost.innerHTML = aspects.map(item => `
        <div class="slot">
          <span class="ico-badge">${iconMarkup(item.icon, item.name)}</span>
          <span class="nm">${escapeHtml(item.name)}</span>
        </div>
      `).join("");
    } else {
      aspectHost.innerHTML = "";
    }
  }

  // Fragments List
  const fragments = Array.isArray(build.fragments) ? build.fragments : [];
  const fragmentHost = byId("fragList");
  if (fragmentHost) {
    if (fragments.length) {
      fragmentHost.innerHTML = fragments.map(item => `
        <div class="slot">
          <span class="ico-badge">${iconMarkup(item.icon, item.name)}</span>
          <span class="nm">${escapeHtml(item.name)}</span>
        </div>
      `).join("");
    } else {
      fragmentHost.innerHTML = "";
    }
  }

  // Seasonal Artifact
  const artIcon = byId("artIcon");
  const artName = byId("artName");
  if (build.artifact) {
    if (artIcon && build.artifact.icon) artIcon.src = bungieUrl(build.artifact.icon);
    if (artName && build.artifact.name) artName.textContent = build.artifact.name.toUpperCase();
  }
}

function renderWeapons(weapons = []) {
  const host = byId("weaponList");
  if (!host) return;
  host.innerHTML = weapons.map(w => `
    <div class="slot">
      <span class="ico-badge">${iconMarkup(w?.icon, w?.name)}</span>
      <div class="meta"><small>${escapeHtml(w?.itemTypeDisplayName || "Weapon")}</small><b>${escapeHtml(w?.name || "Empty")}</b></div>
    </div>
  `).join("");
}

function bindArmourSlots(armour = []) {
  const host = byId("armourList");
  if (!host) return;
  host.innerHTML = armour.map(a => `
    <div class="slot">
      <span class="ico-badge">${iconMarkup(a?.icon, a?.name)}</span>
      <div class="meta"><small>${escapeHtml(a?.itemTypeDisplayName || "Armor")}</small><b>${escapeHtml(a?.name || "Empty")}</b></div>
    </div>
  `).join("");
}

function renderStats(stats = []) {
  const host = byId("statsGrid");
  if (!host) return;
  host.innerHTML = stats.map(([name, val]) => `
    <div class="stat-box">
      <span>${escapeHtml(name)}</span>
      <b>${Number(val) || 0}</b>
    </div>
  `).join("");
}

function updateIdentityCosmetics(data = {}) {
  const shaderNode = document.querySelector(".cos.sw.shader");
  const ghostNode = document.querySelector(".cos.sw.ghost");
  const shaderEl = shaderNode?.nextElementSibling?.querySelector("b");
  const ghostEl = ghostNode?.nextElementSibling?.querySelector("b");
  if (shaderEl) shaderEl.textContent = data.shader?.name || data.shader || "Default";
  if (ghostEl) ghostEl.textContent = data.ghost?.name || data.ghost || "Default";
}

function normaliseSelection(detail = {}) {
  const characterClass = String(
    detail.characterClass ?? detail.className ?? detail.classType ?? workspaceState.characterClass
  ).toLowerCase();
  const subclass = String(detail.subclass ?? workspaceState.subclass).toLowerCase();
  if (!VALID_CLASSES.includes(characterClass) || !VALID_SUBCLASSES.includes(subclass)) return null;
  return { ...workspaceState, ...detail, characterClass, subclass };
}

function applyGuardianSelection(detail) {
  const next = normaliseSelection(detail);
  if (!next) return;
  Object.assign(workspaceState, next);

  const stage = document.querySelector(".stage");
  const platform = byId("guardianPlatform");
  if (stage) {
    stage.dataset.class = next.characterClass;
    stage.dataset.subclass = next.subclass;
  }
  if (platform) {
    platform.classList.remove(...VALID_SUBCLASSES);
    platform.classList.add(next.subclass);
  }

  document.documentElement.dataset.subclass = (next.subclass || "arc").toLowerCase();

  if (next.subclassBuild) renderSubclassBuild(next.subclassBuild, next.subclassName);
  if (Array.isArray(next.weapons)) renderWeapons(next.weapons);
  if (Array.isArray(next.armour)) bindArmourSlots(next.armour);
  if (Array.isArray(next.stats)) renderStats(next.stats);
  updateIdentityCosmetics(next);
  renderVerifiedPreview(next);
  setStageState("ready");
}

document.addEventListener("astrix:guardian-selection-changed", event => {
  try {
    applyGuardianSelection(event.detail);
  } catch (error) {
    console.error("[ASTRIX Guardian render]", error);
    setStageState("error", "Guardian data arrived, but the workspace could not render it.");
  }
});

document.addEventListener("astrix:guardian-loading", () => setStageState("loading", "Loading Guardian data…"));
document.addEventListener("astrix:guardian-error", event =>
  setStageState("error", event.detail?.message || "Guardian data could not be loaded.")
);

bindArmourSlots([]);
setStageState("ready");

export { renderSubclassBuild, renderWeapons, bindArmourSlots, renderStats, renderVerifiedPreview };