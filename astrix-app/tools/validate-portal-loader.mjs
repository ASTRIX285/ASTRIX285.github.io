import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../../',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const pages={
  'Build library':'astrix-app/index.html',
  'Guardian Journey':'astrix-app/components/guardian-workspace/guardian-workspace.html',
  'Guardian Main':'astrix-app/pages/guardian-workspace-v2/index.html',
  'Build Space':'astrix-app/pages/guardian-workspace-v2/paradox-build-space/index.html',
  'Shooting Range':'astrix-app/pages/guardian-workspace-v2/shooting-range-test/index.html',
  'Journey':'astrix-app/pages/journey/index.html',
  'Mission Reports':'astrix-app/pages/mission-reports/index.html',
  'Vault':'astrix-app/pages/vault/index.html',
  'Forge Loader':'astrix-app/pages/forge-loader/index.html',
  'Loadout':'astrix-app/pages/loadout/index.html'
};
const operationsHtml=await read('index.html');
const [portalCss,portalJs,mainProgress,buildModule,mainHtml,buildHtml,appModule,subclassModule,journeyModule,journeyPageModule,journeyMaps]=await Promise.all([
  read('astrix-app/shared/astrix-portal-loader.css'),
  read('astrix-app/shared/astrix-portal-loader.js'),
  read('astrix-app/pages/guardian-workspace-v2/guardian-portal-progress.mjs'),
  read('astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs'),
  read(pages['Guardian Main']),read(pages['Build Space']),read('astrix-app/app.js'),read('astrix-app/subclass-filter-ui.js'),
  read('astrix-app/components/guardian-workspace/guardian-workspace.mjs'),
  read('astrix-app/pages/journey/journey.mjs'),
  read('astrix-app/pages/journey/journey-location-maps.mjs')
]);

for(const [label,path] of Object.entries(pages)){
  const html=await read(path);
  assert.match(html,/astrix-portal-loader\.css/,`${label} must link the shared portal stylesheet`);
  assert.match(html,/window\.APX_LOGO=/,`${label} must configure the real site logo`);
  assert.match(html,/astrix-portal-loader\.js/,`${label} must load the shared portal controller early`);
}
assert.doesNotMatch(operationsHtml,/astrix-portal-loader\.(?:css|js)|window\.APX_LOGO=/,'Public homepage must not mount the tool portal loader');

