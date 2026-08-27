import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const sources={
  shared:await readFile(new URL('guardian-left-rail-shared.css',ROOT),'utf8'),
  adaptive:await readFile(new URL('guardian-adaptive-layout.css',ROOT),'utf8'),
  characters:await readFile(new URL('guardian-character-cards.css',ROOT),'utf8'),
  feedback:await readFile(new URL('guardian-layout-feedback.css',ROOT),'utf8'),
  gear:await readFile(new URL('guardian-gear-layout.css',ROOT),'utf8'),
  layout:await readFile(new URL('guardian-layout-final.css',ROOT),'utf8'),
  leftLock:await readFile(new URL('guardian-left-panel-lock.css',ROOT),'utf8'),
  mobile:await readFile(new URL('guardian-mobile.css',ROOT),'utf8'),
  super:await readFile(new URL('guardian-super-formation.css',ROOT),'utf8'),
  build:await readFile(new URL('paradox-build-space/paradox-build-space.css',ROOT),'utf8')
};
const mainHtml=await readFile(new URL('index.html',ROOT),'utf8');
const buildHtml=await readFile(new URL('paradox-build-space/index.html',ROOT),'utf8');
const combined=Object.values(sources).join('\n');

const squareOwners=Object.entries(sources).filter(([,source])=>/--guardian-square\s*:/.test(source)).map(([name])=>name);
assert.deepEqual(squareOwners,['shared'],'The Guardian square token must have one stylesheet owner');
assert.match(sources.shared,/--guardian-square:clamp\(40px,3\.2vw,64px\);[\s\S]*?--guardian-square-gap:6px;[\s\S]*?--guardian-square-radius:6px;/,'The shared responsive square contract drifted');
assert.match(sources.shared,/guardian-left-rail[\s\S]*?width:var\(--guardian-square\)!important;[\s\S]*?height:var\(--guardian-square\)!important/,'Left-rail sockets must consume the shared square token');
assert.match(sources.gear,/\.gear-mods\{[^}]*repeat\(3,var\(--guardian-square\)\)[^}]*repeat\(2,var\(--guardian-square\)\)[^}]*gap:var\(--guardian-square-gap\)/,'Armour mods must consume the same square and gap tokens');
assert.match(sources.gear,/\.gear-columns\{[^}]*repeat\(auto-fit,minmax\(min\(220px,100%\),1fr\)\)/,'Shared armour cards must wrap before their mod grids can overlap');
assert.doesNotMatch(sources.build,/--guardian-square\s*:|--pf-mod-size\s*:|\.gear-slot \.gear-mods\s*\{/,'Build must not create a second socket-size owner');

assert.match(sources.shared,/guardian-loadouts-strip\{[\s\S]*?overflow-x:auto!important/,'The 1–20 loadout strip must contain its own narrow-screen overflow');
assert.match(sources.shared,/guardian-loadouts-grid\{[\s\S]*?grid-template-columns:repeat\(20,minmax\(32px,1fr\)\)!important;[\s\S]*?min-width:720px!important/,'The Bungie 1–20 loadout row must remain fluid and single-row');
assert.match(sources.shared,/guardian-loadout-slot\{[\s\S]*?aspect-ratio:1!important/,'Every loadout slot must remain square');

assert.doesNotMatch(combined,/(?:^|[;{])\s*zoom\s*:/m,'Page-level CSS zoom is forbidden');
const pageLayoutCss=[sources.adaptive,sources.gear,sources.layout,sources.leftLock,sources.mobile,sources.shared,sources.super,sources.build].join('\n');
assert.doesNotMatch(pageLayoutCss,/(?:html|body|\.workspace|\.build-space|\.design-canvas|\.guardian-left-rail)\s*\{[^{}]*transform\s*:\s*scale\(/,'Page containers must not be scaled to simulate responsiveness');

assert.match(sources.characters,/html body \.topbar\{[\s\S]*?position:sticky!important/,'The character-card ribbon must remain anchored to the tool header');
assert.match(sources.characters,/@media\s*\(max-width:860px\)\{[\s\S]*?#guardianCharacterCards\.guardian-character-cards\{[^}]*display:grid!important;[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important;[^}]*overflow:hidden!important/,'All three character cards must remain fixed and contained in the phone ribbon');
assert.doesNotMatch(sources.characters,/scroll-snap-type|overflow-x:auto/,'The fixed character-card ribbon must not become a separate scrolling container');
assert.match(sources.build,/@media\s*\(max-width:1100px\)\s*and\s*\(min-width:721px\)\{[\s\S]*?\.build-space\{grid-template-columns:minmax\(300px,340px\) minmax\(0,1fr\)\}/,'Build must retain its smaller-laptop/tablet two-column contract');
assert.match(sources.build,/@media\s*\(max-width:720px\)\{[\s\S]*?\.build-space\{grid-template-columns:1fr/,'Build must collapse to one document-flow column on phones');
assert.match(sources.super,/@media\s*\(max-width:720px\)\{[\s\S]*?\.super-feature \.super-feature__cluster\{width:min\(300px,100%\)!important\}/,'Super geometry must scale inside its container at narrow widths');
assert.match(sources.feedback,/@media \(min-width:2400px\) and \(min-height:1100px\)\{[\s\S]*?grid-template-columns:minmax\(320px,22%\) minmax\(0,1fr\)!important/,'Ultra-wide Main must keep the Guardian rail proportional');
assert.match(sources.feedback,/\.equip\.gear-layout-active\{[\s\S]*?grid-template-columns:25% minmax\(0,1fr\)!important[\s\S]*?\.gear-weapons \.weap-grid\{[\s\S]*?repeat\(3,minmax\(0,1fr\)\)!important/,'Ultra-wide weapons must expand with the equipment container');
assert.match(sources.feedback,/\.gear-combined \.gear-slot\{container-type:inline-size\}[\s\S]*?\.gear-arm-anchor \.arm\{width:46cqw!important;height:46cqw!important\}/,'Ultra-wide armour must scale inside each owned card');
assert.match(sources.shared,/@media \(min-width:2400px\) and \(min-height:1100px\)\{[\s\S]*?body\.guardian-main-page\{--guardian-square:max\(40px,2\.7vw\)\}/,'Ultra-wide Main sockets must lift the desktop size cap');

for(const [label,html] of [['Main',mainHtml],['Build',buildHtml]]){
  assert.match(html,/<meta\s+name="viewport"\s+content="[^"]*width=device-width[^"]*initial-scale=1(?:\.0)?[^"]*"\s*\/?>/,label+' must declare a device-width viewport');
  assert.doesNotMatch(html,/guardian-resolution-adaptive\.css/,label+' must not load the rejected broad scaling override');
}

console.log('RESPONSIVE_SINGLE_OWNER=PASS');
console.log('RESPONSIVE_NO_PAGE_SCALE=PASS');
console.log('RESPONSIVE_LOADOUT_ROW=PASS');
console.log('RESPONSIVE_TABLET_PHONE_SOURCE=PASS');
console.log('RESPONSIVE_ULTRAWIDE_COMPONENTS=PASS');
