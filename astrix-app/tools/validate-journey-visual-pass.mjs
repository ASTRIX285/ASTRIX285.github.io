import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(`${root}${path}`,'utf8');
const html=read('astrix-app/pages/journey/index.html');
const css=read('astrix-app/pages/journey/journey-2560-visual.css');
const journey=read('astrix-app/pages/journey/journey.mjs');
const mapModule=read('astrix-app/pages/journey/journey-location-maps.mjs');
const ribbon=read('astrix-app/shared/astrix-destination-ribbon.js');
const ribbonCss=read('astrix-app/shared/astrix-destination-ribbon.css');
const heroCss=read('astrix-app/shared/astrix-hero-cards.css');
const heroModule=read('astrix-app/shared/astrix-hero-cards.mjs');
const mapBackgroundCss=read('astrix-app/shared/astrix-paradox-background.css');
const characterHtml=read('astrix-app/pages/guardian-workspace-v2/index.html');
const buildForgeHtml=read('astrix-app/pages/guardian-workspace-v2/paradox-build-space/index.html');
const missionReportsHtml=read('astrix-app/pages/mission-reports/index.html');
const vaultHtml=read('astrix-app/pages/vault/index.html');
const loadoutHtml=read('astrix-app/pages/loadout/index.html');
const globalHeroPages=[
  html,
  characterHtml,
  buildForgeHtml,
  missionReportsHtml,
  vaultHtml,
  loadoutHtml
];
const mapBackgroundPages=[characterHtml,buildForgeHtml,missionReportsHtml,vaultHtml,loadoutHtml];
const cosmodromeMap=readFileSync(`${root}astrix-app/pages/journey/assets/maps/cosmodrome-director-map-4k.webp`);
const cosmodromeDetailMap=readFileSync(`${root}astrix-app/pages/journey/assets/maps/cosmodrome-director-map-6k.webp`);
const placeholderMap=readFileSync(`${root}astrix-app/pages/journey/assets/maps/astrix-paradox-map-placeholder-4k.webp`);
const placeholderDetailMap=readFileSync(`${root}astrix-app/pages/journey/assets/maps/astrix-paradox-map-placeholder-6k.webp`);

assert.ok(html.includes('class="apx-destination-page journey-page"'),'Journey must own its large-screen visual scope');
assert.ok(html.includes('href="./journey-2560-visual.css?v=20260830-region-chest-overlay-readable"'),'Journey must load the versioned visual correction');
assert.ok(html.includes('src="./journey.mjs?v=20260830-all-destination-progress"'),'Journey must load the cache-busted all-destination progress module');
assert.ok(html.includes('src="../../shared/astrix-hero-cards.mjs?v=20260830-global-hero-cards"'),'Journey must load the shared authenticated hero-card renderer');
assert.ok(html.indexOf('journey-2560-visual.css')<html.indexOf('astrix-desktop-density.css'),'Shared desktop density must remain the final stylesheet');
assert.ok(html.includes('data-astrix-destination-ribbon data-active-destination="journey"'),'Journey must retain the shared six-page ribbon mount');
assert.doesNotMatch(html,/journeyDestinations|apx-destination-links|apx-destination-link/,'Journey must not duplicate the shared ribbon at the bottom of the page');

for(const id of [
  'journeyAuthStatus',
  'journeyResolving',
  'journeySignedOut',
  'journeyDashboard',
  'journeyConnectAction',
  'guardianCharacterCards',
  'journeyLocationSelector',
  'journeyLocationDetail'
])assert.ok(html.includes(`id="${id}"`),`Journey data mount ${id} must remain available`);

