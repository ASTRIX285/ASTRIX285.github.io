import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TOOL_INTROS,toolIntroConfig} from '../pages/tool-intro/tool-intro-config.mjs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const html=read('astrix-app/pages/tool-intro/index.html');
const css=read('astrix-app/pages/tool-intro/tool-intro.css');
const runtime=read('astrix-app/pages/tool-intro/tool-intro.mjs');
const preload=read('astrix-app/pages/forge-loader/forge-loader-preload.mjs');
const forge=read('astrix-app/pages/forge-loader/forge-loader.mjs');
const ribbon=read('astrix-app/shared/astrix-destination-ribbon.js');
const access=read('astrix-app/pages/guardian-workspace-v2/guardian-vault-access.mjs');
const provenance=read('ARTWORK_PROVENANCE.md');
const logo=read('img/brands/bungie-logo.svg').trim();

assert.deepEqual(Object.keys(TOOL_INTROS),['destiny-2'],'The first tool intro must be registered by game id');
const destiny=toolIntroConfig('destiny-2');
for(const key of ['title','purpose','limitations','ctaLabel','keyArt','developerLogo','disclaimer'])assert.ok(destiny[key],`Destiny 2 intro is missing ${key}`);
assert.equal(toolIntroConfig('unregistered-game'),null,'Unregistered games must never inherit fabricated Destiny content');
assert.equal(destiny.keyArt,'/img/games/D2_JB.jpg');
assert.equal(destiny.developerLogo,'/img/brands/bungie-logo.svg');
assert.match(destiny.disclaimer,/not officially affiliated with Bungie/);
assert.doesNotMatch(Object.values(destiny).join(' '),/—|–/,'Tool intro copy must not contain em or en dashes');

assert.match(html,/id="toolIntroArt"[\s\S]*?id="toolIntroTitle"[\s\S]*?id="toolIntroPurpose"[\s\S]*?id="toolIntroLimitations"[\s\S]*?id="toolIntroCta"/,'Intro page must expose the data driven content slots');
assert.match(html,/Game developed by[\s\S]*?img\/brands\/bungie-logo\.svg[\s\S]*?not officially affiliated with Bungie/,'Intro page must show Bungie attribution, the official wordmark and the affiliation disclaimer');
assert.match(css,/\.tool-intro-art\{object-fit:cover;object-position:center\}/,'Key art must be placed without recolouring');
assert.doesNotMatch(css,/\.tool-intro-art[^}]*filter:|\.tool-intro-credit img[^}]*filter:/,'Official art and developer logo must not be recoloured');
assert.match(css,/@media\(max-width:800px\)/,'Intro page must provide a mobile composition');

assert.match(runtime,/const seenKey=`astrix_intro_seen_\$\{gameId\}`/,'Seen state must be namespaced per game');
assert.match(runtime,/if\(!config\|\|hasSeenIntro\(\)\)location\.replace\(target\)/,'Seen intros must skip straight to Forge Loader');
assert.match(runtime,/rememberIntro\(\)[\s\S]*?classList\.add\('is-transitioning'\)[\s\S]*?prepareForgeLoaderEntry\(target,await sessionPromise\)/,'CTA must store seen state, start the transition and enter the shared preload path');
assert.match(runtime,/entry\.kind==='authentication'[\s\S]*?location\.assign\(entry\.authUrl\)/,'First connection must immediately enter the existing Bungie approval route');
assert.match(runtime,/Promise\.race\(\[entry\.promise\.catch\(\(\)=>null\),timeout\]\)/,'Returning sessions must preload while the intro transition is visible');
assert.match(runtime,/Preparing your verified data for a faster load|config\.loadingLabel/,'Loading copy must describe preparation without a speed guarantee');

assert.match(preload,/\/bungie\/page\/loadout/,'Shared preload must request the prepared Loadout page payload');
assert.match(preload,/readCachedBungieProfile[\s\S]*?cacheBungieProfile/,'Shared preload must reuse and persist the existing profile cache');
assert.match(preload,/payload\?\.pageReady\?\.page!=='loadout'/,'Shared preload must reject the wrong page payload');
assert.match(preload,/prepareForgeLoaderEntry[\s\S]*?authStartUrl\(target\)[\s\S]*?preloadForgeLoaderPayload\(session,\{force:true\}\)/,'Shared preload must select OAuth or prepared profile data from the current session');
assert.match(forge,/from '\.\/forge-loader-preload\.mjs\?v=20260906-tool-intro-1'/,'Forge Loader must consume the same preload module as the intro');
assert.doesNotMatch(forge,/new URL\('\/bungie\/page\/loadout'/,'Forge Loader must not fork its own prepared payload request');
assert.match(ribbon,/key:'forge-loader'[\s\S]*?href:'\/astrix-app\/pages\/tool-intro\/\?game=destiny-2'/,'Forge Loader ribbon entry must pass through the per game intro');
assert.match(access,/\/astrix-app\/pages\/tool-intro\/[\s\S]*?intro\.searchParams\.set\('game','destiny-2'\)[\s\S]*?intro\.searchParams\.set\('return',forgeLoaderTargetUrl\(slot\)\.toString\(\)\)/,'Armour entry must preserve its Forge Loader target through the intro');

assert.match(provenance,/bungie-logo\.svg[\s\S]*?bungie_logo_basic\.svg/,'Bungie logo provenance must name the official source asset');
assert.match(logo,/<title>Bungie<\/title>/);
assert.equal(createHash('sha256').update(logo).digest('hex'),'5ed902dcbedce8e87871144fcbcfb3fd6b62c8b105a2761dbbb78651deb4a4fa','Bungie logo must match the official source bytes apart from its final newline');
assert.doesNotMatch([html,runtime,preload].join('\n'),/bungie\/manifest\/definition/,'Intro and preload must never issue live definition requests');

console.log('TOOL_INTRO_DATA_DRIVEN_ROUTE=PASS');
console.log('TOOL_INTRO_SEEN_ONCE=PASS');
console.log('TOOL_INTRO_SHARED_PRELOAD=PASS');
console.log('TOOL_INTRO_OFFICIAL_ARTWORK=PASS');
