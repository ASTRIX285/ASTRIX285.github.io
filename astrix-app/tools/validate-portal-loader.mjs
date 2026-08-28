import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../../',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const pages={
  'Operations hub':'index.html',
  'Build library':'astrix-app/index.html',
  'Guardian Journey':'astrix-app/components/guardian-workspace/guardian-workspace.html',
  'Guardian Main':'astrix-app/pages/guardian-workspace-v2/index.html',
  'Build Space':'astrix-app/pages/guardian-workspace-v2/paradox-build-space/index.html',
  'Shooting Range':'astrix-app/pages/guardian-workspace-v2/shooting-range-test/index.html'
};
const [portalCss,portalJs,mainProgress,buildModule,mainHtml,buildHtml,appModule,subclassModule,journeyModule]=await Promise.all([
  read('astrix-app/shared/astrix-portal-loader.css'),
  read('astrix-app/shared/astrix-portal-loader.js'),
  read('astrix-app/pages/guardian-workspace-v2/guardian-portal-progress.mjs'),
  read('astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs'),
  read(pages['Guardian Main']),read(pages['Build Space']),read('astrix-app/app.js'),read('astrix-app/subclass-filter-ui.js'),
  read('astrix-app/components/guardian-workspace/guardian-workspace.mjs')
]);

for(const [label,path] of Object.entries(pages)){
  const html=await read(path);
  assert.match(html,/astrix-portal-loader\.css/,`${label} must link the shared portal stylesheet`);
  assert.match(html,/window\.APX_LOGO=/,`${label} must configure the real site logo`);
  assert.match(html,/astrix-portal-loader\.js/,`${label} must load the shared portal controller early`);
}

assert.match(portalCss,/body\.apx-loading\{overflow:hidden!important\}/,'Portal must lock body scroll above page-specific layout rules');
assert.match(portalCss,/@media\(prefers-reduced-motion:reduce\)/,'Portal must freeze animation for reduced motion');
assert.match(portalJs,/role="status" aria-live="polite"/,'Portal must expose accessible live status');
assert.match(portalJs,/pendingPct=Math\.max\(pendingPct,v\)/,'Progress must remain monotonic across early page milestones');
assert.match(portalJs,/pendingDone=true/,'Render completion must queue safely before DOM mount');
assert.match(portalJs,/APX_SKIP_PORTAL===true[\s\S]*?skipped:true/,'Cached Guardian return must be able to bypass a second full portal sequence');
assert.match(portalJs,/authRequired:authRequired/,'Portal must expose a dedicated Bungie authentication state');
assert.match(portalJs,/function done\(\)\{if\(pendingAuthUrl\)return/,'Portal must not reveal an unauthenticated application shell');
assert.match(portalCss,/\.apx-auth-panel/,'Portal must render the full-screen Bungie authentication panel');

assert.doesNotMatch(mainHtml,/guardian-loading-gate|guardianLoadingProgress|data-lit-edges/,'Main legacy red-diamond gate must be removed');
assert.doesNotMatch(buildHtml,/build-loading-gate|buildLoadingProgress|data-lit-edges/,'Build legacy hex gate must be removed');
assert.match(mainProgress,/astrix:guardian-render-complete',\(\)=>finishAfterPaint/,'Main must finish from its existing render-complete contract');
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
assert.match(buildModule,/completeBuildRender\(build\)[\s\S]*?emitLoad\('render',LOAD_STAGES\.READY/,'Build must finish only from its image-settled render pass');
assert.match(buildModule,/guardian-portal-progress\.mjs\?v=20260829-background-ready-1/,'Build must load the background-gated portal progress module');
assert.match(buildModule,/window\.AstrixLoader\?\.set\(percent\)/,'Build real milestones must update the shared portal');

assert.match(appModule,/astrix:build-catalogue-rendered/,'Build library must publish catalogue render completion');
assert.match(subclassModule,/astrix:subclass-filter-rendered/,'Build library must publish subclass-filter render completion');
assert.match(journeyModule,/renderGuardian\(root, state\);[\s\S]*?AstrixLoader\?\.set\(88\)/,'Guardian Journey must report progress after its state is painted');

console.log('GLOBAL_PORTAL_SINGLE_OWNER=PASS');
console.log('GLOBAL_PORTAL_ALL_DATA_PAGES=PASS');
console.log('GLOBAL_PORTAL_REAL_RENDER_COMPLETION=PASS');
console.log('GLOBAL_PORTAL_ACCESSIBILITY_MOTION=PASS');
