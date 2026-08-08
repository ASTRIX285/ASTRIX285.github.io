/* guardian-artifact.mjs — Paradox Forge Artifact ownership.
 *
 * A DIM build export does NOT preserve Artifact perk selections, so Paradox
 * owns Artifact state here. On each fixture load this reads that build's
 * DIM-unlocked perks (when present) as a starting point, renders the real
 * manifest artifact, and lets the tester open a picker to edit the selection.
 * Nothing is invented: perks the manifest cache cannot resolve are shown
 * honestly as "Unresolved perk <hash>" rather than faked.
 *
 * Loaded LAST in index.html so it is the single owner of #artName / #artIcon /
 * #artPerks and overrides the static preview and the advisor layer for those
 * nodes. It does not touch class, hero, weapons, armour or stats.
 */

const MANIFEST_URL = '../../data/paradox-forge/beta/beta-bungie-manifest-cache.json';
const BUNGIE_ROOT  = 'https://www.bungie.net';
const MAX_PERKS     = 12;   // Artifact unlock columns available in the beta
const PANEL_ICONS   = 6;    // how many perk icons to show inline before "+N"
const OVERRIDE_KEY  = 'astrix-paradox-artifact-overrides'; // { [fixtureId]: number[] }

const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const absIcon = v => { const s = String(v ?? '').trim(); return !s ? '' : (s.startsWith('http') ? s : `${BUNGIE_ROOT}${s}`); };

let manifest = null;
let artifactDef = null;
let currentFixtureId = null;
let selected = [];          // array of perk hashes (numbers) for the current build

/* ---------- data ---------- */

