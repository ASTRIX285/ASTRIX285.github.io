/* ==========================================================================
   ASTRIX PARADOX - GEAR & ARMOUR MOD LAYOUT CONTROLLER
   Builds the 5-column equipment grid (Helmet to Class Item), maps functional
   mod slots, exotic intrinsic traits, and appearance sockets, and binds
   interactive inspection triggers.
   ========================================================================== */

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
  );

const armourNames = ['Helmet', 'Gauntlets', 'Chest Armour', 'Leg Armour', 'Class Item'];

function loadCss() {
  if (!document.querySelector('link[href="./guardian-gear-layout.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = './guardian-gear-layout.css';
    document.head.appendChild(l);
  }

  if (!document.getElementById('pf-gear-layout-final')) {
    const style = document.createElement('style');
    style.id = 'pf-gear-layout-final';
    style.textContent = `
      .equip.gear-layout-active {
        grid-template-columns: clamp(220px, 20vw, 286px) minmax(0, 1fr) !important;
        gap: 12px !important;
        align-items: start !important;
      }
      .gear-weapons {
        min-height: 0 !important;
        height: max-content !important;
        align-self: start !important;
      }
      .gear-weapons .weap-grid {
        grid-template-columns: repeat(3, minmax(76px, 84px)) !important;
        gap: 7px !important;
        justify-content: start !important;
        align-items: start !important;
      }
      .gear-weapons .weap {
        width: 100% !important;
        max-width: 84px !important;
      }
      .gear-weapons .weap .art {
        width: 100% !important;
        height: auto !important;
        aspect-ratio: 1 / 1 !important;
        min-height: 76px !important;
      }
      .gear-weapons .weap .cap {
        width: 100% !important;
        padding: 5px 1px 0 !important;
      }
      .gear-weapons .weap .cap b {
        font-size: 0.55rem !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .gear-combined {
        min-width: 0 !important;
        min-height: 236px !important;
      }
      .gear-columns {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 6px !important;
        align-items: stretch !important;
      }
      .gear-slot {
        min-width: 0 !important;
        min-height: 205px !important;
        padding: 6px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
      }
      .gear-slot-label {
        margin-bottom: 1px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      .gear-arm-row {
        min-height: 96px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
      }
      .gear-arm-anchor .arm {
        width: 90px !important;
        height: 90px !important;
        min-width: 90px !important;
        min-height: 90px !important;
        cursor: pointer !important;
      }
      .gear-slot.exotic .gear-arm-anchor {
        transform: none !important;
      }
      .gear-slot:not(.exotic) .gear-intrinsic {
        display: none !important;
      }
      .gear-intrinsic {
        width: 46px !important;
        height: 46px !important;
        min-width: 46px !important;
        min-height: 46px !important;
        flex: 0 0 46px !important;
      }
      .gear-appearance-row {
        min-height: 38px !important;
        margin: 2px 0 !important;
        gap: 6px !important;
      }
      .gear-appearance {
        width: 38px !important;
        height: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
      }
      .gear-slot-divider {
        margin: 1px 0 4px !important;
      }
      .gear-mods {
        display: grid !important;
        grid-template-columns: repeat(5, var(--pf-mod-size, 46px)) !important;
        grid-template-rows: var(--pf-mod-size, 46px) !important;
        grid-auto-rows: var(--pf-mod-size, 46px) !important;
        gap: 7px !important;
        width: 100% !important;
        justify-content: center !important;
        align-content: start !important;
      }
      .gear-mod {
        width: var(--pf-mod-size, 46px) !important;
        height: var(--pf-mod-size, 46px) !important;
        min-width: var(--pf-mod-size, 46px) !important;
        min-height: var(--pf-mod-size, 46px) !important;
        max-width: var(--pf-mod-size, 46px) !important;
        max-height: var(--pf-mod-size, 46px) !important;
        aspect-ratio: 1 / 1 !important;
        border-radius: 7px !important;
      }
      .gear-mod img {
        width: 88% !important;
        height: 88% !important;
        object-fit: contain !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function syncModSizeToArtifact() {
  const artifact = document.querySelector('.artifact-perk');
  const mod = document.querySelector('.gear-mod');
  if (!artifact || !mod) return;

  const target = artifact.getBoundingClientRect().width;
  const actual = mod.getBoundingClientRect().width;
  const css = parseFloat(getComputedStyle(mod).width) || 46;

  if (target > 0 && actual > 0) {
    const corrected = Math.max(24, Math.min(90, css * (target / actual)));
    document.documentElement.style.setProperty('--pf-mod-size', `${corrected}px`);
  }
}

function modTile(mod) {
  const name = mod?.name ?? mod?.displayName ?? 'Empty mod slot';
  const icon = mod?.icon ?? mod?.iconUrl ?? mod?.displayProperties?.icon ?? '';
  const cost = mod?.energyCost ?? mod?.cost ?? '';
  return `<button class="gear-mod" type="button" title="${esc(name)}" aria-label="${esc(
    name
  )}" ${cost !== '' ? `data-cost="${esc(cost)}"` : ''}>${
    icon
      ? `<img src="${esc(icon)}" alt="">`
      : '<span class="ph-glyph">◆</span>'
  }</button>`;
}

function appearanceTile(item) {
  if (!item) return '';
  const name = item?.name ?? item?.displayName ?? 'Appearance plug';
  const description = item?.description ?? '';
  const hash = item?.bungieHash ?? item?.hash ?? '';
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? '';
  const title = [name, description, hash ? `Bungie hash: ${hash}` : '']
    .filter(Boolean)
    .join(' — ');
  return `<button class="gear-appearance" type="button" title="${esc(title)}" aria-label="${esc(
    name
  )}">${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">◇</span>'}</button>`;
}

