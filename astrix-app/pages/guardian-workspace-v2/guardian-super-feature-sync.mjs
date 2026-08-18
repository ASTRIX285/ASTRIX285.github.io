/* ASTRIX PARADOX — bridge the existing live Super renderer into the new
 * Destiny-style feature frame. No Bungie fetch logic is changed here. */

const feature = () => document.querySelector('.left .super-feature');
const cluster = () => document.getElementById('superFeatureCluster');

function setDiamond(diamond, source, fallbackTitle = '') {
  if (!diamond) return;
  const sourceImg = source?.querySelector('img');
  const sourceLabel = source?.getAttribute('aria-label') || source?.getAttribute('title') || fallbackTitle;
  const holder = diamond.querySelector('span');
  if (!holder) return;

  holder.innerHTML = '';
  if (sourceImg?.src) {
    const img = document.createElement('img');
    img.src = sourceImg.src;
    img.alt = sourceLabel || '';
    img.className = 'super-feature__icon';
    holder.appendChild(img);
    diamond.classList.add('has-live-icon');
  } else {
    holder.textContent = '◆';
    diamond.classList.remove('has-live-icon');
  }
  if (sourceLabel) {
    diamond.title = sourceLabel;
    diamond.setAttribute('aria-label', sourceLabel);
  }
}

function syncFromLegacySuperRenderer() {
  const host = cluster();
  if (!host) return;

  const legacy = document.getElementById('superFocus');
  if (!legacy) return;

  const options = [...legacy.querySelectorAll('.super-option')];
  const active = legacy.querySelector('.super-option.is-active') || options[0];
  const inactive = options.filter(option => option !== active).slice(0, 3);
  const equippedName = legacy.querySelector('.super-equipped-name')?.textContent?.trim();

  setDiamond(host.querySelector('[data-super-slot="equipped"]'), active, equippedName || 'Equipped Super');
  ['alternate-1', 'alternate-2', 'alternate-3'].forEach((slot, index) => {
    setDiamond(host.querySelector(`[data-super-slot="${slot}"]`), inactive[index], 'Alternate Super');
  });

  const label = document.getElementById('subclassName');
  if (label) {
    const subclass = document.querySelector('.subclass-hero b')?.textContent?.replace(/\s*▾\s*$/, '').trim();
    if (subclass) label.textContent = subclass;
  }

  legacy.classList.add('super-focus--mirrored');
}

function syncSoon() {
  requestAnimationFrame(() => requestAnimationFrame(syncFromLegacySuperRenderer));
}

document.addEventListener('astrix:guardian-selection-changed', syncSoon);
document.addEventListener('astrix:artifact-recommendations-changed', syncSoon);
document.addEventListener('DOMContentLoaded', syncSoon);

const left = document.querySelector('.left');
if (left) {
  const observer = new MutationObserver(syncSoon);
  observer.observe(left, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'class'] });
}

syncSoon();
