/* ASTRIX PARADOX — bridge the existing live Super renderer into the new
 * Destiny-style feature frame. No Bungie fetch logic is changed here.
 * Important: this bridge is intentionally idempotent so it cannot observe
 * and continuously rebuild its own destination DOM.
 *
 * Live-data rule: never copy legacy/default Super state during page startup.
 * The bridge activates only after a resolved Guardian selection arrives.
 */

if (!document.querySelector('link[data-astrix-left-panel-lock]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './guardian-left-panel-lock.css?v=20260819-2058';
  link.dataset.astrixLeftPanelLock = 'true';
  document.head.appendChild(link);
}

const cluster = () => document.getElementById('superFeatureCluster');
let syncQueued = false;
let legacyObserver = null;
let observedLegacy = null;
let liveSelectionSeen = false;
let subclassManifestPromise = null;
const subclassIconCache = new Map();
const slotObservers = new Map();
const SUBCLASS_LABELS = Object.freeze({ arc:'AR', solar:'SO', void:'VO', stasis:'ST', strand:'SR', prismatic:'PR' });
const SUBCLASS_NAMES = Object.freeze({
  hunter:{ arc:'Arcstrider', solar:'Gunslinger', void:'Nightstalker', stasis:'Revenant', strand:'Threadrunner', prismatic:'Prismatic Hunter' },
  titan:{ arc:'Striker', solar:'Sunbreaker', void:'Sentinel', stasis:'Behemoth', strand:'Berserker', prismatic:'Prismatic Titan' },
  warlock:{ arc:'Stormcaller', solar:'Dawnblade', void:'Voidwalker', stasis:'Shadebinder', strand:'Broodweaver', prismatic:'Prismatic Warlock' }
});
const LEFT_PANEL_SLOT_TARGETS = Object.freeze({ abilityList:4, aspectList:2, fragList:5, artPerks:7 });

function makeEmptyRailSlot() {
  const slot = document.createElement('span');
  slot.className = 'rail-empty-slot';
  slot.setAttribute('aria-hidden', 'true');
  return slot;
}

function enforceSlotCount(id, target) {
  const host = document.getElementById(id);
  if (!host) return;
  while (host.children.length < target) host.appendChild(makeEmptyRailSlot());
}

function enforceLeftPanelSlots() {
  Object.entries(LEFT_PANEL_SLOT_TARGETS).forEach(([id, target]) => {
    enforceSlotCount(id, target);
    const host = document.getElementById(id);
    if (!host || slotObservers.has(id)) return;
    const observer = new MutationObserver(() => enforceSlotCount(id, target));
    observer.observe(host, { childList: true });
    slotObservers.set(id, observer);
  });
}

function sourceData(source, fallbackTitle = '') {
  const img = source?.querySelector('img');
  return { src: img?.currentSrc || img?.src || '', label: source?.getAttribute('aria-label') || source?.getAttribute('title') || fallbackTitle };
}

function setDiamond(diamond, source, fallbackTitle = '') {
  if (!diamond) return;
  const holder = diamond.querySelector('span');
  if (!holder) return;
  const { src, label } = sourceData(source, fallbackTitle);
  const previousSrc = diamond.dataset.liveIconSrc || '';
  const previousLabel = diamond.dataset.liveIconLabel || '';
  if (src === previousSrc && label === previousLabel) return;
  diamond.dataset.liveIconSrc = src;
  diamond.dataset.liveIconLabel = label;
  if (src) {
    let img = holder.querySelector('img.super-feature__icon');
    if (!img) {
      holder.textContent = '';
      img = document.createElement('img');
      img.className = 'super-feature__icon';
      holder.appendChild(img);
    }
    if (img.src !== src) img.src = src;
    img.alt = label || '';
    diamond.classList.add('has-live-icon');
  } else {
    if (holder.textContent !== '◆' || holder.children.length) holder.textContent = '◆';
    diamond.classList.remove('has-live-icon');
  }
  if (label) {
    if (diamond.title !== label) diamond.title = label;
    if (diamond.getAttribute('aria-label') !== label) diamond.setAttribute('aria-label', label);
  }
}

function normaliseClass(detail = {}) {
  return String(detail.characterClass || detail.className || '').trim().toLowerCase();
}

function subclassCacheKey(characterClass, element) {
  return `${characterClass || 'unknown'}:${element}`;
}

async function preloadSubclassManifestIcons() {
  if (subclassManifestPromise) return subclassManifestPromise;
  subclassManifestPromise = fetch('../../data/paradox-forge/beta/beta-bungie-identities.json', { cache:'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`subclass_identity_cache_${response.status}`);
      return response.json();
    })
    .then(payload => {
      const identities = Array.isArray(payload?.identities) ? payload.identities : [];
      const byName = new Map(identities.filter(row => row?.name && row?.icon).map(row => [String(row.name), String(row.icon)]));
      Object.entries(SUBCLASS_NAMES).forEach(([characterClass, elements]) => {
        Object.entries(elements).forEach(([element, name]) => {
          const icon = byName.get(name) || '';
          if (icon) subclassIconCache.set(subclassCacheKey(characterClass, element), icon);
        });
      });
      return true;
    })
    .catch(error => {
      console.warn('[ASTRIX subclass icons]', error);
      return false;
    });
  return subclassManifestPromise;
}

function paintSubclassRail(characterClass, element) {
  document.querySelectorAll('[data-subclass-option]').forEach(button => {
    const key = String(button.dataset.subclassOption || '').trim().toLowerCase();
    const holder = button.querySelector('.subclass-option__diamond > span');
    if (!holder) return;
    const cachedIcon = characterClass ? subclassIconCache.get(subclassCacheKey(characterClass, key)) || '' : '';
    button.classList.toggle('is-active', key === element);
    if (cachedIcon) {
      let img = holder.querySelector('img.subclass-option__icon');
      if (!img) {
        holder.textContent = '';
        img = document.createElement('img');
        img.className = 'subclass-option__icon';
        holder.appendChild(img);
      }
      const absolute = cachedIcon.startsWith('http') ? cachedIcon : `https://www.bungie.net${cachedIcon}`;
      if (img.src !== absolute) img.src = absolute;
      img.alt = `${SUBCLASS_NAMES[characterClass]?.[key] || key} subclass`;
      button.title = SUBCLASS_NAMES[characterClass]?.[key] || key;
      return;
    }
    holder.querySelector('img.subclass-option__icon')?.remove();
    const fallback = SUBCLASS_LABELS[key] || key.slice(0,2).toUpperCase();
    if (holder.textContent !== fallback) holder.textContent = fallback;
  });
}

async function syncSubclassRail(detail = {}) {
  const element = String(detail.subclass || '').trim().toLowerCase();
  const characterClass = normaliseClass(detail);
  const icon = String(detail.subclassIcon || '').trim();
  if (characterClass && element && icon) subclassIconCache.set(subclassCacheKey(characterClass, element), icon);
  paintSubclassRail(characterClass, element);
  await preloadSubclassManifestIcons();
  paintSubclassRail(characterClass, element);
}

function syncFromLegacySuperRenderer() {
  syncQueued = false;
  if (!liveSelectionSeen) return;
  const host = cluster();
  const legacy = document.getElementById('superFocus');
  if (!host || !legacy) return;
  const options = [...legacy.querySelectorAll('.super-option')];
  const active = legacy.querySelector('.super-option.is-active') || options[0];
  const inactive = options.filter(option => option !== active).slice(0,3);
  const equippedName = legacy.querySelector('.super-equipped-name')?.textContent?.trim();
  setDiamond(host.querySelector('[data-super-slot="equipped"]'), active, equippedName || 'Equipped Super');
  ['alternate-1','alternate-2','alternate-3'].forEach((slot,index) => setDiamond(host.querySelector(`[data-super-slot="${slot}"]`), inactive[index], 'Alternate Super'));
  const label = document.getElementById('subclassName');
  if (label && equippedName) {
    label.textContent = equippedName;
    label.dataset.superName = equippedName;
  }
  bindLegacyObserver();
}

function syncSoon() {
  if (!liveSelectionSeen || syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(syncFromLegacySuperRenderer);
}

function bindLegacyObserver() {
  if (!liveSelectionSeen) return;
  const legacy = document.getElementById('superFocus');
  if (!legacy || legacy === observedLegacy) return;
  legacyObserver?.disconnect();
  observedLegacy = legacy;
  legacyObserver = new MutationObserver(syncSoon);
  legacyObserver.observe(legacy, { subtree:true, childList:true, attributes:true, attributeFilter:['src','class','aria-label','title'] });
}

document.addEventListener('astrix:guardian-selection-changed', event => {
  liveSelectionSeen = true;
  void syncSubclassRail(event.detail || {});
  enforceLeftPanelSlots();
  bindLegacyObserver();
  syncSoon();
});

document.addEventListener('astrix:artifact-recommendations-changed', () => {
  enforceLeftPanelSlots();
  if (liveSelectionSeen) syncSoon();
});

void preloadSubclassManifestIcons();
enforceLeftPanelSlots();
