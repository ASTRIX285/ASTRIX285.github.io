/* ASTRIX PARADOX — bridge the existing live Super renderer into the new
 * Destiny-style feature frame. No Bungie fetch logic is changed here.
 *
 * Subclass rule: the six subclass icons/positions are static presentation.
 * Live Bungie data only toggles which fixed subclass button is active.
 */

if (!document.querySelector('link[data-astrix-left-panel-lock]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './guardian-left-panel-lock.css?v=20260820-0004';
  link.dataset.astrixLeftPanelLock = 'true';
  document.head.appendChild(link);
}

const cluster = () => document.getElementById('superFeatureCluster');
let syncQueued = false;
let legacyObserver = null;
let observedLegacy = null;
let liveSelectionSeen = false;
const slotObservers = new Map();
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

function syncSubclassRail(detail = {}) {
  const activeElement = String(detail.subclass || '').trim().toLowerCase();
  document.querySelectorAll('[data-subclass-option]').forEach(button => {
    const key = String(button.dataset.subclassOption || '').trim().toLowerCase();
    const active = Boolean(activeElement) && key === activeElement;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
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
  syncSubclassRail(event.detail || {});
  enforceLeftPanelSlots();
  bindLegacyObserver();
  syncSoon();
});

document.addEventListener('astrix:artifact-recommendations-changed', () => {
  enforceLeftPanelSlots();
  if (liveSelectionSeen) syncSoon();
});

enforceLeftPanelSlots();
