import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFile,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {GuardianManifestService} from '../pages/guardian-workspace-v2/guardian-manifest-service.mjs';
import {PAGE_PROFILE_DATA,PAGE_VIEWS,assertPreparedPagePayload} from '../core/page-ready-contract.mjs';

const LIMIT_MS=3000;
const JOURNEY_ROOTS=[1163735237,498211331,616318467,1881970629,2642502414,3741753466,1074663644];
const root=new URL('../',import.meta.url);
const forge=JSON.parse(await readFile(new URL('data/forge-armour-index.json',root),'utf8'));
const journeyDirectory=new URL('data/journey-index/',root);
const journeyFiles=(await readdir(journeyDirectory)).filter(name=>name.endsWith('.json')&&name!=='index.json');
const journeyIndex=JSON.parse(await readFile(new URL('index.json',journeyDirectory),'utf8'));
const sourceTables={};
for(const name of journeyFiles){
  const type=name.replace(/-\d+\.json$/,'');
  const payload=JSON.parse(await readFile(new URL(name,journeyDirectory),'utf8'));
  sourceTables[type]={...(sourceTables[type]||{}),...(payload.definitions||{})};
}

function journeyPublicTables(){
  const wanted={
    DestinyPresentationNodeDefinition:new Set(),
    DestinyRecordDefinition:new Set(),
    DestinyObjectiveDefinition:new Set(),
    DestinyCollectibleDefinition:new Set(),
    DestinyMetricDefinition:new Set(Object.keys(sourceTables.DestinyMetricDefinition||{}))
  };
  const pending=[...JOURNEY_ROOTS];
  while(pending.length){
    const hash=String(pending.pop());
    if(wanted.DestinyPresentationNodeDefinition.has(hash))continue;
    const definition=sourceTables.DestinyPresentationNodeDefinition?.[hash];
    assert.ok(definition,`Missing real Journey root or descendant ${hash}`);
    wanted.DestinyPresentationNodeDefinition.add(hash);
    const children=definition.children||{};
    pending.push(...(children.presentationNodes||[]).map(row=>row.presentationNodeHash).filter(Boolean));
    for(const row of children.records||[])if(row.recordHash)wanted.DestinyRecordDefinition.add(String(row.recordHash));
    for(const row of children.collectibles||[])if(row.collectibleHash)wanted.DestinyCollectibleDefinition.add(String(row.collectibleHash));
    for(const row of children.metrics||[])if(row.metricHash)wanted.DestinyMetricDefinition.add(String(row.metricHash));
    if(definition.completionRecordHash)wanted.DestinyRecordDefinition.add(String(definition.completionRecordHash));
    if(definition.objectiveHash)wanted.DestinyObjectiveDefinition.add(String(definition.objectiveHash));
  }
  for(const hash of wanted.DestinyRecordDefinition){
    const definition=sourceTables.DestinyRecordDefinition?.[hash];
    assert.ok(definition,`Missing real Journey record ${hash}`);
    for(const objective of definition.objectiveHashes||[])wanted.DestinyObjectiveDefinition.add(String(objective));
  }
  for(const hash of wanted.DestinyMetricDefinition){
    const objective=sourceTables.DestinyMetricDefinition?.[hash]?.trackingObjectiveHash;
    if(objective)wanted.DestinyObjectiveDefinition.add(String(objective));
  }
  return Object.fromEntries(Object.entries(wanted).map(([type,hashes])=>[
    type,
    Object.fromEntries([...hashes].map(hash=>[hash,sourceTables[type]?.[hash]]).filter(([,row])=>row))
  ]));
}

function setPath(target,path,value={}){
  const keys=path.split('.');
  let row=target;
  for(const key of keys.slice(0,-1))row=row[key]||(row[key]={});
  row[keys.at(-1)]=value;
}

function preparedProfile(page){
  const profile={};
  for(const path of PAGE_PROFILE_DATA[page])setPath(profile,path,{});
  profile.characters.data={'1':{characterId:'1',classType:0,stats:{}}};
  return profile;
}

const allInventory={...(forge.definitions||{}),...(forge.plugDefinitions||{})};
const inventoryEntries=Object.entries(allInventory);
const inventory=Object.fromEntries(inventoryEntries.slice(0,4000));
const publicJourney=journeyPublicTables();
const destinationHashes=Object.keys(journeyIndex.endgameByDestination||{});
publicJourney.DestinyDestinationDefinition=Object.fromEntries(destinationHashes.map(hash=>[hash,sourceTables.DestinyDestinationDefinition?.[hash]]).filter(([,row])=>row));
const activityHashes=[...new Set(Object.values(journeyIndex.endgameByDestination||{}).flat().map(String))];
publicJourney.DestinyActivityDefinition=Object.fromEntries(activityHashes.map(hash=>[hash,sourceTables.DestinyActivityDefinition?.[hash]]).filter(([,row])=>row));
publicJourney.DestinyInventoryItemDefinition=Object.fromEntries(inventoryEntries.slice(0,1229));

