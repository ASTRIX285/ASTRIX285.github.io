import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const [workspace,loader,profile,formationModule,formationCss,gearModule,gearCss,characterModule,characterCss,artifact,loadoutsCss,handoff,buildHtml,buildModule,buildCss,tokenPreview]=await Promise.all([
  read('guardian-workspace-v2.mjs'),read('guardian-main-loader.mjs'),read('guardian-bungie-profile.mjs'),
  read('guardian-super-formation.mjs'),read('guardian-super-formation.css'),read('guardian-gear-layout.mjs'),
  read('guardian-gear-layout.css'),read('guardian-character-cards.mjs'),read('guardian-character-cards.css'),
  read('guardian-artifact.mjs'),read('guardian-layout-final.css'),read('paradox-build-space-handoff.mjs'),
  read('paradox-build-space/index.html'),read('paradox-build-space/paradox-build-space.mjs'),read('paradox-build-space/paradox-build-space.css'),
  read('astrix-token-branch-preview.css')
]);

assert.match(workspace,/astrix:guardian-render-complete/,'Main must publish render completion');
assert.match(workspace,/Promise\.all\(images\.map\(settleImage\)\)/,'Main render completion must wait for visible images');
assert.match(loader,/astrix:guardian-render-complete/,'Loader must finish from the render event');
assert.doesNotMatch(loader,/window\.addEventListener\('load'[\s\S]*?finish/,'Loader must not finish on window load');
assert.doesNotMatch(loader,/setTimeout\(finish/,'Loader must not finish from an arbitrary timeout');

assert.match(profile,/resolveArtifactByProvenance/,'Artifact provenance resolver must be wired into the live profile');
assert.match(profile,/SELECTED_LOADOUT_KEY/,'Selected Bungie loadout must be persisted as the page default');
assert.match(profile,/rememberLoadoutSelection\(characterId,index\)/,'Loadout selection must update the persisted default');
assert.match(profile,/Selected \$\{expected\} card resolved \$\{detail\.characterClass\}/,'Character class mismatch must fail loudly');
assert.match(profile,/character selection cannot fall back to last played/,'Missing roster must not silently fall back');

assert.match(formationModule,/\['equipped','alternate-5','alternate-4','alternate-3','alternate-2','alternate-1'\]/,'Partial Supers must fill bottom, right, left, then up');
assert.match(formationModule,/slot\.hidden=!item/,'Unused Super diamonds must not render');
assert.match(formationModule,/dataset\.superCount/,'Resolved Super count must be exposed to CSS');
assert.match(formationModule,/document\.documentElement\.dataset\.subclass=key/,'Equipped subclass must theme both Main and Build');
assert.match(formationCss,/--super-equipped-bevel:5px/,'Equipped Super needs the approved 4–6px bevel');
assert.match(formationCss,/--super-alternate-bevel:2px/,'Alternate Supers need the approved 1–2px bevel');
assert.match(formationCss,/border:var\(--super-bevel-size\) solid/,'Super bevel thickness must use the shared size token');
assert.match(formationCss,/data-super-count="1"/,'Single-Super compact geometry is missing');
assert.match(formationCss,/data-super-count="5"/,'Five-Super centred geometry is missing');

assert.match(gearModule,/armour-set-bonus-icon/,'Resolved armour set icon must sit with the armour image');
assert.match(gearModule,/is-set-2-active/,'2-piece active state must reach the card');
assert.match(gearModule,/is-set-4-active/,'4-piece active state must reach the card');
assert.match(gearCss,/\.gear-slot\.is-set-2-active/,'2-piece card highlight is missing');
assert.match(gearCss,/\.gear-slot\.is-set-4-active/,'4-piece card highlight is missing');
assert.match(gearCss,/height:108px!important/,'Armour and weapon portrait rows must be taller');
assert.match(gearCss,/weapon-perk-strip\{[^}]*border:0[^}]*background:transparent/,'Selected perks must not sit inside a blue container');
assert.match(gearCss,/weapon-support-icon\{width:var\(--pf-mod-size,36px\);height:var\(--pf-mod-size,36px\)/,'Weapon mod/masterwork icons must match armour mod size');

assert.match(characterModule,/emblemBackground = character\.emblem\?\.background/,'Hero card must use the Bungie emblem background');
assert.match(characterCss,/var\(--character-emblem\) center top\/100% 58%/,'Emblem must feature across the card top half');
assert.match(characterCss,/box-shadow:0 20px 34px -18px/,'Selected card must use a gentle lower glow');
assert.match(artifact,/ARTIFACT IN DEVELOPMENT/,'Unresolved live Artifact must show the In Development placeholder');
assert.match(loadoutsCss,/background-image:var\(--loadout-color-image/,'Saved loadout must retain its Bungie colour image');
assert.match(loadoutsCss,/guardian-loadout-icon\{width:var\(--pf-mod-size,36px\)/,'Loadout icon must match armour mod size');
assert.match(handoff,/latestGuardian&&Number\.isInteger\(latestGuardian\.selectedLoadoutIndex\)/,'Improve My Guardian must prefer the active selected loadout');

assert.match(buildHtml,/data-guardian-profile-mode="roster-only"/,'Build Tool must load the roster without replacing its protected snapshot');
assert.match(buildHtml,/id="guardianCharacterCards"/,'Build Tool character cards are missing');
assert.match(buildModule,/import '\.\.\/guardian-character-cards\.mjs'/,'Build Tool must reuse the Main character-card renderer');
assert.match(buildModule,/import '\.\.\/guardian-bungie-profile\.mjs'/,'Build Tool must reuse strict Main character selection');
assert.match(buildModule,/createBuildState\(detail\)/,'Selected Build Tool character must create a new protected build snapshot');
assert.match(buildModule,/astrix:build-render-complete/,'Build Tool must publish render completion');
assert.match(buildCss,/grid-template-columns:repeat\(2,var\(--pf-build-mod-size\)\) 8px repeat\(2,var\(--pf-build-mod-size\)\) 8px repeat\(2,var\(--pf-build-mod-size\)\)/,'Build armour mods must form horizontal 2-2-2 groups');
assert.match(buildCss,/gear-mod:nth-child\(6\)\{grid-column:8\}/,'Build 2-2-2 grouping must place all six real mod slots');

for(const [label,html] of [['Main',await read('index.html')],['Build',buildHtml]]){
  assert.match(html,/astrix-tokens\.css/,`${label} must load the supplied token sheet on this branch`);
  assert.match(html,/class="scene immersive"/,`${label} token preview scene is missing`);
  assert.match(html,/class="grain"/,`${label} token preview grain is missing`);
}
assert.match(tokenPreview,/D2_JB\.jpg/,'Main and Build must use the unbranded D2 background');
assert.match(tokenPreview,/developer-provided artwork/,'Developer artwork provenance must remain explicit');
assert.match(tokenPreview,/background-size:cover/,'D2 background must scale to the viewport');
assert.match(tokenPreview,/max-aspect-ratio:4\/3/,'D2 background must adapt to narrower screens');
assert.match(tokenPreview,/\.workspace>\.stage/,'Main Hero stage atmosphere is missing');
assert.match(tokenPreview,/\.build-space>\.design-canvas/,'Build Design atmosphere is missing');

console.log('MAIN_RENDER_GATE=PASS');
console.log('SUBCLASS_SUPER_DATA_PATH=PASS');
console.log('STRICT_CHARACTER_AND_ARTIFACT_PROVENANCE=PASS');
console.log('ARMOUR_WEAPON_HERO_PRESENTATION=PASS');
console.log('BUILD_TOOL_PARITY=PASS');
