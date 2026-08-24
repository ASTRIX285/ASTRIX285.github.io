import assert from 'node:assert/strict';
import {access,readdir,readFile} from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const PAGE_ROOT=new URL('pages/guardian-workspace-v2/',ROOT);
const SHARED_CSS_URL=new URL('guardian-super-formation.css',PAGE_ROOT);
const SHARED_MODULE_URL=new URL('guardian-super-formation.mjs',PAGE_ROOT);
const MAIN_HTML_URL=new URL('index.html',PAGE_ROOT);
const BUILD_HTML_URL=new URL('paradox-build-space/index.html',PAGE_ROOT);
const read=url=>readFile(url,'utf8');

const [css,moduleSource,mainHtml,buildHtml]=await Promise.all([
  read(SHARED_CSS_URL),
  read(SHARED_MODULE_URL),
  read(MAIN_HTML_URL),
  read(BUILD_HTML_URL)
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
assert.match(css,/transform:translate\(-50%,-50%\) rotate\(45deg\)!important/,'Diamond transform drifted');
assert.match(css,/aspect-ratio:1 \/ 1!important/,'Formation must remain square');
const gap=Number(css.match(/gap:clamp\((\d+)px,3vw,40px\)!important/)?.[1]);
assert.ok(gap>=32,`Subclass/Super minimum gap is ${gap||0}px; expected at least 32px`);
assert.match(css,/flex:0 0 auto!important;/,'Equipped subclass/Super wrapper must not collapse inside the scroll rail');

for(const [label,html] of [['Main',mainHtml],['Build',buildHtml]]){
  assert.match(html,/guardian-super-formation\.css/,`${label} does not load the shared stylesheet`);
  assert.match(html,/equipped-subclass-stack/,`${label} does not use the equipped-only subclass stack`);
  assert.equal((html.match(/data-super-slot=/g)||[]).length,6,`${label} must expose six fixed Super slots`);
  assert.doesNotMatch(html,/class="subclass-rail"|id="subclassSummary"|data-subclass-option=/,`${label} still contains the removed subclass selector panel`);
}

assert.match(moduleSource,/function renderEquippedSubclass/,'Shared equipped subclass renderer is missing');
assert.match(moduleSource,/function renderSuperFormation/,'Shared Super renderer is missing');
assert.match(moduleSource,/holder\.replaceChildren\(\)/,'Empty Super slots must clear placeholder glyphs');

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
console.log('EQUIPPED_SUBCLASS_HEADER_AND_PADDING=PASS');
