import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(`${root}${path}`,'utf8');

const publicPages=new Map([
  ['index.html','href="tools/">Tools</a>'],
  ['pages/reviews.html','href="../tools/">Tools</a>'],
  ['pages/news.html','href="../tools/">Tools</a>'],
  ['pages/clips.html','href="../tools/">Tools</a>'],
  ['pages/games.html','href="../tools/">Tools</a>'],
  ['pages/join.html','href="../tools/">Tools</a>']
]);

for(const [path,toolsLink] of publicPages){
  const html=read(path);
  assert.ok(html.includes(toolsLink),`${path} must link to the Tools hub`);
}

const tools=read('tools/index.html');
const toolsCss=read('tools/tools.css');
assert.ok(tools.includes('href="index.html" class="active">Tools</a>'),'Tools navigation item must be active');
assert.ok(tools.includes('Tools for the games we play'),'Tools page must explain the multi-game purpose');
assert.equal((tools.match(/<section class="tools-hero">/g)??[]).length,1,'Tools introduction must use one hero section');
assert.doesNotMatch(tools,/<section class="tools-principles"/,'Tools purpose must not be split into a second section');
assert.ok(tools.indexOf('Better tools.')<tools.indexOf('Bring the useful information'),'Tools purpose must be presented inside the combined introduction');
assert.equal((tools.match(/<article class="principle /g)??[]).length,4,'Combined introduction must retain four principles');
assert.ok(tools.includes('Destiny 2 Guardian Platform'),'Tools page must identify the current platform');
assert.ok(tools.includes('Alpha · Invitation Only'),'Tools page must state the current access level');
assert.ok(tools.includes('../astrix-app/pages/guardian-alpha/'),'Tools page must retain access to the current Alpha page');
assert.ok(tools.includes('class="btn-primary alpha-entry-link"'),'Tools page must use a clear Enter Alpha button');
assert.doesNotMatch(tools,/The first platform we are building is for Destiny 2\./,'Removed Destiny opening sentence must not return');
assert.doesNotMatch(tools,/destination-heading|destination-grid|Six parts of the same Guardian story/,'Destiny destinations must not appear publicly on the Tools page');
assert.doesNotMatch(tools,/tools-future|Future route pattern|astrixparadox\.com\/tools\/\{game\}|More than one game/,'Generic future-game section must remain removed');
assert.doesNotMatch(tools,/astrix-portal-loader|APX_LOGO/,'Public Tools hub must not mount the application loader');
assert.doesNotMatch(tools,/—|–|&mdash;|&ndash;/,'Tools page must not use em or en dashes');
assert.match(toolsCss,/\.tools-intro-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.08fr\) minmax\(340px, 0\.92fr\);/,'Combined Tools introduction must use the approved desktop composition');
assert.match(toolsCss,/@media \(max-width: 768px\)[\s\S]*?\.tools-intro-layout,[\s\S]*?grid-template-columns:\s*1fr;/,'Tools introduction must stack on phone and tablet widths');

const games=read('pages/games.html');
assert.doesNotMatch(games,/guardian-alpha|tools-section|Guardian Build Forge/,'Universes page must remain separate from the Tools catalogue');
assert.ok(games.includes('Gaming <span class="accent">Universes</span>'),'Universes page must keep its own purpose');

const alpha=read('astrix-app/pages/guardian-alpha/index.html');
assert.ok(alpha.includes('href="../../../tools/">BACK TO TOOLS</a>'),'Alpha page must return to the Tools hub');
assert.ok(alpha.includes('id="alphaAccessForm"'),'Alpha page must present the access-code gate');
assert.ok(alpha.includes('id="alphaAccessCode"'),'Alpha page must include the access-code input');
assert.ok(alpha.includes('src="./guardian-alpha.mjs"'),'Alpha page must load its access-flow controller');
assert.ok(alpha.includes('id="guardianDestinationPopup"'),'Alpha page must contain the post-auth Destiny selector');
assert.ok(alpha.includes('id="guardianDestinationPopup" hidden aria-hidden="true"'),'Destiny selector must begin closed and hidden from assistive technology');
assert.equal((alpha.match(/<a class="destination" /g)??[]).length,6,'Authenticated Destiny selector must contain six destinations');
assert.match(alpha,/\.destination-backdrop\.is-open\{display:grid\}/,'Destiny selector must use an explicit visible state');
assert.match(alpha,/@media\(max-width:820px\)[\s\S]*?\.destination-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'Destiny selector must use two columns at tablet widths');
assert.match(alpha,/@media\(max-width:560px\)[\s\S]*?\.destination-grid\{grid-template-columns:1fr\}/,'Destiny selector must use one column at phone widths');
assert.match(alpha,/@media\(max-width:560px\)[\s\S]*?\.access-row\{grid-template-columns:1fr\}/,'Alpha access form must stack at phone widths');
assert.doesNotMatch(alpha,/—|–|&mdash;|&ndash;/,'Alpha page must not use em or en dashes');

for(const route of [
  '../journey/',
  '../guardian-workspace-v2/',
  '../guardian-workspace-v2/paradox-build-space/',
  '../mission-reports/',
  '../vault/',
  '../loadout/'
]){
  assert.ok(alpha.includes(`href="${route}"`),`Authenticated Destiny selector must include ${route}`);
}

const alphaFlow=read('astrix-app/pages/guardian-alpha/guardian-alpha.mjs');
assert.ok(alphaFlow.includes("ACCESS_STORAGE_KEY='astrix-paradox-beta-access'"),'Alpha page must reuse the existing workspace access flag');
assert.ok(alphaFlow.includes("input.value.trim()!==ACCESS_CODE"),'Alpha code must be checked before authentication starts');
assert.ok(alphaFlow.indexOf("input.value.trim()!==ACCESS_CODE")<alphaFlow.indexOf('getBungieSession();'),'Invalid Alpha access must be rejected before Bungie session handling');
assert.ok(alphaFlow.includes("location.assign(authStartUrl())"),'Valid Alpha access must continue into Bungie authentication');
assert.ok(alphaFlow.includes("if(!hasAlphaAccess())return"),'Post-auth selector must remain behind Alpha access');
assert.match(alphaFlow,/if\(!session\?\.authenticated\)[\s\S]*?return;[\s\S]*?showConnectedState\(\);[\s\S]*?openDestinationSelector\(\);/,'Destiny selector must open only after Bungie authentication');
assert.match(alphaFlow,/function openDestinationSelector\(\)\{[\s\S]*?removeAttribute\('hidden'\);[\s\S]*?setAttribute\('aria-hidden','false'\);[\s\S]*?classList\.add\('is-open'\);/,'Connected Bungie sessions must explicitly reveal the Destiny selector');
assert.match(alphaFlow,/if\(session\?\.authenticated\)\{[\s\S]*?showConnectedState\(\);[\s\S]*?openDestinationSelector\(\);[\s\S]*?return;/,'Valid Alpha access with an active Bungie session must open the Destiny selector immediately');

console.log('MULTI_GAME_TOOLS_HUB=PASS');
console.log('ALPHA_ACCESS_BEFORE_BUNGIE=PASS');
console.log('DESTINY_SELECTOR_AFTER_AUTH=PASS');
console.log('CONNECTED_TOKEN_IMMEDIATE_SELECTOR=PASS');
console.log('RESPONSIVE_TOOLS_ALPHA_CONTRACT=PASS');
