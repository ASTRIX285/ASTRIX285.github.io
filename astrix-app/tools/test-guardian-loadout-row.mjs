import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

globalThis.document={querySelector(){return null;},addEventListener(){}};
const {LOADOUT_DEFINITIONS}=await import('../pages/guardian-workspace-v2/guardian-loadout-definitions.mjs');
const {loadoutIdentity,loadoutSlotsMarkup}=await import('../pages/guardian-workspace-v2/guardian-loadouts.mjs');

const nameHash=Number(Object.keys(LOADOUT_DEFINITIONS.names)[0]);
const iconHash=Number(Object.keys(LOADOUT_DEFINITIONS.icons)[0]);
const colorHash=Number(Object.keys(LOADOUT_DEFINITIONS.colors)[0]);
const saved={nameHash,iconHash,colorHash,items:[{itemInstanceId:'verified'}]};
const identity=loadoutIdentity(saved);
assert.equal(identity.name,LOADOUT_DEFINITIONS.names[String(nameHash)].name);
assert.match(identity.icon,/^https:\/\/www\.bungie\.net\/common\/destiny2_content\/icons\/.+\.png$/);
assert.match(identity.color,/^https:\/\/www\.bungie\.net\/common\/destiny2_content\/icons\/.+\.jpg$/);

const markup=loadoutSlotsMarkup([saved],{selectedIndex:0,interactive:false});
assert.equal((markup.match(/data-loadout-slot=/g)||[]).length,20,'the Bungie strip must always expose slots 1–20');
assert.match(markup,/class="guardian-loadout-slot is-saved is-active"/);
assert.match(markup,/aria-disabled="true"/);
assert.match(markup,/--loadout-color-image:url\(https:\/\/www\.bungie\.net\//);
assert.match(markup,/class="guardian-loadout-icon" src="https:\/\/www\.bungie\.net\//);

const root='astrix-app/pages/guardian-workspace-v2/';
const [guardianHtml,buildHtml,sharedCss,buildCss,handoff,buildModule]=await Promise.all([
  readFile(root+'index.html','utf8'),
  readFile(root+'paradox-build-space/index.html','utf8'),
  readFile(root+'guardian-loadout-row.css','utf8'),
  readFile(root+'paradox-build-space/paradox-build-space.css','utf8'),
  readFile(root+'paradox-build-space-handoff.mjs','utf8'),
  readFile(root+'paradox-build-space/paradox-build-space.mjs','utf8')
]);
const between=(source,first,second)=>source.indexOf(first)>=0&&source.indexOf(first)<source.indexOf(second);
assert.ok(between(guardianHtml,'id="guardianLoadouts"','ARMOUR & MODS'),'Character loadout strip must be immediately before Armour');
assert.ok(between(buildHtml,'id="buildGuardianLoadouts"','ARMOUR & MODS'),'Build Forge loadout strip must be immediately before Armour');
assert.match(sharedCss,/grid-template-columns:repeat\(20,/,'the strip must remain one 20-slot row');
assert.match(sharedCss,/overflow-x:auto/,'narrow screens must scroll the single row instead of wrapping it');
assert.match(buildCss,/\.brand\{min-width:0;gap:7px\}/,'the narrow header brand must be allowed to shrink');
assert.match(buildCss,/\.brand span\{min-width:0;overflow:hidden\}/,'long brand copy must remain inside its grid track');
assert.match(buildCss,/\.source-pill\{min-width:0;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap/,'the narrow source badge must stay bounded without page scaling');
assert.match(handoff,/loadoutsAvailable:detail\.loadoutsAvailable===true,loadouts:clone\(detail\.loadouts\|\|\[\]\)/,'Build Forge handoff must retain Bungie loadouts');
assert.match(buildModule,/renderLoadoutHost\(byId\('buildGuardianLoadouts'\)/,'Build Forge must use the shared Bungie renderer');

console.log('Guardian and Build Forge loadout row tests passed.');
