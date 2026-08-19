/* ASTRIX PARADOX — bridge the existing live Super renderer into the new
 * Destiny-style feature frame. No Bungie fetch logic is changed here.
 * Important: this bridge is intentionally idempotent so it cannot observe
 * and continuously rebuild its own destination DOM.
 *
 * Live-data rule: never copy legacy/default Super state during page startup.
 * The bridge activates only after a resolved Guardian selection arrives.
 */

const cluster = () => document.getElementById('superFeatureCluster');
let syncQueued = false;
let legacyObserver = null;
let observedLegacy = null;
let liveSelectionSeen = false;
const subclassIconCache = new Map();

function sourceData(source, fallbackTitle = '') {
  const img = source?.querySelector('img');
  return {
    src: img?.currentSrc || img?.src || '',
    label: source?.getAttribute('aria-label') || source?.getAttribute('title') || fallbackTitle
  };
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
  const element = String(detail.subclass || '').toLowerCase();
  const icon = detail.subclassIcon || '';
  if (element && icon) subclassIconCache.set(element, icon);

  document.querySelectorAll('[data-subclass-option]').forEach(button => {
    const key = String(button.dataset.subclassOption || '').toLowerCase();
    const holder = button.querySelector('.subclass-option__diamond > span');
    if (!holder) return;
    const cachedIcon = subclassIconCache.get(key) || '';
    const isActive = key === element;
    button.classList.toggle('is-active', isActive);
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
      img.alt = `${key} subclass`;
    }
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
  const inactive = options.filter(option => option !== active).slice(0, 3);
  const equippedName = legacy.querySelector('.super-equipped-name')?.textContent?.trim();

  setDiamond(host.querySelector('[data-super-slot="equipped"]'), active, equippedName || 'Equipped Super');
  ['alternate-1', 'alternate-2', 'alternate-3'].forEach((slot, index) => {
    setDiamond(host.querySelector(`[data-super-slot="${slot}"]`), inactive[index], 'Alternate Super');
  });

  const label = document.getElementById('subclassName');
  if (label && equippedName && label.dataset.superName !== equippedName) {
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
  legacyObserver.observe(legacy, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'aria-label', 'title']
  });
}

document.addEventListener('astrix:guardian-selection-changed', event => {
  liveSelectionSeen = true;
  syncSubclassRail(event.detail || {});
  bindLegacyObserver();
  syncSoon();
});

document.addEventListener('astrix:artifact-recommendations-changed', () => {
  if (liveSelectionSeen) syncSoon();
});
