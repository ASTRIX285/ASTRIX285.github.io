import "./guardian-semantic-interceptor.mjs";
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

const bungieUrl = path => {
  if (!path) return "";
  return path.startsWith("http") ? path : `https://www.bungie.net${path}`;
};

function resolvedDisplayIcon(item) {
  if (!item) return "";
  const display = item?.definition?.displayProperties || item?.displayProperties || {};
  const sequenceFrame = Array.isArray(display?.iconSequences)
    ? display.iconSequences.flatMap(sequence => Array.isArray(sequence?.frames) ? sequence.frames : []).find(Boolean)
    : "";
  return item.icon || display.icon || display.highResIcon || sequenceFrame || item?.definition?.secondaryIcon || item?.secondaryIcon || "";
}

const iconMarkup = (icon, name) => {
  const url = bungieUrl(icon);
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(name || '')}" loading="lazy" decoding="async" onerror="this.style.opacity=0">`
    : `<span class="ico-fb">◆</span>`;
};

const itemIconMarkup = item => iconMarkup(resolvedDisplayIcon(item), item?.name);

const emptyRailSlot = () => `<span class="rail-empty-slot" aria-hidden="true"></span>`;
const padRailSlots = (markup, filled, target) => `${markup}${Array.from({ length: Math.max(0, target - filled) }, emptyRailSlot).join("")}`;

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
  if (stage) stage.dataset.state = state || "ready";
  clearTimeout(stageLoadingTimer);

  const titleNode = byId("stageStateTitle");
  const msgNode = byId("stageStateMessage");

  if (titleNode) {
    if (state === "loading") titleNode.textContent = "SYNCING TELEMETRY";
    else if (state === "error") titleNode.textContent = "TELEMETRY UNAVAILABLE";
    else titleNode.textContent = "GUARDIAN TELEMETRY";
  }

  if (msgNode) {
    if (state === "loading") msgNode.textContent = message || "Loading Guardian profile from Bungie API…";
    else if (state === "error") msgNode.textContent = message || "Guardian data could not be resolved.";
    else msgNode.textContent = message || "Select a character or loadout to inspect live data metrics.";
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
  const activeElement = (workspaceState.subclass || "arc").toLowerCase();
  document.documentElement.dataset.subclass = activeElement;

  const activeSuper = build.super;
  const superOptions = Array.isArray(build.superOptions) && build.superOptions.length
    ? build.superOptions
    : (activeSuper ? [activeSuper] : []);

  const alternates = superOptions.filter(opt => Number(opt.hash) !== Number(activeSuper?.hash));
  const featureHost = byId("superFeatureCluster");
  if (featureHost) {
    const slots = [activeSuper, alternates[0] || null, alternates[1] || null, alternates[2] || null];
    featureHost.querySelectorAll("[data-super-slot]").forEach((slot, index) => {
      const item = slots[index];
      const holder = slot.querySelector("span");
      if (!holder) return;
      const icon = resolvedDisplayIcon(item);
      if (icon) {
        holder.innerHTML = iconMarkup(icon, item?.name);
        slot.classList.add("has-live-icon");
        slot.title = item?.name || (index === 0 ? "Equipped Super" : "Alternate Super");
      } else {
        holder.innerHTML = "◆";
        slot.classList.remove("has-live-icon");
        slot.title = item?.name ? `${item.name} · icon unresolved` : (index === 0 ? "Equipped Super icon unresolved" : "Alternate Super unresolved");
      }
    });
  }

  const subclassNameNode = byId("subclassName");
  if (subclassNameNode) subclassNameNode.textContent = activeSuper?.name || subclassName || "SELECTED SUPER";

  const abilities = Array.isArray(build.abilities) ? build.abilities.slice(0, 4) : [];
  const abilityHost = byId("abilityList");
  if (abilityHost) {
    const markup = abilities.map(item => `
      <div class="ability-row" title="${escapeHtml(item.name)}">
        <span class="ico-badge">${itemIconMarkup(item)}</span>
        <div class="meta"><small>${escapeHtml(item.itemTypeDisplayName || subclassName)}</small><b>${escapeHtml(item.name)}</b></div>
      </div>
    `).join("");
    abilityHost.innerHTML = padRailSlots(markup, abilities.length, 4);
  }

  const aspects = Array.isArray(build.aspects) ? build.aspects.slice(0, 2) : [];
  const aspectHost = byId("aspectList");
  if (aspectHost) {
    const markup = aspects.map(item => `
      <div class="slot" title="${escapeHtml(item.name)}">
        <span class="ico-badge">${itemIconMarkup(item)}</span>
        <span class="nm">${escapeHtml(item.name)}</span>
      </div>
    `).join("");
    aspectHost.innerHTML = padRailSlots(markup, aspects.length, 2);
  }

  const fragments = Array.isArray(build.fragments) ? build.fragments.slice(0, 5) : [];
  const fragmentHost = byId("fragList");
  if (fragmentHost) {
    const markup = fragments.map(item => `
      <div class="slot" title="${escapeHtml(item.name)}">
        <span class="ico-badge">${itemIconMarkup(item)}</span>
        <span class="nm">${escapeHtml(item.name)}</span>
      </div>
    `).join("");
    fragmentHost.innerHTML = padRailSlots(markup, fragments.length, 5);
  }

  const artifact = build.artifact || null;
  const artIcon = byId("artIcon");
  const artName = byId("artName");
  if (artifact) {
    if (artIcon) {
      const artifactIcon = resolvedDisplayIcon(artifact);
      if (artifactIcon) artIcon.src = bungieUrl(artifactIcon);
      artIcon.alt = artifact.name || "Seasonal Artifact";
    }
    if (artName) artName.textContent = String(artifact.name || "SEASONAL ARTIFACT").toUpperCase();
  }

  // Applied Artifact perks are an active-state contract. A perk being visible in
  // the seasonal Artifact grid does not mean that the Guardian has applied it.
  // Never substitute visible tier choices when Bungie reports no active perks.
  const artifactPerks = Array.isArray(artifact?.activePerks)
    ? artifact.activePerks.filter(item => item?.isActive === true)
    : [];
  const artifactHost = byId("artPerks");
  if (artifactHost) {
    const appliedPerks = artifactPerks.slice(0, 7);
    const markup = appliedPerks.map(item => `
      <div class="slot" title="${escapeHtml(item.name)}">
        <span class="ico-badge">${itemIconMarkup(item)}</span>
        <span class="nm">${escapeHtml(item.name)}</span>
      </div>
    `).join("");
    artifactHost.dataset.artifactState = appliedPerks.length ? "active" : "unresolved";
    artifactHost.title = appliedPerks.length ? `${appliedPerks.length} applied Artifact perk(s)` : "No applied Artifact perks resolved from Bungie live state";
    artifactHost.innerHTML = padRailSlots(markup, appliedPerks.length, 7);
  }
}

