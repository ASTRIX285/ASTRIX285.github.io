import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set([
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.css',
  'astrix-app/pages/guardian-workspace-v2/guardian-bungie-profile.mjs',
  'astrix-app/pages/guardian-workspace-v2/subclass-picker.css',
  'astrix-app/pages/guardian-workspace-v2/guardian-super-feature-sync.mjs',
  'astrix-app/tools/validate-scope-guard.mjs'
]);
const changed=execFileSync('git',['diff','--name-only','origin/fix/main-page-today...HEAD'],{cwd:root,encoding:'utf8'})
  .split(/\r?\n/).filter(Boolean);
const outside=changed.filter(path=>!allowed.has(path)&&!/^astrix-app\/tools\/paradox-validator\.[^/]+$/.test(path));

assert.deepEqual(outside,[],`Scope violation:\n${outside.join('\n')}`);
console.log('SCOPE_GUARD=PASS');