async function ensureManifest() {
  if (manifest) return;
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Artifact manifest load failed: ${res.status}`);
  manifest = await res.json();
  artifactDef = Object.values(manifest.artifacts ?? {})[0] ?? null;
}

function perkIdentity(hash) {
  const row = manifest?.inventoryItems?.[String(hash)] ?? null;
  if (!row || !row.display?.name) {
    return { hash: Number(hash), name: `Unresolved perk ${hash}`, description: '', icon: '', unresolved: true };
  }
  return {
    hash: Number(hash),
    name: row.display.name,
    description: row.display.description || '',
    icon: absIcon(row.display.icon),
    unresolved: false
  };
}

function artifactIdentity() {
  if (!artifactDef) return null;
  return {
    hash: Number(artifactDef.bungieHash ?? artifactDef.hash ?? 0),
    name: artifactDef.display?.name || 'Seasonal Artifact',
    description: artifactDef.display?.description || '',
    icon: absIcon(artifactDef.display?.icon)
  };
}

function tierList() {
  return (artifactDef?.tiers ?? []).map(t => ({
    tier: Number(t.tier ?? 0),
    perks: (t.itemHashes ?? []).map(perkIdentity)
  }));
}

/* ---------- persistence ---------- */

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') || {}; }
  catch { return {}; }
}

function saveOverride(fixtureId, hashes) {
  if (!fixtureId) return;
  const all = loadOverrides();
  all[fixtureId] = hashes.slice();
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(all)); } catch { /* storage may be blocked */ }
}

/* current selection = tester override for this build if it exists,
 * otherwise the build's own DIM-unlocked perks, otherwise empty. */
function selectionForFixture(detail) {
  const overrides = loadOverrides();
  if (currentFixtureId && Array.isArray(overrides[currentFixtureId])) {
    return overrides[currentFixtureId].map(Number).filter(Number.isFinite);
  }
  const perks = detail?.artifact?.perks;
  if (Array.isArray(perks) && perks.length) {
    return perks.map(p => Number(p?.hash ?? p?.bungieHash)).filter(Number.isFinite);
  }
  return [];
}

/* ---------- rendering ---------- */

function renderArtifactDisplay() {
  const id = artifactIdentity();
  if (!id) return;

  const nameEl = qs('#artName');
  const iconEl = qs('#artIcon');
  const perksEl = qs('#artPerks');

  if (nameEl) nameEl.textContent = id.name;
  if (iconEl) {
    iconEl.src = id.icon;
    iconEl.alt = id.name;
    iconEl.style.opacity = id.icon ? '1' : '0';
  }

  if (perksEl) {
    if (!selected.length) {
      perksEl.innerHTML = '<button type="button" class="art-empty" tabindex="-1">Choose Artifact perks</button>';
    } else {
      const perks = selected.map(perkIdentity);
      const shown = perks.slice(0, PANEL_ICONS);
      const extra = perks.length - shown.length;
      perksEl.innerHTML = shown.map(p => p.icon
        ? `<img src="${esc(p.icon)}" alt="${esc(p.name)}" title="${esc(p.name)}" onerror="this.style.display='none'">`
        : `<span class="artifact-perk" title="${esc(p.name)}" aria-label="${esc(p.name)}">◆</span>`
      ).join('') + (extra > 0 ? `<span class="art-more" title="${extra} more selected">+${extra}</span>` : '');
    }
  }

  document.dispatchEvent(new CustomEvent('astrix:artifact-selection-changed', {
    detail: { artifact: id, perks: selected.map(perkIdentity), fixtureId: currentFixtureId, source: 'paradox-artifact' }
  }));
}

/* ---------- picker ---------- */

function closePicker() { qs('#astrixArtifactModal')?.remove(); }

function openPicker() {
  const tiers = tierList();
  if (!tiers.length) return;

  const id = artifactIdentity();
  const draft = selected.slice();

  const tiersHtml = tiers.map(t => `
    <section class="beta-artifact-tier">
      <h3>TIER ${t.tier}</h3>
      <div class="beta-artifact-grid">
        ${t.perks.map(p => `
          <button type="button" class="beta-artifact-choice ${draft.includes(p.hash) ? 'selected' : ''} ${p.unresolved ? 'unresolved' : ''}"
                  data-perk-hash="${p.hash}" title="${esc([p.name, p.description].filter(Boolean).join(' — '))}" aria-label="${esc(p.name)}">
            <span class="beta-artifact-icon">${p.icon ? `<img src="${esc(p.icon)}" alt="" onerror="this.style.display='none'">` : '◆'}</span>
            <b>${esc(p.name)}</b>
          </button>`).join('')}
      </div>
    </section>`).join('');

  const wrap = document.createElement('div');
  wrap.id = 'astrixArtifactModal';
  wrap.className = 'beta-modal-backdrop';
  wrap.innerHTML = `
    <section class="beta-modal beta-artifact-modal" role="dialog" aria-modal="true" aria-label="Artifact perk selection">
      <header>
        <div><small>PARADOX FORGE BETA</small><h2>${esc(id?.name || 'Seasonal Artifact')}</h2></div>
        <button type="button" data-close aria-label="Close">✕</button>
      </header>
      <div class="beta-modal-body">
        <p class="beta-note">DIM build exports don't include the Artifact, so Paradox owns this selection. Pick the perks this build runs — up to ${MAX_PERKS}. Nothing here is invented; perks the manifest can't resolve are labelled as unresolved.</p>
        <div class="beta-artifact-summary"><b>${esc(id?.name || 'Seasonal Artifact')}</b><span id="artifactCount">${draft.length}/${MAX_PERKS} selected</span></div>
        <div class="beta-artifact-tiers">${tiersHtml}</div>
      </div>
      <footer>
        <button type="button" class="beta-menu-item" data-artifact-clear>CLEAR</button>
        <button type="button" class="beta-primary" data-artifact-apply>APPLY ARTIFACT</button>
      </footer>
    </section>`;

  closePicker();
  document.body.appendChild(wrap);

  const countEl = () => qs('#artifactCount', wrap);

  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) closePicker(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closePicker(); document.removeEventListener('keydown', onEsc); }
  });

  qsa('[data-perk-hash]', wrap).forEach(btn => btn.addEventListener('click', () => {
    const hash = Number(btn.dataset.perkHash);
    const at = draft.indexOf(hash);
    if (at >= 0) { draft.splice(at, 1); btn.classList.remove('selected'); }
    else if (draft.length < MAX_PERKS) { draft.push(hash); btn.classList.add('selected'); }
    else return;
    const c = countEl(); if (c) c.textContent = `${draft.length}/${MAX_PERKS} selected`;
  }));

  qs('[data-artifact-clear]', wrap)?.addEventListener('click', () => {
    draft.length = 0;
    qsa('.beta-artifact-choice', wrap).forEach(b => b.classList.remove('selected'));
    const c = countEl(); if (c) c.textContent = `0/${MAX_PERKS} selected`;
  });

  qs('[data-artifact-apply]', wrap)?.addEventListener('click', () => {
    selected = draft.slice();
    saveOverride(currentFixtureId, selected);
    renderArtifactDisplay();
    closePicker();
  });
}

/* ---------- wiring ---------- */

function wireRow() {
  const row = qs('.artifact-row');
  if (!row || row.dataset.artifactWired) return;
  row.dataset.artifactWired = '1';
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', 'Configure Artifact perks');
  row.addEventListener('click', openPicker);
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  });
}

function installStyles() {
  if (qs('#astrixArtifactStyles')) return;
  const style = document.createElement('style');
  style.id = 'astrixArtifactStyles';
  style.textContent = `
    .artifact-row{cursor:pointer}
    .artifact-row:focus-visible{outline:1px solid #9e60ff;outline-offset:4px;border-radius:8px}
    #artPerks .art-empty{padding:5px 9px;border:1px dashed rgba(158,96,255,.5);border-radius:7px;background:transparent;color:#9e60ff;font:600 10px Rajdhani;letter-spacing:.04em;cursor:pointer}
    #artPerks .art-more{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border:1px solid rgba(255,255,255,.14);border-radius:7px;color:#cbb6ff;font:700 10px Orbitron}
    .beta-artifact-modal{width:min(980px,95vw)!important}
    .beta-artifact-summary{display:flex;justify-content:space-between;align-items:center;margin:4px 0 16px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:8px}
    .beta-artifact-summary span{color:#9e60ff}
    .beta-artifact-tiers{display:grid;gap:12px}
    .beta-artifact-tier{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px}
    .beta-artifact-tier h3{margin:0 0 8px;color:#a87aff;font:700 10px Orbitron;letter-spacing:.1em}
    .beta-artifact-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
    .beta-artifact-choice{display:grid;gap:5px;justify-items:center;min-width:0;padding:7px 4px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02);color:#ddd;cursor:pointer}
    .beta-artifact-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:7px;background:#16111f;font-size:16px}
    .beta-artifact-icon img{width:100%;height:100%;object-fit:contain}
    .beta-artifact-choice b{max-width:100%;font:600 8px Rajdhani;line-height:1.05;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .beta-artifact-choice.selected{border-color:#33d6c7;box-shadow:inset 0 0 0 1px rgba(51,214,199,.25);background:rgba(51,214,199,.06)}
    .beta-artifact-choice.unresolved{opacity:.6}
    .beta-artifact-choice.unresolved b{color:#8a8a8a;font-style:italic}
    @media(max-width:900px){.beta-artifact-grid{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);
}

/* ---------- lifecycle ---------- */

async function onSelection(detail) {
  try { await ensureManifest(); } catch (err) { console.error('[Paradox artifact]', err); return; }
  currentFixtureId = detail?.fixtureId ?? currentFixtureId;
  selected = selectionForFixture(detail);
  renderArtifactDisplay();
  wireRow();
}

document.addEventListener('astrix:guardian-selection-changed', e => onSelection(e.detail || {}));
document.addEventListener('astrix:beta-fixture-loaded', e => onSelection(e.detail || {}));

(async () => {
  installStyles();
  wireRow();
  try { await ensureManifest(); renderArtifactDisplay(); }
  catch (err) { console.error('[Paradox artifact]', err); }
})();