assert.equal((html.match(/class="apx-scaffold-card"/g)??[]).length,10,'Journey must retain all ten future data regions');
assert.equal((ribbon.match(/Object\.freeze\(\{key:/g)??[]).length,6,'Shared Journey ribbon must retain all six destination routes');
for(const page of globalHeroPages){
  assert.equal((page.match(/data-astrix-hero-cards/g)??[]).length,1,'Every destination page must contain exactly one shared hero-card mount');
  assert.ok(page.includes('astrix-hero-cards.css?v=20260830-global-hero-cards'),'Every destination page must load the shared hero-card presentation');
}
assert.equal((globalHeroPages.filter(page=>page.includes('astrix-hero-cards.mjs?v=20260830-global-hero-cards'))).length,3,'Only Journey, Vault and Loadout must use the shared standalone renderer');
assert.match(heroCss,/position:sticky!important;[\s\S]*?top:0!important;/,'Every hero-card topbar must remain anchored at the viewport top');
assert.match(heroCss,/grid-template-columns:minmax\(0,1fr\) 910px minmax\(0,1fr\)!important;/,'The three-card track must occupy the exact centre column');
assert.match(heroCss,/grid-template-columns:repeat\(3,300px\)!important;/,'The desktop hero track must retain three equal Character-format cards');
assert.match(heroCss,/body:has\(header>\[data-astrix-hero-cards\]\)\{zoom:1\}/,'Hero-card destination pages must remain at native 100 percent scale');
assert.match(heroCss,/body:has\(header>\[data-astrix-hero-cards\]\)>\[data-astrix-destination-ribbon\]\{position:sticky!important;top:120px!important;/,'The shared destination buttons must remain anchored beneath the hero topbar');
assert.match(ribbonCss,/@media\(min-width:981px\)\{[\s\S]*?width:min\(1180px,calc\(100% - 64px\)\);[\s\S]*?grid/s,'All pages must use the shared centred desktop destination-button presentation');
assert.match(heroModule,/const CLASS_ORDER=\{hunter:0,warlock:1,titan:2\}/,'Warlock must remain the middle card in the shared roster');
assert.match(heroModule,/fetchJson\(new URL\('\/bungie\/profile',AUTH_ORIGIN\)\)/,'Shared hero cards must use the existing confidential profile endpoint');
assert.doesNotMatch(heroModule,/guardian-bungie-profile|guardian-manifest-service|paradox-build|CLIENT_SECRET|API_KEY/,'Shared hero cards must not load or alter locked Character, manifest, Build Forge or secret internals');
for(const page of mapBackgroundPages){
  assert.ok(page.includes('astrix-paradox-background.css?v=20260830-global-map-background'),'Each approved page must load the shared ASTRIX PARADOX map background');
}
for(const page of [missionReportsHtml,vaultHtml,loadoutHtml]){
  assert.ok(page.includes('astrix-paradox-map-background'),'Mission Reports, Vault and Loadout must mount the shared map background layer');
}
assert.doesNotMatch(html,/astrix-paradox-background|astrix-paradox-map-background/,'Journey must retain its existing destination background');
assert.match(mapBackgroundCss,/astrix-paradox-map-placeholder-4k\.webp/,'Shared page backgrounds must use the approved 4K ASTRIX PARADOX map');
assert.match(mapBackgroundCss,/astrix-paradox-map-placeholder-6k\.webp/,'High-density page backgrounds must use the approved 6K ASTRIX PARADOX map');
assert.equal((mapBackgroundCss.match(/filter:blur\(2px\)/g)??[]).length,2,'Both shared background layers must use only a slight 2px blur');
assert.doesNotMatch(mapBackgroundCss,/D2_JB|DESTINATION MAP PENDING/,'Shared page backgrounds must not use the old artwork or removed subtitle');
assert.ok(journey.includes('initLocationSelector({'),'Journey must retain the location-selector wiring');
assert.ok(journey.includes("mount:document.getElementById('journeyLocationSelector')"),'Journey selector mount must remain unchanged');
assert.ok(journey.includes("detail:document.getElementById('journeyLocationDetail')"),'Journey detail mount must remain unchanged');
assert.ok(journey.includes('const session=await getBungieSession();'),'Journey authentication must remain unchanged');
assert.ok(journey.includes("import {initJourneyLocationMaps} from './journey-location-maps.mjs?v=20260830-all-destination-progress'"),'Journey must load its versioned page-owned map registry');
assert.ok(journey.includes('initJourneyLocationMaps('),'Journey must initialise its page-owned interactive map layer');
assert.ok(mapModule.includes("src:'./assets/maps/astrix-paradox-map-placeholder-4k.webp'"),'Journey must mount the shared 4K ASTRIX PARADOX placeholder');
assert.ok(mapModule.includes("detailSrc:'./assets/maps/astrix-paradox-map-placeholder-6k.webp'"),'Journey must provide the shared 6K ASTRIX PARADOX placeholder for zoom');
for(const key of ['pale-heart','dreaming-city','neomuna','europa','throne-world','nessus','edz','moon']){
  assert.ok(mapModule.includes(`'${key}':JOURNEY_PLACEHOLDER_MAP`),`Journey must retain the ${key} placeholder registration`);
}
assert.equal((mapModule.match(/:JOURNEY_PLACEHOLDER_MAP/g)??[]).length,8,'Journey must use one shared placeholder for exactly eight pending destination maps');
assert.ok(mapModule.includes("src:'./assets/maps/cosmodrome-director-map-4k.webp'"),'Journey map registry must mount the page-owned Cosmodrome map asset');
assert.ok(mapModule.includes("detailSrc:'./assets/maps/cosmodrome-director-map-6k.webp'"),'Journey map registry must provide its high-resolution zoom asset');
assert.ok(mapModule.includes("if(state.scale>1)requestDetailSource();"),'Journey map must request its high-resolution asset only after zoom begins');
assert.ok(mapModule.includes("addEventListener('pointermove'"),'Journey map must support pointer panning');
assert.ok(mapModule.includes("addEventListener('wheel'"),'Journey map must support wheel zooming');
for(const marker of [
  ['grasp-of-avarice','Grasp of Avarice'],
  ['skywatch-landing-zone','Skywatch'],
  ['the-disgraced','The Disgraced'],
  ['the-devils-lair',"The Devils' Lair"],
  ['fallen-saber','Fallen S.A.B.E.R.'],
  ['veles-labyrinth','Veles Labyrinth'],
  ['shaw-han','Shaw Han'],
  ['the-steppes-landing-zone','The Steppes'],
  ['exodus-garden-2a','Exodus Garden 2A']
]){
  assert.ok(mapModule.includes(`key:'${marker[0]}'`),`Journey map must retain the ${marker[1]} marker key`);
  assert.ok(mapModule.includes(`name:${JSON.stringify(marker[1])}`)||mapModule.includes(`name:'${marker[1]}'`),`Journey map must retain the ${marker[1]} label`);
}
assert.equal((mapModule.match(/Object\.freeze\(\{key:/g)??[]).length,9,'Cosmodrome pilot must contain exactly nine permanent static markers');
assert.equal((mapModule.match(/type:'strike'/g)??[]).length,3,'Cosmodrome pilot must contain the three verified strikes');
assert.equal((mapModule.match(/type:'lost-sector'/g)??[]).length,2,'Cosmodrome pilot must contain the two verified Lost Sectors');
assert.equal((mapModule.match(/type:'landing'/g)??[]).length,2,'Cosmodrome pilot must contain the two verified landing zones');
assert.equal((mapModule.match(/type:'dungeon'/g)??[]).length,1,'Cosmodrome pilot must contain Grasp of Avarice');
assert.equal((mapModule.match(/type:'vendor'/g)??[]).length,1,'Cosmodrome pilot must contain Shaw Han');
assert.doesNotMatch(mapModule,/type:'raid'|fetch\(|setInterval\(|getBungieSession|Date\(/,'Cosmodrome pilot must not invent a raid or add live activity mechanics');
assert.ok(mapModule.includes("stage.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`"),'Map image and static markers must pan and zoom as one stage');
assert.ok(mapModule.includes("stage.style.setProperty('--journey-marker-scale',String(1/state.scale))"),'Static marker labels must retain a readable screen size while zooming');
assert.ok(mapModule.includes("const label=globalThis.AstrixDestinations?.labelOf(key)||key;"),'Journey map labels must come from the selected destination registry');
assert.ok(mapModule.includes("viewport.append(stage,createRegionChestOverlay(key,label,spec.lostSectorTotal))"),'Regional chest progress must remain outside the moving map stage and receive the selected destination label');
assert.ok(mapModule.includes("const REGION_CHEST_EVENT='astrix:journey-region-chests'"),'Regional chest progress must accept a verified data event');
assert.ok(mapModule.includes("Waiting for verified Bungie chest records."),'Regional chest progress must keep an honest pending state before live records arrive');
assert.ok(mapModule.includes('class="journey-region-chests-zones journey-region-progress-indicators"'),'Permanent progress indicators must remain inside the existing overlay');
assert.ok(mapModule.includes('PERMANENT ${destinationHeading} TRIUMPHS'),'Triumph indication must use the selected destination name');
assert.ok(mapModule.includes('ACTIVE ${destinationHeading} QUEST OBJECTIVES'),'Quest indication must use the selected destination name');
assert.ok(mapModule.includes('aria-label="Additional permanent ${destinationName} progress indicators"'),'Progress accessibility text must use the selected destination name');
assert.ok(mapModule.includes('<span><b>LOST SECTORS</b><i>${lostSectorStatus}</i></span>'),'Lost Sector indication must remain pending until a verified total exists');
assert.ok(mapModule.includes('lostSectorTotal:2'),'Cosmodrome must retain its two verified Lost Sector locations');
assert.equal((mapModule.match(/lostSectorTotal:/g)??[]).length,1,'Pending destinations must not invent Lost Sector totals');
assert.doesNotMatch(mapModule,/PERMANENT COSMODROME TRIUMPHS|ACTIVE COSMODROME QUEST OBJECTIVES|Additional permanent Cosmodrome progress indicators/,'Shared progress markup must not hard-code Cosmodrome');
assert.doesNotMatch(mapModule,/total\s*:\s*15|discovered\s*:\s*\d+/,'Regional chest progress must not hard-code unverified counts');
assert.equal(cosmodromeMap.subarray(0,4).toString('ascii'),'RIFF','Cosmodrome map must be a valid WebP asset');
assert.equal(cosmodromeMap.subarray(8,12).toString('ascii'),'WEBP','Cosmodrome map must be a valid WebP asset');
assert.equal(cosmodromeMap.subarray(12,16).toString('ascii'),'VP8 ','Cosmodrome map must use the validated WebP encoding');
assert.equal(cosmodromeMap.readUInt16LE(26)&0x3fff,3840,'Cosmodrome map must be exactly 3840px wide');
assert.equal(cosmodromeMap.readUInt16LE(28)&0x3fff,2160,'Cosmodrome map must be exactly 2160px high');
assert.equal(cosmodromeDetailMap.subarray(0,4).toString('ascii'),'RIFF','Cosmodrome zoom map must be a valid WebP asset');
assert.equal(cosmodromeDetailMap.subarray(8,12).toString('ascii'),'WEBP','Cosmodrome zoom map must be a valid WebP asset');
assert.equal(cosmodromeDetailMap.subarray(12,16).toString('ascii'),'VP8 ','Cosmodrome zoom map must use the validated WebP encoding');
assert.equal(cosmodromeDetailMap.readUInt16LE(26)&0x3fff,5760,'Cosmodrome zoom map must be exactly 5760px wide');
assert.equal(cosmodromeDetailMap.readUInt16LE(28)&0x3fff,3240,'Cosmodrome zoom map must be exactly 3240px high');
assert.equal(placeholderMap.subarray(0,4).toString('ascii'),'RIFF','Journey placeholder map must be a valid WebP asset');
assert.equal(placeholderMap.subarray(8,12).toString('ascii'),'WEBP','Journey placeholder map must be a valid WebP asset');
assert.equal(placeholderMap.readUInt16LE(26)&0x3fff,3840,'Journey placeholder map must be exactly 3840px wide');
assert.equal(placeholderMap.readUInt16LE(28)&0x3fff,2160,'Journey placeholder map must be exactly 2160px high');
assert.equal(placeholderDetailMap.subarray(0,4).toString('ascii'),'RIFF','Journey placeholder zoom map must be a valid WebP asset');
assert.equal(placeholderDetailMap.subarray(8,12).toString('ascii'),'WEBP','Journey placeholder zoom map must be a valid WebP asset');
assert.equal(placeholderDetailMap.readUInt16LE(26)&0x3fff,5760,'Journey placeholder zoom map must be exactly 5760px wide');
assert.equal(placeholderDetailMap.readUInt16LE(28)&0x3fff,3240,'Journey placeholder zoom map must be exactly 3240px high');

assert.match(css,/@media \(min-width:1500px\)\{[\s\S]*?body\.journey-page\.apx-destination-page\{[\s\S]*?zoom:1;/,'Journey must restore native scale on large monitors');
assert.match(css,/body\.journey-page\.apx-destination-page \.apx-atmo\{[\s\S]*?width:100vw;[\s\S]*?max-width:none;/,'Journey atmosphere must cover the full viewport');
assert.match(css,/\.journey-page \.apx-atmo-base\{[\s\S]*?-webkit-mask-image:linear-gradient\(to bottom,#000 0%,#000 46%,rgba\(0,0,0,\.72\) 65%,rgba\(0,0,0,\.22\) 86%,transparent 100%\);[\s\S]*?mask-image:linear-gradient\(to bottom,#000 0%,#000 46%,rgba\(0,0,0,\.72\) 65%,rgba\(0,0,0,\.22\) 86%,transparent 100%\);/,'Journey deep-space base must fade toward the bottom without altering location art');
assert.match(css,/\.journey-page \.apx-atmo-photo\{[\s\S]*?filter:blur\(5px\) brightness\(\.67\) saturate\(1\.08\);/,'Journey location art must remain softly recognisable on large screens');
assert.match(css,/body\.journey-page\.apx-destination-page \.apx-page-shell\{[\s\S]*?width:min\(1920px,calc\(100% - 64px\)\);[\s\S]*?max-width:1920px;/,'Journey content must use a controlled large-screen width');
assert.match(css,/\.journey-page \.apx-card-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/,'Journey future data cards must form complete large-screen rows');
assert.match(css,/\.journey-page \.apx-loc-layout\{[\s\S]*?grid-template-columns:minmax\(360px,420px\) minmax\(0,1fr\);/,'Journey location focus must use balanced large-screen columns');
const fixedReadableFontSize=rule=>{
  const match=rule.match(/font-size:\s*(\d*\.?\d+)(rem|px)\s*(?:;|})/i);
  return Boolean(match)&&(match[2].toLowerCase()==='rem'||Number(match[1])>=15);
};
const journeyRootFontRule=css.match(/html\{[^}]*\}/)?.[0]??'';
const journeyBaseFontRule=css.match(/\.journey-page\{[^}]*\}/)?.[0]??'';
const journeyEmptyStateFontRule=css.match(/\.journey-page \.apx-empty-state\{[^}]*\}/)?.[0]??'';
assert.ok(fixedReadableFontSize(journeyRootFontRule),'Journey root font must use a fixed rem value or at least 15px');
assert.ok(fixedReadableFontSize(journeyBaseFontRule),'Journey base font must use a fixed rem value or at least 15px');
assert.ok(fixedReadableFontSize(journeyEmptyStateFontRule),'Journey empty states must use a fixed readable rem or pixel size');
assert.doesNotMatch(`${journeyRootFontRule}\n${journeyBaseFontRule}`,/\d*\.?\d+vw\b/i,'Journey root and base font rules must not use viewport-width sizing');
assert.match(css,/@media \(min-width:981px\)\{[\s\S]*?\.journey-page \[data-astrix-destination-ribbon\]\{[\s\S]*?width:min\(1180px,calc\(100% - 64px\)\);[\s\S]*?margin:18px auto 0;/,'Journey ribbon must be compact, centred and separated from the main header');
assert.match(css,/\.journey-page \.apx-destination-ribbon a:hover,[\s\S]*?border-color:rgba\(201,168,76,\.68\);[\s\S]*?box-shadow:/,'Journey ribbon must provide the approved block hover state');
assert.match(css,/\.journey-map-stage\{[\s\S]*?position:absolute;[\s\S]*?transform-origin:center;/,'Map image and markers must share one anchored stage');
assert.match(css,/\.journey-map-marker\{[\s\S]*?transform:translate\(-50%,-50%\) scale\(var\(--journey-marker-scale\)\);/,'Static activity markers must remain anchored and legible while zooming');
assert.match(css,/\.journey-region-chests\{[\s\S]*?position:absolute;[\s\S]*?top:18px;[\s\S]*?left:18px;[\s\S]*?width:min\(440px,calc\(100% - 36px\)\);[\s\S]*?background:rgba\(4,6,7,\.05\);[\s\S]*?pointer-events:none;/,'Regional chest progress must remain fixed at the map top left with 95 percent transparency and readable large-screen sizing');
assert.doesNotMatch(css,/body\.journey-page[^}]*transform\s*:\s*scale\(|\.apx-page-shell[^}]*position\s*:\s*absolute/,'Journey page layout must remain in document flow without transform scaling');

console.log('JOURNEY_2560_NATIVE_SCALE=PASS');
console.log('JOURNEY_FULL_VIEWPORT_ATMOSPHERE=PASS');
console.log('JOURNEY_DEEP_SPACE_BOTTOM_FADE=PASS');
console.log('JOURNEY_LOCATION_ART_RECOGNISABLE=PASS');
console.log('JOURNEY_BALANCED_DATA_REGIONS=PASS');
console.log('JOURNEY_COMPACT_RIBBON=PASS');
console.log('JOURNEY_DUPLICATE_DESTINATIONS_REMOVED=PASS');
console.log('JOURNEY_DATA_MECHANICS_UNCHANGED=PASS');
console.log('JOURNEY_COSMODROME_MAP_4K=PASS');
console.log('JOURNEY_COSMODROME_MAP_CRISP_ZOOM=PASS');
console.log('JOURNEY_COSMODROME_MAP_INTERACTIVE=PASS');
console.log('JOURNEY_COSMODROME_STATIC_ACTIVITY_MARKERS=PASS');
console.log('JOURNEY_REGION_CHEST_OVERLAY=PASS');
console.log('JOURNEY_REGION_CHEST_DATA_HONEST=PASS');
console.log('JOURNEY_COSMODROME_PROGRESS_INDICATORS=PASS');
console.log('JOURNEY_ALL_DESTINATION_PROGRESS_INDICATORS=PASS');
console.log('JOURNEY_PARAMETERISED_DESTINATION_LABELS=PASS');
console.log('JOURNEY_PLACEHOLDER_MAP_4K=PASS');
console.log('JOURNEY_PLACEHOLDER_MAP_CRISP_ZOOM=PASS');
console.log('JOURNEY_COSMODROME_LIVE_ACTIVITY_LAYER_DEFERRED=PASS');
console.log('GLOBAL_HERO_CARDS=PASS');
console.log('GLOBAL_HERO_WARLOCK_CENTRED=PASS');
console.log('GLOBAL_HERO_TOPBAR_ANCHORED=PASS');
console.log('GLOBAL_DESTINATION_BUTTONS=PASS');
console.log('GLOBAL_PARADOX_MAP_BACKGROUND=PASS');
console.log('GLOBAL_PARADOX_MAP_SLIGHT_BLUR=PASS');
