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
assert.ok(tools.includes('href="index.html" class="active">Tools</a>'),'Tools navigation item must be active');
assert.ok(tools.includes('Tools for the games we play'),'Tools page must explain the multi-game purpose');
assert.ok(tools.includes('Destiny 2 Guardian Platform'),'Tools page must identify the current platform');
assert.ok(tools.includes('Alpha · Invitation Only'),'Tools page must state the current access level');
assert.ok(tools.includes('../astrix-app/pages/guardian-alpha/'),'Tools page must retain access to the current Alpha page');
assert.ok(tools.includes('astrixparadox.com/tools/{game}/'),'Tools page must show the reusable route pattern');

for(const destination of ['Journey','Character','Build Forge','Mission Reports','Vault','Loadout']){
  assert.ok(tools.includes(`<h4>${destination}</h4>`),`Tools page must include ${destination}`);
}

assert.equal((tools.match(/<article class="destination /g)??[]).length,6,'Tools page must contain six Destiny 2 destinations');
assert.doesNotMatch(tools,/astrix-portal-loader|APX_LOGO/,'Public Tools hub must not mount the application loader');
assert.doesNotMatch(tools,/—|–|&mdash;|&ndash;/,'Tools page must not use em or en dashes');

const games=read('pages/games.html');
assert.doesNotMatch(games,/guardian-alpha|tools-section|Guardian Build Forge/,'Universes page must remain separate from the Tools catalogue');
assert.ok(games.includes('Gaming <span class="accent">Universes</span>'),'Universes page must keep its own purpose');

const alpha=read('astrix-app/pages/guardian-alpha/index.html');
assert.ok(alpha.includes('href="../../../tools/">BACK TO TOOLS</a>'),'Alpha page must return to the Tools hub');

console.log('MULTI_GAME_TOOLS_HUB=PASS');
