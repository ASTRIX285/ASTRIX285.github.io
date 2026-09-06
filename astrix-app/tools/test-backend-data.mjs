import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ProfileSnapshotCache,DISPLAY_TTL_MS} from '../../astrix-auth-worker/src/profile-snapshot-cache.ts';
import {profileSections} from '../../astrix-auth-worker/src/profile-sections.ts';
import {fetchDisplayProfile} from '../pages/guardian-workspace-v2/guardian-display-profile.mjs';
import dataWorker from '../../astrix-manifest-worker/worker.mjs';
import {GuardianManifestService} from '../pages/guardian-workspace-v2/guardian-manifest-service.mjs';

function storage(){
  const rows=new Map();
  return {rows,async get(key){return Array.isArray(key)?new Map(key.filter(k=>rows.has(k)).map(k=>[k,rows.get(k)])):rows.get(key);},async put(key,value){assert.ok(Buffer.byteLength(JSON.stringify(value))<128*1024);rows.set(key,value);},async delete(key){return rows.delete(key);}};
}
const disk=storage(),cache=new ProfileSnapshotCache(disk);
let calls=0;
const body=JSON.stringify({Response:{inventory:'🛡'.repeat(50_000)}});
const load=async()=>{calls++;return body;};
const results=await Promise.all([cache.read('account:character',load),cache.read('account:character',load)]);
assert.equal(calls,1);assert.equal(results[0].body,body);
const persisted=await new ProfileSnapshotCache(disk).read('account:character',load);
assert.equal(persisted.body,body);assert.equal(persisted.source,'snapshot');assert.equal(calls,1);
await cache.read('account:journey',load);assert.equal(calls,2);
await new ProfileSnapshotCache(storage()).read('account:character',load);assert.equal(calls,3);
await assert.rejects(()=>cache.read('account:character',async()=>{throw Error('Bungie unavailable');},Date.now()+DISPLAY_TTL_MS+1),/Bungie unavailable/);

const index={manifestVersion:'verified-test-version',tables:{DestinyInventoryItemDefinition:{shards:2}}};
let assets=0;
const env={ASSETS:{async fetch(request){assets++;const path=new URL(request.url).pathname;return Response.json(path==='/index.json'?index:path.endsWith('/1.json')?{'1':{hash:1},'3':{hash:3}}:{'2':{hash:2}});}}};
const route='https://data/definitions?type=DestinyInventoryItemDefinition&version=verified-test-version&hashes=';
let response=await dataWorker.fetch(new Request(route+'1,2,3'),env);
assert.deepEqual(Object.keys((await response.json()).definitions),['1','2','3']);assert.equal(assets,3);
assert.equal((await dataWorker.fetch(new Request(route+'0'),env)).status,400);
assert.equal((await dataWorker.fetch(new Request(route.replace('verified-test-version','old')+'1'),env)).status,409);
response=await dataWorker.fetch(new Request('https://data/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:index.manifestVersion,requests:{DestinyInventoryItemDefinition:[1,2,3]}})}),env);
assert.deepEqual(Object.keys((await response.json()).tables.DestinyInventoryItemDefinition),['1','2','3']);

const requests=[];
const service=new GuardianManifestService({backend:true,maxFallbackDefinitions:3,maxDefinitionBytes:1024,storage:{available:true,readCurrent(){throw Error('must not load full tables');}},fetchImpl:async input=>{
  const url=new URL(input);requests.push(url.pathname);throw Error(`unexpected client definition request ${url.pathname}`);
}});
const hashes=Array.from({length:100},(_,i)=>i+1);
service.seedPayload({pageReady:{page:'character',manifestVersion:index.manifestVersion},definitions:Object.fromEntries(hashes.map(hash=>[hash,{hash}]))});
const [a,b]=await Promise.all([service.getMany('DestinyInventoryItemDefinition',hashes),service.getMany('DestinyInventoryItemDefinition',hashes)]);
assert.equal(Object.keys(a).length,100);assert.deepEqual(a,b);
assert.equal(requests.length,0);
const live=await readFile(new URL('../pages/guardian-workspace-v2/guardian-live-actions.mjs',import.meta.url),'utf8');
assert.doesNotMatch(live,/freshness.*display|profile-snapshot/,'Apply must never use display snapshots');
const original={characters:{data:{test:{classType:1}}},profileInventory:{data:{items:[{itemInstanceId:'test-owned-instance'}]}}};
const first=await profileSections(original,'test-account');
const unchanged=await profileSections(original,'test-account',first.revisions);
assert.deepEqual(unchanged.changed,{});
const next={...original,profileInventory:{data:{items:[]}}};
assert.deepEqual(Object.keys((await profileSections(next,'test-account',first.revisions)).changed),['profileInventory']);
assert.deepEqual(Object.keys((await profileSections(original,'different-account',first.revisions)).changed),Object.keys(original));
let round=0;
const transport=async()=>Response.json({authenticated:true,membership:{membershipType:1,membershipId:'test-account'},profileSections:round++?unchanged:first});
const one=await fetchDisplayProfile('https://test/bungie/profile?scope=journey',{fetchImpl:transport});
const two=await fetchDisplayProfile('https://test/bungie/profile?scope=journey',{fetchImpl:transport});
assert.deepEqual(two.profile,original);assert.equal(two.profile.characters,one.profile.characters);
assert.deepEqual(two.changedSections,[]);
console.log('BACKEND_SECTION_REVISIONS_AND_CLIENT_REUSE=PASS');
console.log('BACKEND_SNAPSHOT_ISOLATION_FRESHNESS_COALESCING=PASS');
console.log('BACKEND_MANIFEST_BATCH_VERSION_AND_MEMORY_BOUNDS=PASS');
console.log('BACKEND_APPLY_CACHE_BYPASS=PASS');