function traitTile(trait) {
  if (!trait) return '';
  const name = trait?.name ?? 'Exotic intrinsic trait';
  const description = trait?.description ?? '';
  const hash = trait?.bungieHash ?? trait?.hash ?? '';
  const icon = trait?.icon ?? '';
  const title = [name, description, hash ? `Bungie hash: ${hash}` : '']
    .filter(Boolean)
    .join(' — ');
  return `<button class="gear-intrinsic" type="button" title="${esc(title)}" aria-label="${esc(
    name
  )}">${icon ? `<img src="${esc(icon)}" alt="">` : '<span class="ph-glyph">✦</span>'}</button>`;
}

function armourCard(index, item) {
  const name = item?.name ?? armourNames[index];
  const icon = item?.icon ?? item?.iconUrl ?? item?.displayProperties?.icon ?? '';
  const rarity = String(item?.rarity ?? item?.tier ?? '').toLowerCase();
  const isExotic = item?.isExotic === true || rarity.includes('exotic');
  const trait = isExotic ? item?.intrinsicTrait ?? null : null;
  const mods = Array.isArray(item?.mods) ? item.mods : [];
  const appearance = Array.isArray(item?.appearancePlugs) ? item.appearancePlugs : [];
  const slotCount = 5;

  return `<article class="gear-slot ${isExotic ? 'exotic' : ''}" data-armour-index="${index}">
    <div class="gear-slot-label" title="${esc(name)}">${esc(name)}</div>
    <div class="gear-arm-row">
      <div class="gear-arm-anchor">
        <div class="arm ${icon ? '' : 'ph'}" tabindex="0" role="button" title="${esc(name)}" data-slot-index="${index}">
          <span class="lv">${esc(item?.power ?? '—')}</span>
          ${icon ? `<img src="${esc(icon)}" alt="${esc(name)}">` : '<span class="ph-glyph">◇</span>'}
        </div>
      </div>
      ${isExotic && trait ? traitTile(trait) : ''}
    </div>
    ${
      appearance.length
        ? `<div class="gear-appearance-row">${appearance
            .slice(0, 2)
            .map(appearanceTile)
            .join('')}</div>`
        : ''
    }
    <div class="gear-slot-divider"></div>
    <div class="gear-mods" data-slot-count="${slotCount}">${Array.from(
    { length: slotCount },
    (_, i) => modTile(mods[i])
  ).join('')}</div>
  </article>`;
}

function bindGearCardInteractions(armour = []) {
  const slots = document.querySelectorAll('.gear-arm-anchor .arm');
  slots.forEach((slot, index) => {
    const item = armour[index] ?? null;
    slot.onclick = () => {
      document.dispatchEvent(
        new CustomEvent('astrix:open-armour-inspector', {
          detail: { index, item }
        })
      );
    };
    slot.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        slot.click();
      }
    };
  });
}

function buildGear(armour = []) {
  const gear = document.querySelector('.gear-combined');
  if (!gear) return;
  const container = gear.querySelector('.gear-columns');
  if (!container) return;

  container.innerHTML = Array.from({ length: 5 }, (_, i) =>
    armourCard(i, armour[i])
  ).join('');

  bindGearCardInteractions(armour);

  requestAnimationFrame(() => {
    syncModSizeToArtifact();
    requestAnimationFrame(syncModSizeToArtifact);
  });
}

function initialise() {
  loadCss();
  const equip = document.querySelector('.equip');
  const right = document.querySelector('.panel.right, .right');
  if (!equip) return;

  const cards = [...equip.children];
  const weapons = cards.find(
    (c) => c.querySelector('h3')?.textContent.trim() === 'WEAPONS'
  );
  const armour = cards.find(
    (c) => c.querySelector('h3')?.textContent.trim() === 'ARMOUR'
  );
  const mods = cards.find(
    (c) => c.querySelector('h3')?.textContent.trim() === 'MODS'
  );
  const activity =
    cards.find((c) => c.classList.contains('activity')) ||
    document.querySelector('.left .activity');

  if (activity && right && !right.contains(activity)) {
    activity.classList.add('analysis-activity');
    const improvement = right.querySelector('.improve');
    if (improvement) right.insertBefore(activity, improvement);
    else right.appendChild(activity);
  }

  if (weapons) weapons.classList.add('gear-weapons');
  if (armour) armour.remove();
  if (mods) mods.remove();

  if (!equip.querySelector('.gear-combined')) {
    equip.insertAdjacentHTML(
      'beforeend',
      `<section class="eq gear-combined">
        <div class="eq-head">
          <h3>ARMOUR & MODS</h3>
          <span class="tools">EQUIPPED</span>
        </div>
        <div class="gear-subhead">
          <span>Armour above · 5 functional mod slots below</span>
          <span>Hover any sourced icon for Bungie details</span>
        </div>
        <div class="gear-columns"></div>
      </section>`
    );
  }

  equip.classList.add('gear-layout-active');
  buildGear([]);
}

document.addEventListener('astrix:guardian-selection-changed', (e) => {
  if (Array.isArray(e.detail?.armour)) {
    buildGear(e.detail.armour);
  }
});

window.addEventListener('resize', () =>
  requestAnimationFrame(syncModSizeToArtifact)
);

initialise();