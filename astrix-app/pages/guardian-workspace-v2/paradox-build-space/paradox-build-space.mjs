const BUILD_SPACE_KEY = 'astrix:paradox-build-space:v1';
const BUNGIE = 'https://www.bungie.net';

const byId = id => document.getElementById(id);
const abs = path => path ? (String(path).startsWith('http') ? path : `${BUNGIE}${path}`) : '';
const iconOf = item => item?.icon || item?.definition?.displayProperties?.icon || item?.displayProperties?.icon || '';

function readState() {
  try { return JSON.parse(sessionStorage.getItem(BUILD_SPACE_KEY) || 'null'); }
  catch { return null; }
}

function tile(item) {
  if (!item) return '<span class="icon-tile empty">◆</span>';
  const icon = abs(iconOf(item));
  return `<span class="icon-tile" title="${item.name || 'Destiny item'}">${icon ? `<img src="${icon}" alt="${item.name || ''}">` : '◆'}</span>`;
}

function gearCard(item, fallback) {
  const icon = abs(iconOf(item));
  return `<article class="gear-card"><div class="gear-art">${icon ? `<img src="${icon}" alt="${item?.name || fallback}">` : '◆'}</div><h3>${item?.name || fallback}</h3><small>${item?.itemTypeDisplayName || (item ? 'Resolved Bungie item' : 'Empty slot')}</small></article>`;
}

function render() {
  const state = readState();
  const build = state?.originalBuild || null;
  if (!build) {
    byId('sourceLabel').textContent = 'NO BUILD SNAPSHOT FOUND';
    byId('sourceDetail').textContent = 'Return to Guardian Workspace, load a Guardian or Bungie loadout, then press Improve My Guardian.';
    return;
  }

  const loadoutNumber = Number.isInteger(build.selectedLoadoutIndex) ? build.selectedLoadoutIndex + 1 : null;
  const sourceName = loadoutNumber ? `BUNGIE LOADOUT ${loadoutNumber}` : 'CURRENT EQUIPPED GUARDIAN';
  byId('sourcePill').textContent = `BUILD SOURCE · ${sourceName}`;
  byId('sourceLabel').textContent = sourceName;
  byId('sourceDetail').textContent = loadoutNumber
    ? `Character ${build.characterClass || ''} · Bungie slot ${loadoutNumber} · exact resolved loadout snapshot.`
    : `Character ${build.characterClass || ''} · current equipped state captured at entry.`;
  byId('guardianHeading').textContent = `${build.characterClass || 'Guardian'} · ${build.subclassName || build.subclass || 'Subclass'}`.toUpperCase();

  const superItem = build.subclassBuild?.super;
  byId('subclassSummary').innerHTML = `<strong>${build.subclassName || build.subclass || 'Subclass'}</strong><small>${superItem?.name || 'Super unresolved'}</small>`;

  const abilities = build.subclassBuild?.abilities || [];
  byId('abilityRail').innerHTML = Array.from({length:4}, (_,i)=>tile(abilities[i])).join('');
  const aspects = build.subclassBuild?.aspects || [];
  byId('aspectRail').innerHTML = Array.from({length:2}, (_,i)=>tile(aspects[i])).join('');
  const fragments = build.subclassBuild?.fragments || [];
  byId('fragmentRail').innerHTML = Array.from({length:5}, (_,i)=>tile(fragments[i])).join('');

  const artifact = build.artifact;
  const activePerks = artifact?.activePerks || [];
  byId('artifactRail').innerHTML = `<strong>${artifact?.name || 'Artifact unresolved'}</strong><small>${activePerks.length} active perk(s) resolved</small><div class="icon-grid" style="margin-top:10px">${Array.from({length:7},(_,i)=>tile(activePerks[i])).join('')}</div>`;

  byId('weaponGrid').innerHTML = Array.from({length:3},(_,i)=>gearCard(build.weapons?.[i], `Weapon slot ${i+1}`)).join('');
  byId('armourGrid').innerHTML = Array.from({length:5},(_,i)=>gearCard(build.armour?.[i], `Armour slot ${i+1}`)).join('');
}

byId('backToGuardian')?.addEventListener('click',()=>location.href='../');
render();
