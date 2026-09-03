import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set([
  'astrix-app/tools/validate-journey-visual-pass.mjs',
  'astrix-app/tools/validate-scope-guard.mjs',
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