function ensureLayoutPlaceholders() {
  const targets = [["abilityList",4],["aspectList",2],["fragList",5],["artPerks",7]];
  targets.forEach(([id,count]) => {
    const host = byId(id);
    if (!host || host.children.length) return;
    host.innerHTML = Array.from({ length: count }, emptyRailSlot).join("");
  });
}

function renderWeapons(weapons = []) {
  const host = byId("weaponList");
  if (!host) return;
  host.innerHTML = weapons.map(w => `
    <div class="slot">
      <span class="ico-badge">${itemIconMarkup(w)}</span>
      <div class="meta"><small>${escapeHtml(w?.itemTypeDisplayName || "Weapon")}</small><b>${escapeHtml(w?.name || "Empty")}</b></div>
    </div>
  `).join("");
}

function bindArmourSlots(armour = []) {
  const host = byId("armourList");
  if (!host) return;
  host.innerHTML = armour.map(a => `
    <div class="slot">
      <span class="ico-badge">${itemIconMarkup(a)}</span>
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

  if (next.subclassBuild) renderSubclassBuild({...next.subclassBuild,artifact:next.artifact||null}, next.subclassName);
  else ensureLayoutPlaceholders();
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
ensureLayoutPlaceholders();
setStageState("ready");

export { renderSubclassBuild, renderWeapons, bindArmourSlots, renderStats, renderVerifiedPreview, resolvedDisplayIcon };
