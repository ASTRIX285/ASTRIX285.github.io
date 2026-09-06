import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFile,readdir} from 'node:fs/promises';
import {GuardianManifestService} from '../pages/guardian-workspace-v2/guardian-manifest-service.mjs';

const LIMIT_MS=3000;
const root=new URL('../',import.meta.url);
const forge=JSON.parse(await readFile(new URL('data/forge-armour-index.json',root),'utf8'));
const journeyDirectory=new URL('data/journey-index/',root);
const journeyFiles=(await readdir(journeyDirectory)).filter(name=>name.endsWith('.json')&&name!=='index.json');
const journeyIndex=JSON.parse(await readFile(new URL('index.json',journeyDirectory),'utf8'));
const journeyTables={};
for(const name of journeyFiles){
  const type=name.replace(/-\d+\.json$/,'');
  const payload=JSON.parse(await readFile(new URL(name,journeyDirectory),'utf8'));
  journeyTables[type]={...(journeyTables[type]||{}),...(payload.definitions||{})};
}

const inventory={...(forge.definitions||{}),...(forge.plugDefinitions||{})};
const shared={
  definitions:inventory,
  sandboxPerks:forge.sandboxPerks||{},
  statDefinitions:forge.statDefinitions||{},
  socketCategoryDefinitions:forge.socketCategoryDefinitions||{},
  equipableItemSets:forge.equipableItemSets||{},
  artifactCatalog:forge.artifactCatalog||{}
};

async function measure(page,payload,requests){
  const start=performance.now();
  const wire=JSON.stringify({...payload,pageReady:{page,manifestVersion:forge.manifestVersion}});
  const parsed=JSON.parse(wire);
  let networkCalls=0;
  const service=new GuardianManifestService({backend:true,fetchImpl:async()=>{networkCalls+=1;throw new Error('page data must not fetch definitions');}});
  service.seedPayload(parsed);
  for(const [type,hashes] of Object.entries(requests))await service.getMany(type,hashes);
  const elapsed=performance.now()-start;
  assert.equal(networkCalls,0,`${page} triggered a client definition request`);
  assert.ok(elapsed<LIMIT_MS,`${page} prepared data path took ${elapsed.toFixed(2)}ms`);
  console.log(`PAGE_READY_TIMING ${page} ${elapsed.toFixed(2)}ms limit ${LIMIT_MS}ms`);
}

const inventoryHashes=Object.keys(inventory).map(Number);
await measure('character',shared,{DestinyInventoryItemDefinition:inventoryHashes.slice(0,400)});
await measure('build-forge',shared,{DestinyInventoryItemDefinition:inventoryHashes});
await measure('journey',{...shared,journeyIndex,manifestTables:journeyTables},Object.fromEntries(Object.entries(journeyTables).map(([type,rows])=>[type,Object.keys(rows).map(Number)])));
await measure('vault',shared,{DestinyInventoryItemDefinition:inventoryHashes});
await measure('loadout',{...shared,forgeArmourIndex:forge},{DestinyInventoryItemDefinition:inventoryHashes});

const sources=await Promise.all([
  'pages/guardian-workspace-v2/guardian-bungie-profile.mjs',
  'pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs',
  'pages/journey/journey.mjs',
  'pages/vault/vault.mjs',
  'pages/forge-loader/forge-loader.mjs',
  'shared/astrix-hero-cards.mjs'
].map(async path=>[path,await readFile(new URL(path,root),'utf8')]));
for(const [path,source] of sources)assert.doesNotMatch(source,/bungie\/manifest\/definitions?/,`${path} contains a client definition route`);
const backend=await readFile(new URL('../forge-auth-worker/src/index.ts',root),'utf8');
for(const page of ['character','build-forge','journey','vault','loadout'])assert.match(backend,new RegExp(`\\b${page.replace('-','\\-')}\\b`));
console.log('PAGE_READY_DEDICATED_ROUTES=PASS');
console.log('PAGE_READY_ZERO_CLIENT_DEFINITION_FETCHES=PASS');
