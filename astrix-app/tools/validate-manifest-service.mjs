import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');
const [service,sessionCache,profile,portal,build,interceptor,resolver,fixture,artifact,beta,recommender,worker,wrapper]=await Promise.all([
  read('pages/guardian-workspace-v2/guardian-manifest-service.mjs'),
  read('pages/guardian-workspace-v2/guardian-session-cache.mjs'),
  read('pages/guardian-workspace-v2/guardian-bungie-profile.mjs'),
  read('pages/guardian-workspace-v2/guardian-portal-progress.mjs'),
  read('pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs'),
  read('pages/guardian-workspace-v2/guardian-semantic-interceptor.mjs'),
  read('pages/guardian-workspace-v2/guardian-semantic-resolver.mjs'),
  read('pages/guardian-workspace-v2/guardian-fixture-loader.mjs'),
  read('pages/guardian-workspace-v2/guardian-artifact.mjs'),
  read('pages/guardian-workspace-v2/guardian-beta-selection.mjs'),
  read('pages/guardian-workspace-v2/guardian-artifact-recommender.mjs'),
  read('../astrix-auth-worker/src/index.ts'),
  read('../astrix-auth-worker/src/semantic-wrapper.ts')
]);

for(const type of ['DestinyInventoryItemDefinition','DestinySandboxPerkDefinition','DestinyArtifactDefinition','DestinyStatDefinition','DestinySocketCategoryDefinition']){
  assert.match(service,new RegExp(`"${type}"`),`${type} is missing from the browser manifest service`);
  assert.match(worker,new RegExp(`"${type}"`),`${type} is missing from the Worker allowlist`);
}
assert.match(sessionCache,/DB_VERSION=2/,'Manifest store requires the IndexedDB schema upgrade');
assert.match(sessionCache,/MANIFEST_STORE_NAME="manifest-data"/,'Manifest data must use a store beside the Guardian session cache');
assert.match(service,/manifest:\$\{version\}:\$\{type\}/,'Manifest tables must be keyed by version and component type');
assert.match(service,/current\?\.version===version[\s\S]*?readTable\(version,type\)/,'Matching versions must load all component tables from IndexedDB');
assert.match(service,/versionMatched=true[\s\S]*?loaded from IndexedDB/,'Version-match skips must be observable');
assert.match(service,/commitVersion\(version\)[\s\S]*?removeOtherVersions\(version\)/,'The current marker must commit only after all component writes');
assert.match(service,/mode="live-fallback"[\s\S]*?IndexedDB unavailable · resolving definitions live/,'IndexedDB failure must select the live endpoint fallback');
assert.match(service,/bungie\/manifest\/definition/,'Fallback definitions must use the Worker single-definition route');

assert.match(worker,/Destiny2\/Manifest\//,'Worker must call GetDestinyManifest with the Bungie API key');
assert.match(worker,/jsonWorldComponentContentPaths\?\.en/,'Worker must use English JSON world component paths');
assert.match(worker,/new Response\(upstream\.body/,'Large manifest components must stream through the Worker without buffering');
assert.doesNotMatch(worker,/manifestComponentRoute[\s\S]{0,2600}upstream\.json/,'Manifest component proxy must not buffer the table as JSON');
assert.match(worker,/manifest_version_changed/,'Component downloads must reject a stale requested version');
assert.match(worker,/definitions"\) === "client-manifest"/,'Profile and loadout routes must expose raw client-manifest mode');
assert.match(wrapper,/definitions"\) === "client-manifest"/,'Semantic wrapper must skip per-hash enrichment in client-manifest mode');

assert.match(profile,/guardianManifest\.hydratePayload/,'Profile and loadout payloads must hydrate from the manifest service');
assert.match(profile,/definitions","client-manifest"/,'IndexedDB mode must demote Worker per-hash enrichment');
assert.match(profile,/Unresolved Destiny item \$\{hash\}/,'Missing item hashes must have a labelled placeholder');
assert.match(profile,/payload\?\.statDefinitions/,'Stat names and icons must resolve from DestinyStatDefinition');
assert.match(profile,/socketCategoryDefinitions/,'Socket-category evidence must reach equipped plug resolution');
assert.match(interceptor,/socketCategoryHash[\s\S]*?socketCategoryDefinition/,'Alternative weapon columns must retain socket-category evidence');
assert.match(resolver,/socketCategory\(plug\)[\s\S]*?weapon-mod[\s\S]*?perk/,'Weapon perk-versus-mod classification must consult the socket category first');
assert.match(portal,/astrix:manifest-progress/,'Main portal loader must show manifest progress');
assert.match(portal,/await manifestReady/,'Main portal must not clear before the manifest is ready');
const buildRenderCompletion=build.match(/function completeBuildRender\(build\)\{([\s\S]*?)\}\nconst list=/)?.[1]||'';
assert.match(buildRenderCompletion,/astrix:build-render-complete/,'Build Forge must publish its real render-complete signal');
assert.doesNotMatch(buildRenderCompletion,/guardianManifest\.ready/,'Build Forge render completion must not be gated behind a manifest fetch');
assert.match(portal,/astrix:build-render-complete',\(\)=>finishRenderedPage/,'Build portal must release from the real render-complete signal');

for(const [label,source] of [['fixture',fixture],['artifact',artifact],['beta selector',beta]]){
  assert.match(source,/guardianManifest/ ,`${label} must resolve display definitions through the full manifest service`);
  assert.doesNotMatch(source,/inventoryItems\?\.\[String\(hash\)\][\s\S]{0,300}\.display/,`${label} must not use curated inventory display data`);
}
assert.match(fixture,/function curatedSemantics/,'Fixture identities must retain the curated tags layer');
assert.match(fixture,/directionEvidence/,'Curated official descriptions must remain available as reasoning evidence');
assert.match(recommender,/curatedTags\?\.inventoryItems/,'Artifact reasoning must retain curated weapon tags');
assert.match(recommender,/definition\.displayProperties\?\.name/,'Artifact reasoning display identity must come from full definitions');
assert.doesNotMatch(recommender,/row\.display/,'Artifact reasoning must not use curated display identity');

console.log('MANIFEST_VERSION_CACHE_CONTRACT=PASS');
console.log('MANIFEST_WORKER_STREAM_CONTRACT=PASS');
console.log('MANIFEST_PROFILE_ARTIFACT_RESOLUTION=PASS');
console.log('MANIFEST_CURATED_TAGS_ONLY=PASS');
console.log('MANIFEST_LOADER_AND_FALLBACK=PASS');