function payloadFor(page){
  const payload={
    profile:preparedProfile(page),
    definitions:inventory,
    statDefinitions:forge.statDefinitions,
    definitionCoverage:{complete:true,requested:Object.keys(inventory).length,resolved:Object.keys(inventory).length,unresolved:[]},
    pageReady:{page,manifestVersion:forge.manifestVersion,views:PAGE_VIEWS[page],coverage:{complete:true,missing:[]}}
  };
  if(page==='character'||page==='build-forge')payload.artifactCatalog=forge.artifactCatalog;
  if(page==='build-forge')payload.currentSeasonNumber=1;
  if(page==='loadout'){
    payload.forgeArmourIndex=forge;
    payload.artifactCatalog=forge.artifactCatalog;
    payload.collectibleDefinitions={'8201':{hash:8201,sourceString:'Verified Bungie acquisition source'}};
    payload.loadoutCoverage={complete:true,collectibleHashes:1,collectibleDefinitions:1,unresolvedCollectibleHashes:[]};
  }
  if(page==='journey')Object.assign(payload,{
    manifestTables:publicJourney,
    journeyIndex,
    journeyCoverage:{complete:true,roots:JOURNEY_ROOTS},
    journeyAccountDefinitionCoverage:{complete:true,unresolved:{}},
    preparedAccountData:{historicalStats:{Response:{}},activityHistoryByCharacter:{'1':{Response:{activities:[]}}},coverage:{complete:true,missing:[]}}
  });
  return payload;
}

async function measure(page){
  const payload=payloadFor(page);
  assertPreparedPagePayload(payload,page);
  const start=performance.now();
  const wire=JSON.stringify(payload);
  const parsed=JSON.parse(wire);
  let networkCalls=0;
  const service=new GuardianManifestService({backend:true,fetchImpl:async()=>{networkCalls+=1;throw new Error('page data must not fetch definitions');}});
  service.seedPayload(parsed);
  const requests=page==='journey'
    ?Object.fromEntries(Object.entries(publicJourney).map(([type,rows])=>[type,Object.keys(rows).map(Number)]))
    :page==='loadout'
      ?{DestinyInventoryItemDefinition:Object.keys(inventory).map(Number),DestinyCollectibleDefinition:Object.keys(parsed.collectibleDefinitions).map(Number)}
      :{DestinyInventoryItemDefinition:Object.keys(inventory).map(Number)};
  for(const [type,hashes] of Object.entries(requests))await service.getMany(type,hashes);
  const elapsed=performance.now()-start;
  assert.equal(networkCalls,0,`${page} triggered a client definition request`);
  assert.ok(elapsed<LIMIT_MS,`${page} prepared data path took ${elapsed.toFixed(2)}ms`);
  console.log(`PAGE_READY_TIMING ${page} ${elapsed.toFixed(2)}ms wire ${Buffer.byteLength(wire)} gzip ${gzipSync(wire).byteLength} limit ${LIMIT_MS}ms`);
}

for(const page of Object.keys(PAGE_VIEWS))await measure(page);

const pageSources=await Promise.all([
  'pages/guardian-workspace-v2/guardian-bungie-profile.mjs',
  'pages/guardian-workspace-v2/paradox-build-space/paradox-build-space.mjs',
  'pages/journey/journey.mjs',
  'pages/vault/vault.mjs',
  'pages/forge-loader/forge-loader-preload.mjs'
].map(async path=>[path,await readFile(new URL(path,root),'utf8')]));
for(const [path,source] of pageSources){
  assert.doesNotMatch(source,/bungie\/manifest\/definitions?/,`${path} contains a client definition route`);
  if(path.includes('/journey/'))assert.doesNotMatch(source,/\/bungie\/(?:historical-stats|activity-history|current-season)/,`${path} contains a Journey follow up read`);
  if(path.includes('/paradox-build-space/'))assert.doesNotMatch(source,/\/bungie\/(?:page\/build-forge|current-season)/,`${path} contains a Build Forge follow up read`);
}
const backend=await readFile(new URL('../forge-auth-worker/src/index.ts',root),'utf8');
for(const page of Object.keys(PAGE_VIEWS))assert.match(backend,new RegExp(`\\b${page.replace('-','\\-')}\\b`));
assert.match(backend,/preparedJourneyAccountData[\s\S]*?historical-stats[\s\S]*?activity-history/,'Journey route must merge cached career and activity data');
const cache=await readFile(new URL('pages/guardian-workspace-v2/guardian-session-cache.mjs',root),'utf8');
assert.match(cache,/profile:v3:\$\{identity\}:\$\{pageKind\(page\)\}/,'Prepared payload cache must be isolated by page');
const builder=await readFile(new URL('tools/build-backend-manifest.py',root),'utf8');
for(const hash of JOURNEY_ROOTS)assert.match(builder,new RegExp(String(hash)),`Backend Journey bundle is missing real root ${hash}`);
assert.match(builder,/DestinyInventoryItemDefinition[\s\S]*?DestinyGuardianRankDefinition[\s\S]*?DestinyGuardianRankConstantsDefinition/,'Journey bundle must include collection item and Guardian Rank definitions');
assert.match(builder,/loadout_collectible_hashes[\s\S]*?loadout_collectibles[\s\S]*?loadout_coverage/,'Loadout bundle must carry every Bungie acquisition source required by a local interaction');
assert.match(backend,/payload\.collectibleDefinitions = pageBundle\.collectibleDefinitions/,'Loadout route must merge prepared Bungie acquisition sources into its page payload');

const profileRuntime=pageSources.find(([path])=>path.includes('guardian-bungie-profile'))?.[1]||'';
assert.match(profileRuntime,/const PROFILE_RUNTIME_ENABLED=location\.pathname\.includes\('\/pages\/guardian-workspace-v2\/'\)/,'Character runtime side effects must be limited to Character and Build Forge routes');
assert.match(profileRuntime,/if\(PROFILE_RUNTIME_ENABLED\)\{[\s\S]*?getBungieSession\(\)\.then\(handleAuthenticatedSession\)/,'Forge Loader must be able to import the profile normalizer without triggering a Character page request');

console.log('PAGE_READY_DEDICATED_ROUTES=PASS');
console.log('PAGE_READY_COMPLETE_CONTRACTS=PASS');
console.log('PAGE_READY_ZERO_CLIENT_FOLLOW_UP_READS=PASS');
