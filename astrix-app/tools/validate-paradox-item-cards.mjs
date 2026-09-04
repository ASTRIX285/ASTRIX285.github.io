import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../pages/guardian-workspace-v2/',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const [weaponUi,armourRuntime,interceptor,buildRuntime,cardCss]=await Promise.all([
  read('guardian-semantic-ui.mjs'),
  read('guardian-beta-runtime.mjs'),
  read('guardian-semantic-interceptor.mjs'),
  read('paradox-build-space/paradox-build-space.mjs'),
  read('paradox-item-cards.css')
]);

assert.match(weaponUi,/data-perk-capacity="\$\{capacity\}"/,'Every weapon perk socket must expose its tier-derived column capacity');
assert.match(weaponUi,/Tier 5 · columns 3–4 hold three perks; all other columns hold two\./,'The T5 column 3/4 exception must be visible in the weapon model');
const stats=weaponUi.indexOf('paradox-section--stats');
const traits=weaponUi.indexOf('paradox-section--traits',stats);
const perks=weaponUi.indexOf('paradox-section--perks',traits);
const mods=weaponUi.indexOf('paradox-section--support',perks);
assert.ok(stats>=0&&traits>stats&&perks>traits&&mods>perks,'Weapon details must render stats, intrinsic/Exotic traits, perk columns, then mods/masterwork');
assert.match(weaponUi,/weapon-exotic-traits[\s\S]*?EXOTIC WEAPON TRAITS/,'Exotic weapon traits must remain nested beneath the intrinsic trait');
assert.match(weaponUi,/CATALYST · \$\{s\.catalyst\?\.progress\?\.masterworked\?"MASTERWORKED"/,'A completed Exotic catalyst must be visibly identified as masterworked');

for(const section of ['ARMOUR STATS','ENERGY','ARCHETYPE &amp; TRAITS','ARMOUR COSMETICS','ARMOUR MODS']){
  assert.ok(armourRuntime.includes(section),`Armour detail framework is missing ${section}`);
}
assert.match(interceptor,/payload\?\.statDefinitions\?\.\[String\(hash\)\][\s\S]*?name:String\(definition\?\.displayProperties\?\.name/,'Per-item armour stat labels must come from the live Bungie stat definitions');
assert.match(buildRuntime,/openWeaponDetail\(item\)/,'Build Forge weapon models must open the shared Character weapon inspector');
assert.match(buildRuntime,/openArmourDrawer\(index,build\.armour\?\.\[index\]\)/,'Build Forge armour models must open the shared Character armour inspector');
assert.match(cardCss,/\.paradox-item-card \.weapon-perk-row\{grid-template-columns:repeat\(var\(--weapon-perk-columns\),var\(--paradox-perk-size,60px\)\)/,'Weapon perk rows must use a single aligned column grid');
assert.match(cardCss,/font:550 13px\/1\.45 bahnschrift/,'Item-card supporting copy must remain readable');

console.log('PARADOX_ITEM_CARD_FRAMEWORK=PASS');
console.log('PARADOX_WEAPON_PERK_HIERARCHY=PASS');
console.log('PARADOX_ARMOUR_DETAIL_MODEL=PASS');
