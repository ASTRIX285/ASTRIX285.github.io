import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const FIXTURES_URL=new URL('data/paradox-forge/beta/ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json',ROOT);
const IDENTITIES_URL=new URL('data/paradox-forge/beta/beta-component-identities.json',ROOT);
const MANIFEST_URL=new URL('data/paradox-forge/beta/beta-bungie-manifest-cache.json',ROOT);
const LOADER_URL=new URL('pages/guardian-workspace-v2/guardian-fixture-loader.mjs',ROOT);
const ENGINE_URL=new URL('pages/guardian-workspace-v2/guardian-paradox-engine.mjs',ROOT);

const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const fixtureLibrary=await readJson(FIXTURES_URL);

const directSubclassFixtures=[];
const fallbackFixtures=[];
for(const fixture of fixtureLibrary.fixtures??[]){
  const direct=(fixture.rawDim?.equipped??[]).some(row=>
    fixture.subclassHash!=null&&Number(row.hash)===Number(fixture.subclassHash)
  );
  if(direct)directSubclassFixtures.push(fixture.fixtureId);
  else fallbackFixtures.push(fixture.fixtureId);
}
assert.deepEqual(fallbackFixtures,['PF-BETA-04'],'Only PF-BETA-04 should require subclass fallback');
assert.equal(directSubclassFixtures.length,22,'The other 22 fixtures must retain their normal direct subclass path');

const listeners=new Map();
globalThis.document={
  readyState:'loading',
  addEventListener(type,handler){
    const rows=listeners.get(type)??[];
    rows.push(handler);
    listeners.set(type,rows);
  },
  dispatchEvent(event){
    for(const handler of listeners.get(event.type)??[])handler(event);
    return true;
  },
  getElementById(){return null;},
  querySelector(){return null;}
};
globalThis.CustomEvent=class CustomEvent{
  constructor(type,init={}){this.type=type;this.detail=init.detail;}
};

globalThis.fetch=async url=>{
  const value=String(url);
  let target=null;
  if(value.includes('ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'))target=FIXTURES_URL;
  else if(value.includes('beta-component-identities.json'))target=IDENTITIES_URL;
  else if(value.includes('beta-bungie-manifest-cache.json'))target=MANIFEST_URL;
  if(!target)return {ok:false,status:404,json:async()=>({})};
  const data=await readJson(target);
  return {ok:true,status:200,json:async()=>data};
};

const [{loadBetaFixture},{analyzeGuardianBuild}]=await Promise.all([
  import(LOADER_URL.href),
  import(ENGINE_URL.href)
]);

const detail=await loadBetaFixture('PF-BETA-04');
const aspectRows=detail.aspects.map(row=>({hash:Number(row.hash),name:row.name}));
assert.ok(aspectRows.some(row=>row.hash===4194622037&&row.name==='Tempest Strike'),'Tempest Strike must resolve from PF-BETA-04 socketOverrides');
assert.ok(aspectRows.some(row=>row.hash===4194622036&&row.name==='Flow State'),'Flow State must resolve from PF-BETA-04 socketOverrides');

const analysis=analyzeGuardianBuild(detail);
assert.ok(analysis.buildLoop.length>0,'PF-BETA-04 must produce a non-zero buildLoop after subclass recovery');
assert.ok(
  analysis.buildLoop.some(link=>
    Number(link.from?.hash)===4194622037&&
    link.output==='jolt'&&
    Number(link.to?.hash)===4194622036
  ),
  'Expected Tempest Strike -> jolt -> Flow State link is missing'
);

const all=[];
for(const fixture of fixtureLibrary.fixtures??[]){
  const normalized=await loadBetaFixture(fixture.fixtureId);
  const result=analyzeGuardianBuild(normalized);
  all.push({
    fixtureId:fixture.fixtureId,
    confidence:result.confidence.level,
    buildLoopCount:result.buildLoop.length,
    aspects:normalized.aspects.map(x=>Number(x.hash)),
    fragments:normalized.fragments.map(x=>Number(x.hash))
  });
}

console.log(JSON.stringify({
  fallbackFixtures,
  directSubclassFixtureCount:directSubclassFixtures.length,
  pfBeta04:{
    aspects:aspectRows,
    grenade:detail.grenade?{hash:Number(detail.grenade.hash),name:detail.grenade.name}:null,
    melee:detail.melee?{hash:Number(detail.melee.hash),name:detail.melee.name}:null,
    confidence:analysis.confidence,
    buildLoop:analysis.buildLoop
  },
  fullRegression:all
},null,2));
console.error('PF-BETA-04 subclass fallback regression: PASS');
