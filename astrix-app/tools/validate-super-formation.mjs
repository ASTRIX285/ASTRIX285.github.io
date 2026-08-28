import assert from 'node:assert/strict';
import {access,readdir,readFile} from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const PAGE_ROOT=new URL('pages/guardian-workspace-v2/',ROOT);
const SHARED_CSS_URL=new URL('guardian-super-formation.css',PAGE_ROOT);
const SHARED_MODULE_URL=new URL('guardian-super-formation.mjs',PAGE_ROOT);
const LOADOUT_DEFINITIONS_URL=new URL('guardian-loadout-definitions.mjs',PAGE_ROOT);
const MAIN_HTML_URL=new URL('index.html',PAGE_ROOT);
const BUILD_HTML_URL=new URL('paradox-build-space/index.html',PAGE_ROOT);
const MAIN_MODULE_URL=new URL('guardian-workspace-v2.mjs',PAGE_ROOT);
const SYNC_MODULE_URL=new URL('guardian-super-feature-sync.mjs',PAGE_ROOT);
const BUILD_MODULE_URL=new URL('paradox-build-space/paradox-build-space.mjs',PAGE_ROOT);
const read=url=>readFile(url,'utf8');

const [css,moduleSource,mainHtml,buildHtml,mainModule,syncModule,buildModule,{LOADOUT_DEFINITIONS}]=await Promise.all([
  read(SHARED_CSS_URL),
  read(SHARED_MODULE_URL),
  read(MAIN_HTML_URL),
  read(BUILD_HTML_URL),
  read(MAIN_MODULE_URL),
  read(SYNC_MODULE_URL),
  read(BUILD_MODULE_URL),
  import(LOADOUT_DEFINITIONS_URL.href)
]);

const expectedColours={
  void:'#8B4DFF',
  arc:'#4FC3FF',
  solar:'#FF7A18',
  strand:'#4DFF73',
  stasis:'#4C8DFF',
  prismatic:'#E84CFF'
};
for(const [key,colour] of Object.entries(expectedColours)){
  assert.match(css,new RegExp(`\\[data-super-subclass="${key}"\\]\\{--super-accent:${colour}`,'i'),`${key} Super colour drifted`);
  assert.match(css,new RegExp(`\\[data-subclass="${key}"\\]\\{--super-accent:${colour}`,'i'),`${key} subclass header colour drifted`);
}

