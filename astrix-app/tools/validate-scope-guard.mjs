import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set([
  '.github/workflows/deploy-astrix-sandbox.yml',
  'astrix-auth-worker/src/index.ts',
  'astrix-auth-worker/wrangler.toml',
  'astrix-sandbox/cloudflare-pages.mjs',
  'astrix-sandbox/pages-worker.js',
  'astrix-sandbox/prepare-deployment.mjs',
  'astrix-sandbox/wrangler.toml',
  'astrix-app/pages/guardian-workspace-v2/guardian-bungie-profile.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-bungie-auth.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-beta-readiness.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-workspace-v2.mjs',
  'astrix-app/pages/guardian-workspace-v2/guardian-shooting-range-capture.mjs',
  'astrix-app/pages/guardian-workspace-v2/index.html',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/index.html',
  'astrix-app/pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs',
  'astrix-app/pages/guardian-alpha/guardian-alpha.mjs',
  'astrix-app/pages/guardian-alpha/index.html',
  'astrix-app/pages/journey/index.html',
  'astrix-app/pages/journey/journey-2560-visual.css',
  'astrix-app/pages/journey/journey-location-maps.mjs',
  'astrix-app/pages/journey/journey.mjs',
  'astrix-app/pages/mission-reports/index.html',
  'astrix-app/pages/mission-reports/mission-reports-data.mjs',
  'astrix-app/pages/mission-reports/mission-reports.mjs',
  'astrix-app/pages/vault/index.html',
  'astrix-app/pages/loadout/index.html',
  'astrix-app/shared/astrix-hero-cards.mjs',
  'astrix-app/tools/validate-journey-visual-pass.mjs',
  'astrix-app/tools/validate-main-page-today.mjs',
  'astrix-app/tools/validate-portal-loader.mjs',
  'astrix-app/tools/validate-sandbox-deployment.mjs',
  'astrix-app/tools/validate-scope-guard.mjs',
  'astrix-app/tools/validate-super-formation.mjs',
  'astrix-app/tools/validate-tools-hub.mjs',
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
