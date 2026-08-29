import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set([
  'astrix-app/pages/guardian-workspace-v2/guardian-bungie-profile.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-portal-progress.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-super-feature-sync.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-workspace-v2.mjs',
  'astrix-app/pages/guardian-workspace-v2/index.html',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space-handoff.mjs',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/index.html',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.css',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs',
  'astrix-app/tools/test-build-space-character-isolation.mjs',
  'astrix-app/tools/validate-scope-guard.mjs',
  'astrix-app/tools/validate-main-page-today.mjs',
  'astrix-app/tools/validate-portal-loader.mjs'
]);
const changed=execFileSync('git',['diff','--name-only','origin/main...HEAD'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
const working=execFileSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
const staged=execFileSync('git',['diff','--name-only','--cached'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
const outside=[...new Set([...changed,...working,...staged,...untracked])].filter(path=>!allowed.has(path));

assert.deepEqual(outside,[],`Scope violation:\n${outside.join('\n')}`);
console.log('SCOPE_GUARD=PASS');