const expectedGeometry={
  equipped:{left:'50.25%',top:'34.50%',width:'41.45%'},
  alt1:{left:'19.62%',top:'49.75%'},
  alt2:{left:'80.38%',top:'50.12%'},
  alt3:{left:'34.62%',top:'65.12%'},
  alt4:{left:'65.38%',top:'65.38%'},
  alt5:{left:'50.00%',top:'80.38%'}
};
for(const [slot,values] of Object.entries(expectedGeometry)){
  const selector=slot==='equipped'?'.super-diamond--equipped':`.super-diamond--${slot}`;
  const block=css.match(new RegExp(`${selector.replaceAll('.','\\.')}\\{([^}]*)\\}`))?.[1]||'';
  assert.ok(block,`${slot} geometry rule is missing`);
  for(const [property,value] of Object.entries(values))assert.match(block,new RegExp(`${property}:${value.replace('.','\\.')}`),`${slot} ${property} drifted`);
}
assert.match(css,/\.super-diamond--alt\{width:20\.51%!important/,'Alternate Super width drifted');
const equippedBevel=Number(css.match(/--super-equipped-bevel:(\d+(?:\.\d+)?)px/)?.[1]);
const alternateBevel=Number(css.match(/--super-alternate-bevel:(\d+(?:\.\d+)?)px/)?.[1]);
assert.equal(equippedBevel,5,`Equipped Super bevel is ${equippedBevel||0}px; expected 5px`);
assert.equal(alternateBevel,2.5,`Alternate Super bevel is ${alternateBevel||0}px; expected 2.5px`);
const rotatedBounds=(left,top,width)=>{
  const halfDiagonal=width*Math.SQRT2/2;
  return {left:left-halfDiagonal,right:left+halfDiagonal,top:top-halfDiagonal,bottom:top+halfDiagonal};
};
for(const [slot,values] of Object.entries(expectedGeometry)){
  const width=Number((values.width||'20.51%').replace('%',''));
  const bounds=rotatedBounds(Number(values.left.replace('%','')),Number(values.top.replace('%','')),width);
  for(const [edge,value] of Object.entries(bounds))assert.ok(value>=0&&value<=100,`${slot} rotated ${edge} edge escapes the scalable cluster: ${value.toFixed(2)}%`);
}

assert.match(css,/transform:translate\(-50%,-50%\) rotate\(45deg\)!important/,'Diamond transform drifted');
assert.match(css,/aspect-ratio:1 \/ 1!important/,'Formation must remain square');
const gap=Number(css.match(/gap:clamp\((\d+)px,3vw,40px\)!important/)?.[1]);
assert.ok(gap>=32,`Subclass/Super minimum gap is ${gap||0}px; expected at least 32px`);
assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?gap:32px!important/,'Phone/tablet rule must preserve the 32px subclass-to-Super gap');
assert.match(css,/@media\(max-width:720px\)\{[\s\S]*?\.super-feature \.super-feature__cluster\{width:min\(300px,100%\)!important\}/,'Phone/tablet cluster must scale to its container without page zoom');
assert.match(css,/\.super-feature \.super-feature__name\{[\s\S]*?white-space:nowrap!important;[\s\S]*?text-overflow:ellipsis!important;/,'Super name must remain contained at narrow widths');

assert.match(css,/flex:0 0 auto!important;/,'Equipped subclass/Super wrapper must not collapse inside the scroll rail');

for(const [label,html] of [['Main',mainHtml],['Build',buildHtml]]){
  assert.match(html,/guardian-super-formation\.css/,`${label} does not load the shared stylesheet`);
  assert.match(html,/20260828-super-map-2/,`${label} does not load the corrected shared Super mapper`);
  assert.match(html,/equipped-subclass-stack/,`${label} does not use the equipped-only subclass stack`);
  assert.equal((html.match(/data-super-slot=/g)||[]).length,6,`${label} must expose six fixed Super slots`);
  assert.doesNotMatch(html,/class="subclass-rail"|id="subclassSummary"|data-subclass-option=/,`${label} still contains the removed subclass selector panel`);
}

assert.match(moduleSource,/function renderEquippedSubclass/,'Shared equipped subclass renderer is missing');
assert.equal(LOADOUT_DEFINITIONS.icons?.[814121290]?.iconImagePath,'/common/destiny2_content/icons/8f8283c4f518dbd2239ba1f60b91d14f.png','Prismatic header icon hash 814121290 drifted');
assert.match(moduleSource,/PRISMATIC_HEADER_ICON_HASH=814121290/,'Shared renderer does not use the Bungie Prismatic loadout icon hash');
assert.match(moduleSource,/key==='prismatic'\?PRISMATIC_HEADER_ICON:icon/,'Prismatic header is not routed through the shared class-neutral icon');
assert.match(css,/\.equipped-subclass:not\(\[data-subclass="prismatic"\]\) \.equipped-subclass__crest img\{[\s\S]*?position:absolute;[\s\S]*?left:50%;[\s\S]*?top:50%;[\s\S]*?transform:translate\(-50%,-50%\) rotate\(-45deg\);/,'Non-Prismatic header artwork is not explicitly centred');
assert.match(moduleSource,/function renderSuperFormation/,'Shared Super renderer is missing');
assert.match(moduleSource,/function resolveSuperFormationSlots/,'Shared Super slot mapper is missing');
assert.match(moduleSource,/holder\.replaceChildren\(\)/,'Empty Super slots must clear placeholder glyphs');
assert.match(moduleSource,/slot\.hidden=false/,'Every PSD Super frame must remain visible');
assert.match(moduleSource,/is-empty-super/,'Unresolved Super frames must remain transparent and explicit');
assert.match(css,/\.super-diamond--equipped>span\{[\s\S]*?inset:-20\.7107%!important;[\s\S]*?width:141\.4214%!important;[\s\S]*?height:141\.4214%!important/,'Equipped Super artwork must fill the rotated diamond without inner padding');

for(const [label,source] of [['Main renderer',mainModule],['Main sync bridge',syncModule],['Build renderer',buildModule]]){
  assert.match(source,/subclassCatalog:/,`${label} does not pass the verified subclass catalogue to the shared Super mapper`);
}
assert.match(moduleSource,/strand:'\/common\/destiny2_content\/icons\/41c0024ce809085ac16f4e0777ea0ac4\.png'/,'Shared subclass picker lost its verified Strand fallback');
assert.match(syncModule,/if\(node&&icon\)node\.style\.backgroundImage=/,'Character sync can still erase a missing-catalogue subclass fallback');

const {renderSubclassPicker,resolveSuperFormationSlots}=await import(SHARED_MODULE_URL.href);
const fallbackIcon={style:{}};
const strandButton={
  dataset:{element:'strand'},
  classList:{toggle(){}},
  querySelector:selector=>selector==='.icon'?fallbackIcon:null,
  setAttribute(){},
  removeAttribute(){}
};
renderSubclassPicker({root:{querySelectorAll:()=>[strandButton]},characterClass:'hunter',subclass:'solar',subclassOptions:[]});
assert.match(fallbackIcon.style.backgroundImage,/41c0024ce809085ac16f4e0777ea0ac4\.png/,'Strand subclass diamond does not retain its Bungie fallback icon');

const superItem=(name,hash)=>({name,hash,icon:`/${hash}.png`});
const arcActive=superItem('Arc Active',101),arcAlternate=superItem('Arc Alternate',102);
const catalog=[
  {name:'Strand Subclass',element:'strand',subclassBuild:{super:superItem('Strand Equipped',201),superOptions:[superItem('Strand Equipped',201)]}},
  {name:'Arc Subclass',element:'arc',subclassBuild:{super:arcActive,superOptions:[arcActive,arcAlternate]}},
  {name:'Void Subclass',element:'void',subclassBuild:{super:superItem('Void Equipped',301),superOptions:[superItem('Void Equipped',301)]}},
  {name:'Solar Subclass',element:'solar',subclassBuild:{super:superItem('Solar Equipped',401),superOptions:[superItem('Solar Equipped',401)]}}
];
const mapped=resolveSuperFormationSlots({activeSuper:arcActive,superOptions:[arcActive,arcAlternate],subclass:'arc',subclassCatalog:catalog});
const bySlot=Object.fromEntries(mapped.entries.map(entry=>[entry.slot,entry]));
assert.equal(bySlot.equipped.item,arcActive,'The large diamond must retain the equipped Super');
assert.equal(bySlot['alternate-1'].item.name,'Strand Equipped','Strand must occupy the far-left small diamond');
assert.equal(bySlot['alternate-3'].item.name,'Arc Alternate','The active element alternative must occupy the lower-left small diamond');
assert.equal(bySlot['alternate-5'].item,arcActive,'The bottom small diamond must repeat the equipped Super');
assert.equal(bySlot['alternate-4'].item.name,'Void Equipped','Void must occupy the lower-right small diamond');
assert.equal(bySlot['alternate-2'].item.name,'Solar Equipped','Solar must occupy the far-right small diamond');
assert.equal(mapped.entries.filter(entry=>entry.selected).length,1,'Exactly one small Super slot must own equipped state');
assert.equal(bySlot['alternate-5'].selected,true,'The bottom small diamond must own equipped state');

const obsoleteFiles=[
  'guardian-main-correction.css',
  'guardian-subclass-super-polish.css',
  'guardian-subclass-super-polish.mjs',
  'guardian-diamond-formation-final.css'
];
for(const filename of obsoleteFiles){
  await assert.rejects(access(new URL(filename,PAGE_ROOT)),`${filename} still exists and can fight the shared owner`);
}

const cssFiles=(await readdir(PAGE_ROOT)).filter(name=>name.endsWith('.css')&&name!=='guardian-super-formation.css');
for(const filename of cssFiles){
  const source=await read(new URL(filename,PAGE_ROOT));
  assert.doesNotMatch(source,/super-feature__cluster|super-diamond--(?:equipped|alt[1-5])/,`${filename} still owns Super geometry`);
}

console.log('SUPER_FORMATION_SHARED_OWNER=PASS');
console.log('SUPER_FORMATION_PSD_RATIOS=PASS');
console.log('SUPER_FORMATION_MAIN_BUILD_PARITY=PASS');
console.log('SUPER_FORMATION_ELEMENT_MAPPING=PASS');
console.log('SUPER_FORMATION_EQUIPPED_DUPLICATION=PASS');
console.log('SUBCLASS_PICKER_STRAND_MAPPING=PASS');
console.log('EQUIPPED_SUBCLASS_HEADER_AND_PADDING=PASS');
console.log('SUPER_FORMATION_ROTATED_BOUNDS=PASS');
console.log('SUPER_FORMATION_RESPONSIVE_SOURCE=PASS');
console.log('SUBCLASS_HEADER_ICON_PROVENANCE=PASS');
console.log('SUBCLASS_HEADER_ICON_ALIGNMENT=PASS');
