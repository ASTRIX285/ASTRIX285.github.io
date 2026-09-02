import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>readFileSync(`${root}${path}`,'utf8');
const workflow=read('.github/workflows/deploy-astrix-sandbox.yml');
const prepare=read('astrix-sandbox/prepare-deployment.mjs');
const pagesWorker=read('astrix-sandbox/pages-worker.js');
const cloudflare=read('astrix-sandbox/cloudflare-pages.mjs');
const authConfig=read('astrix-auth-worker/wrangler.toml');

assert.match(workflow,/push:\s*\n\s*branches:\s*\n\s*- sandbox/,'Sandbox deployment must trigger only from the sandbox branch');
assert.doesNotMatch(workflow,/branches:\s*\n\s*- main/,'Sandbox deployment must not trigger from main');
assert.match(workflow,/pages deploy \.sandbox-dist --project-name astrix-paradox-sandbox --branch sandbox/,'Sandbox workflow must deploy the prepared static site');
assert.match(workflow,/workingDirectory: astrix-auth-worker[\s\S]*?command: deploy/,'Sandbox workflow must deploy the exact authenticated sandbox origin');
assert.match(prepare,/astrix-app\/data\/armor-information\.json/,'Oversized verified armour data must be streamed instead of uploaded to Pages');
assert.match(prepare,/ASTRIX285\.github\.io/,'The duplicate legacy repository tree must not be uploaded');
assert.match(pagesWorker,/RAW_BRANCH_ROOT='https:\/\/raw\.githubusercontent\.com\/ASTRIX285\/ASTRIX285\.github\.io\/sandbox'/,'Streamed sandbox data must come from the sandbox branch');
assert.match(pagesWorker,/env\.ASSETS\.fetch\(request\)/,'All ordinary sandbox requests must fall through to Pages assets');
assert.match(pagesWorker,/X-Robots-Tag/,'The sandbox must not be indexed');
assert.match(cloudflare,/PROJECT='astrix-paradox-sandbox'/,'Cloudflare project name must remain stable');
assert.match(cloudflare,/DOMAIN='sandbox\.astrixparadox\.com'/,'Cloudflare custom domain must remain stable');
assert.match(authConfig,/APP_ORIGINS = "[^"]*https:\/\/sandbox\.astrixparadox\.com/,'The auth Worker must explicitly allow only the sandbox origin');

console.log('SANDBOX_BRANCH_DEPLOYMENT=PASS');
console.log('SANDBOX_OVERSIZED_DATA_STREAM=PASS');
console.log('SANDBOX_AUTH_ORIGIN=PASS');
