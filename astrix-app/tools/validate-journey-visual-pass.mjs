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
const cosmodromeMap=readFileSync(`${root}astrix-app/pages/journey/assets/maps/cosmodrome-director-map-4k.webp`);

assert.ok(html.includes('class="apx-destination-page journey-page"'),'Journey must own its large-screen visual scope');
assert.ok(html.includes('href="./journey-2560-visual.css?v=20260830-cosmodrome-map"'),'Journey must load the versioned visual correction');
assert.ok(html.indexOf('journey-2560-visual.css')<html.indexOf('astrix-desktop-density.css'),'Shared desktop density must remain the final stylesheet');
assert.ok(html.includes('data-astrix-destination-ribbon data-active-destination="journey"'),'Journey must retain the shared six-page ribbon mount');
assert.doesNotMatch(html,/journeyDestinations|apx-destination-links|apx-destination-link/,'Journey must not duplicate the shared ribbon at the bottom of the page');

for(const id of [
  'journeyAuthStatus',
  'journeyResolving',
  'journeySignedOut',
  'journeyDashboard',
  'journeyConnectAction',
  'journeyLocationSelector',
  'journeyLocationDetail'
])assert.ok(html.includes(`id="${id}"`),`Journey data mount ${id} must remain available`);

assert.equal((html.match(/class="apx-scaffold-card"/g)??[]).length,10,'Journey must retain all ten future data regions');
assert.equal((ribbon.match(/Object\.freeze\(\{key:/g)??[]).length,6,'Shared Journey ribbon must retain all six destination routes');
assert.ok(journey.includes('initLocationSelector({'),'Journey must retain the location-selector wiring');
assert.ok(journey.includes("mount:document.getElementById('journeyLocationSelector')"),'Journey selector mount must remain unchanged');
assert.ok(journey.includes("detail:document.getElementById('journeyLocationDetail')"),'Journey detail mount must remain unchanged');
assert.ok(journey.includes('const session=await getBungieSession();'),'Journey authentication must remain unchanged');
assert.ok(journey.includes("import {initJourneyLocationMaps} from './journey-location-maps.mjs'"),'Journey must load its separate page-owned map registry');
assert.ok(journey.includes('initJourneyLocationMaps('),'Journey must initialise its page-owned interactive map layer');
assert.ok(mapModule.includes("src:'./assets/maps/cosmodrome-director-map-4k.webp'"),'Journey map registry must mount the page-owned Cosmodrome map asset');
assert.ok(mapModule.includes("addEventListener('pointermove'"),'Journey map must support pointer panning');
assert.ok(mapModule.includes("addEventListener('wheel'"),'Journey map must support wheel zooming');
assert.equal(cosmodromeMap.subarray(0,4).toString('ascii'),'RIFF','Cosmodrome map must be a valid WebP asset');
assert.equal(cosmodromeMap.subarray(8,12).toString('ascii'),'WEBP','Cosmodrome map must be a valid WebP asset');
assert.equal(cosmodromeMap.subarray(12,16).toString('ascii'),'VP8 ','Cosmodrome map must use the validated WebP encoding');
assert.equal(cosmodromeMap.readUInt16LE(26)&0x3fff,3840,'Cosmodrome map must be exactly 3840px wide');
assert.equal(cosmodromeMap.readUInt16LE(28)&0x3fff,2160,'Cosmodrome map must be exactly 2160px high');

assert.match(css,/@media \(min-width:1500px\)\{[\s\S]*?body\.journey-page\.apx-destination-page\{[\s\S]*?zoom:1;/,'Journey must restore native scale on large monitors');
assert.match(css,/body\.journey-page\.apx-destination-page \.apx-atmo\{[\s\S]*?width:100vw;[\s\S]*?max-width:none;/,'Journey atmosphere must cover the full viewport');
assert.match(css,/\.journey-page \.apx-atmo-base\{[\s\S]*?-webkit-mask-image:linear-gradient\(to bottom,#000 0%,#000 46%,rgba\(0,0,0,\.72\) 65%,rgba\(0,0,0,\.22\) 86%,transparent 100%\);[\s\S]*?mask-image:linear-gradient\(to bottom,#000 0%,#000 46%,rgba\(0,0,0,\.72\) 65%,rgba\(0,0,0,\.22\) 86%,transparent 100%\);/,'Journey deep-space base must fade toward the bottom without altering location art');
assert.match(css,/\.journey-page \.apx-atmo-photo\{[\s\S]*?filter:blur\(5px\) brightness\(\.67\) saturate\(1\.08\);/,'Journey location art must remain softly recognisable on large screens');
assert.match(css,/body\.journey-page\.apx-destination-page \.apx-page-shell\{[\s\S]*?width:min\(1920px,calc\(100% - 64px\)\);[\s\S]*?max-width:1920px;/,'Journey content must use a controlled large-screen width');
assert.match(css,/\.journey-page \.apx-card-grid\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/,'Journey future data cards must form complete large-screen rows');
assert.match(css,/\.journey-page \.apx-loc-layout\{[\s\S]*?grid-template-columns:minmax\(360px,420px\) minmax\(0,1fr\);/,'Journey location focus must use balanced large-screen columns');
assert.match(css,/\.journey-page \.apx-empty-state\{[\s\S]*?font-size:clamp\(15px,\.65vw,17px\);/,'Journey empty states must remain legible at 2560px');
assert.match(css,/@media \(min-width:981px\)\{[\s\S]*?\.journey-page \[data-astrix-destination-ribbon\]\{[\s\S]*?width:min\(1180px,calc\(100% - 64px\)\);[\s\S]*?margin:18px auto 0;/,'Journey ribbon must be compact, centred and separated from the main header');
assert.match(css,/\.journey-page \.apx-destination-ribbon a:hover,[\s\S]*?border-color:rgba\(201,168,76,\.68\);[\s\S]*?box-shadow:/,'Journey ribbon must provide the approved block hover state');
assert.doesNotMatch(css,/position\s*:\s*absolute|transform\s*:\s*scale\(/,'Journey visual correction must remain in document flow');

console.log('JOURNEY_2560_NATIVE_SCALE=PASS');
console.log('JOURNEY_FULL_VIEWPORT_ATMOSPHERE=PASS');
console.log('JOURNEY_DEEP_SPACE_BOTTOM_FADE=PASS');
console.log('JOURNEY_LOCATION_ART_RECOGNISABLE=PASS');
console.log('JOURNEY_BALANCED_DATA_REGIONS=PASS');
console.log('JOURNEY_COMPACT_RIBBON=PASS');
console.log('JOURNEY_DUPLICATE_DESTINATIONS_REMOVED=PASS');
console.log('JOURNEY_DATA_MECHANICS_UNCHANGED=PASS');
console.log('JOURNEY_COSMODROME_MAP_4K=PASS');
console.log('JOURNEY_COSMODROME_MAP_INTERACTIVE=PASS');