assert.match(portalCss,/body\.apx-loading\{overflow:hidden!important\}/,'Portal must lock body scroll above page-specific layout rules');
assert.match(portalCss,/@media\(prefers-reduced-motion:reduce\)/,'Portal must freeze animation for reduced motion');
assert.match(portalJs,/role="status" aria-live="polite"/,'Portal must expose accessible live status');
assert.match(portalJs,/pendingPct=Math\.max\(pendingPct,v\)/,'Progress must remain monotonic across early page milestones');
assert.match(portalJs,/pendingDone=true/,'Render completion must queue safely before DOM mount');
assert.match(portalJs,/APX_SKIP_PORTAL===true[\s\S]*?skipped:true/,'Cached Guardian return must be able to bypass a second full portal sequence');
assert.match(portalJs,/authRequired:authRequired/,'Portal must expose a dedicated Bungie authentication state');
assert.match(portalJs,/function done\(\)\{if\(pendingAuthUrl\)return/,'Portal must not reveal an unauthenticated application shell');
assert.match(portalCss,/\.apx-auth-panel/,'Portal must render the full-screen Bungie authentication panel');
assert.match(portalCss,/astrix-paradox-map-placeholder-4k\.webp/,'Portal must use the ASTRIX PARADOX map artwork');
assert.match(portalCss,/--apx-loader-crimson:#d3202f/,'Portal must use the approved bright crimson treatment');
assert.match(portalCss,/--apx-loader-gold:#ffd36a/,'Portal must use the approved bright gold treatment');
assert.doesNotMatch(portalCss,/--apx-(?:cyan|blue|glow|deep):/,'Portal must not retain the old blue palette');
assert.match(portalJs,/function ready\(root\)[\s\S]*?document\.fonts[\s\S]*?querySelectorAll\('img'\)[\s\S]*?requestAnimationFrame/,'Portal ready state must wait for fonts, visible images and final paint');

assert.doesNotMatch(mainHtml,/guardian-loading-gate|guardianLoadingProgress|data-lit-edges/,'Main legacy red-diamond gate must be removed');
assert.doesNotMatch(buildHtml,/build-loading-gate|buildLoadingProgress|data-lit-edges/,'Build legacy hex gate must be removed');
assert.match(mainProgress,/astrix:guardian-render-complete',\(\)=>\{if\(!isBuildSpace\)finishAfterPaint/,'Character completion must not reveal Build Forge before its own render completes');
assert.match(mainProgress,/astrix:build-render-complete',event=>\{[\s\S]*?status==='ready'\)finishAfterPaint\('Build Forge rendered'\)[\s\S]*?status==='pending'\)finishAfterPaint\('Build Forge recovery available'\)/,'Build loader must reveal either the verified build or its controlled recovery surface instead of remaining at the manifest checkpoint');
assert.match(mainProgress,/astrix:guardian-error',\(\)=>finishAfterPaint\(isBuildSpace\?'Build Forge state rendered':'Guardian state rendered'\)/,'A genuine profile error must reveal the rendered error state');
assert.match(mainProgress,/document\.querySelectorAll\('\.scene\.immersive'\)/,'Portal completion must inspect the shared scene background');
assert.match(mainProgress,/image\.addEventListener\('load',async\(\)=>\{try\{await image\.decode\(\);\}/,'Portal completion must wait for CSS background decoding');
assert.match(mainProgress,/await manifestReady;[\s\S]*?await sceneBackgroundReady;/,'Portal must retain its cover until manifest and scene background are both ready');
assert.match(mainProgress,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>loader\?\.done\(\)\)\)/,'Main completion must clear after the final painted frame');
assert.match(mainProgress,/else set\(8,'Bungie authentication required'\)/,'Main portal must remain gated until Bungie authentication completes');
assert.match(mainProgress,/currentSession=window\.ASTRIX_BUNGIE_SESSION[\s\S]*?guardianRenderComplete/,'Main portal must reconcile a session or render that completed before listener registration');
assert.ok(mainHtml.indexOf('guardian-portal-progress.mjs')<mainHtml.indexOf('guardian-workspace-v2.mjs'),'Main progress listener must load before Guardian startup');
assert.match(mainHtml,/astrix:guardian-fast-return:v1/,'Main must consume the Build-to-Guardian fast-return marker before the portal mounts');
assert.match(buildHtml,/astrix:guardian-fast-return:v1/,'Build must consume the authenticated Main-to-Build fast-return marker before the portal mounts');
assert.match(buildModule,/markGuardianFastReturn\(\)/,'Build Back must preserve the authenticated Guardian session return path');
assert.doesNotMatch(mainProgress,/setTimeout|window\.addEventListener\('load'/,'Main progress must not use fake timing or window load');
assert.match(buildModule,/const ready=Boolean\(build\),status=ready\?'ready':'pending'/,'An empty initial Build render must remain pending while the live profile resolves');
assert.match(buildModule,/emitLoad\('render',ready\?LOAD_STAGES\.READY:LOAD_STAGES\.SNAPSHOT,label,status\)/,'Only a populated Build render may report the ready milestone');
assert.match(buildModule,/guardian-portal-progress\.mjs\?v=20260905-weapon-audit-1/,'Build must load the atomic-transfer portal progress module without a stale cache');
assert.match(buildModule,/window\.AstrixLoader\?\.set\(percent\)/,'Build real milestones must update the shared portal');

assert.match(appModule,/astrix:build-catalogue-rendered/,'Build library must publish catalogue render completion');
assert.match(subclassModule,/astrix:subclass-filter-rendered/,'Build library must publish subclass-filter render completion');
assert.match(journeyModule,/renderGuardian\(root, state\);[\s\S]*?AstrixLoader\?\.set\(88\)/,'Guardian Journey must report progress after its state is painted');
assert.match(journeyPageModule,/function waitForHeroCards\(\)[\s\S]*?astrix:hero-cards-render-complete/,'Journey loader must wait for the header character cards');
assert.match(journeyPageModule,/function waitForJourneyAtmosphere\(\)[\s\S]*?ASTRIX_LOCATION_VISUALS[\s\S]*?image\.decode/,'Journey loader must decode the active destination atmosphere');
assert.match(journeyPageModule,/await Promise\.all\(\[[\s\S]*?waitWithin\(heroCardsReady,JOURNEY_BOOTSTRAP_UI_WAIT_MS\)[\s\S]*?waitWithin\(mapReady,JOURNEY_BOOTSTRAP_UI_WAIT_MS\)[\s\S]*?waitWithin\(waitForJourneyAtmosphere\(\),JOURNEY_BOOTSTRAP_UI_WAIT_MS\)[\s\S]*?\]\)/,'Journey must settle every independently rendered surface behind bounded waits');
assert.match(journeyPageModule,/function finishJourneyLoader\(root=document\)[\s\S]*?AstrixLoader\.ready\(root\)[\s\S]*?finishJourneyLoader\(document\)/,'Journey final readiness must include the header and body-level artwork');
assert.doesNotMatch(journeyPageModule,/AstrixLoader\.ready\(dashboard\)/,'Journey must not limit loader readiness to the dashboard subtree');
assert.match(journeyMaps,/astrix:journey-location-map-render-complete/,'Journey location map must publish a durable render-complete event');
assert.match(journeyMaps,/if\(image\.complete\)queueMicrotask\(\(\)=>finish\(image\.naturalWidth>0\?'ready':'unavailable'\)\)/,'Journey map completion must reconcile cached images');
assert.match(journeyMaps,/try\{if\(status==='ready'&&image\.decode\)await image\.decode\(\);\}catch\{\}/,'Journey map completion must wait for image decoding');

console.log('GLOBAL_PORTAL_SINGLE_OWNER=PASS');
console.log('GLOBAL_PORTAL_ALL_DATA_PAGES=PASS');
console.log('GLOBAL_PORTAL_PUBLIC_HOMEPAGE_BYPASS=PASS');
console.log('GLOBAL_PORTAL_REAL_RENDER_COMPLETION=PASS');
console.log('GLOBAL_PORTAL_ACCESSIBILITY_MOTION=PASS');
