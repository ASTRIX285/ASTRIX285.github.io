const BUILD_SPACE_KEY = 'astrix:paradox-build-space:v1';
const LAST_LOADOUT_KEY = 'astrix:paradox-last-bungie-loadout:v1';

let latestGuardian = null;
let latestExplicitLoadout = null;

function clone(value) {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value ?? null)); }
}

function safeStore(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function safeRead(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
  catch { return null; }
}

function compactBuild(detail = {}) {
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    source: detail.selectedLoadoutIndex != null ? 'bungie-loadout' : (detail.source || 'current-guardian'),
    characterId: String(detail.characterId || ''),
    characterClass: detail.characterClass || '',
    displayName: detail.displayName || 'Guardian',
    selectedLoadoutIndex: Number.isInteger(detail.selectedLoadoutIndex) ? detail.selectedLoadoutIndex : null,
    subclass: detail.subclass || '',
    subclassName: detail.subclassName || '',
    subclassIcon: detail.subclassIcon || '',
    subclassBuild: clone(detail.subclassBuild || {}),
    artifact: clone(detail.artifact || null),
    weapons: clone(detail.weapons || []),
    armour: clone(detail.armour || []),
    stats: clone(detail.stats || []),
    hashCoverage: clone(detail.hashCoverage || null),
    coverage: clone(detail.coverage || null)
  };
}

function rememberGuardian(detail = {}) {
  if (!detail?.characterId) return;
  latestGuardian = compactBuild(detail);
}

function rememberExplicitLoadout(detail = {}) {
  if (!detail?.characterId || !Number.isInteger(detail.selectedLoadoutIndex)) return;
  latestExplicitLoadout = compactBuild(detail);
  safeStore(LAST_LOADOUT_KEY, latestExplicitLoadout);
}

function resolveBuildSource() {
  if (latestExplicitLoadout) return clone(latestExplicitLoadout);

  const rememberedLoadout = safeRead(LAST_LOADOUT_KEY);
  if (rememberedLoadout?.characterId) return rememberedLoadout;

  if (latestGuardian) return clone(latestGuardian);
  return null;
}

function openBuildSpace(event) {
  const button = event.target?.closest?.('.improve-cta');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const source = resolveBuildSource();
  if (source) safeStore(BUILD_SPACE_KEY, {
    originalBuild: source,
    workingBuild: clone(source),
    sourcePriority: source.source === 'bungie-loadout' ? 'selected-or-last-bungie-loadout' : 'current-equipped-guardian'
  });

  location.href = './paradox-build-space/';
}

document.addEventListener('astrix:guardian-selection-changed', event => rememberGuardian(event.detail || {}));
document.addEventListener('astrix:bungie-loadout-loaded', event => rememberExplicitLoadout(event.detail || {}));
document.addEventListener('click', openBuildSpace, true);

export { compactBuild, resolveBuildSource, BUILD_SPACE_KEY, LAST_LOADOUT_KEY };
