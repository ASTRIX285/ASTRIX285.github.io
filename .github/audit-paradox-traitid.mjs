import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url);
const FIXTURES_URL=new URL('astrix-app/data/paradox-forge/beta/ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json',ROOT);
const IDENTITIES_URL=new URL('astrix-app/data/paradox-forge/beta/beta-component-identities.json',ROOT);
const MANIFEST_URL=new URL('astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache.json',ROOT);
const TRAIT_DIRECTION_URL=new URL('astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache-trait-direction-extension.json',ROOT);
const LOADER_URL=new URL('astrix-app/pages/guardian-workspace-v2/guardian-fixture-loader.mjs',ROOT);
const CURRENT_ENGINE_URL=new URL('astrix-app/pages/guardian-workspace-v2/guardian-paradox-engine.mjs',ROOT);
const BASELINE_ENGINE_URL=new URL('astrix-app/tools/_baseline-no-trait-engine.mjs',ROOT);
const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const fixtureLibrary=await readJson(FIXTURES_URL);

const listeners=new Map();
globalThis.document={readyState:'loading',addEventListener(type,handler){const rows=listeners.get(type)??[];rows.push(handler);listeners.set(type,rows);},dispatchEvent(event){for(const handler of listeners.get(event.type)??[])handler(event);return true;},getElementById(){return null;},querySelector(){return null;}};
globalThis.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}};
globalThis.fetch=async url=>{const value=String(url);let target=null;if(value.includes('ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'))target=FIXTURES_URL;else if(value.includes('beta-component-identities.json'))target=IDENTITIES_URL;else if(value.includes('beta-bungie-manifest-cache-trait-direction-extension.json'))target=TRAIT_DIRECTION_URL;else if(value.includes('beta-bungie-manifest-cache.json'))target=MANIFEST_URL;if(!target)return {ok:false,status:404,json:async()=>({})};const data=await readJson(target);return {ok:true,status:200,json:async()=>data};};

const [{loadBetaFixture},current,baseline]=await Promise.all([import(LOADER_URL.href),import(CURRENT_ENGINE_URL.href),import(BASELINE_ENGINE_URL.href)]);
const key=l=>`${Number(l.from?.hash)}|${l.output}|${Number(l.to?.hash)}`;
const reverseKey=l=>`${Number(l.to?.hash)}|${l.output}|${Number(l.from?.hash)}`;
const distribution=()=>({high:0,medium:0,insufficient:0,low:0,totalLinks:0});
const baseDist=distribution(),currentDist=distribution();
const rows=[];
const newlySymmetric=[];
const duplicateCurrent=[];
for(const fixture of fixtureLibrary.fixtures??[]){
  const detail=await loadBetaFixture(fixture.fixtureId);
  const b=baseline.analyzeGuardianBuild(detail);
  const c=current.analyzeGuardianBuild(detail);
  baseDist[b.confidence.level]++;baseDist.totalLinks+=b.buildLoop.length;
  currentDist[c.confidence.level]++;currentDist.totalLinks+=c.buildLoop.length;
  const bkeys=new Set(b.buildLoop.map(key));
  const ckeys=new Set(c.buildLoop.map(key));
  const added=c.buildLoop.filter(x=>!bkeys.has(key(x)));
  const counts=new Map();
  for(const l of c.buildLoop)counts.set(key(l),(counts.get(key(l))??0)+1);
  for(const [k,count] of counts)if(count>1)duplicateCurrent.push({fixtureId:fixture.fixtureId,key:k,count});
  for(const l of added){if(ckeys.has(reverseKey(l)))newlySymmetric.push({fixtureId:fixture.fixtureId,added:l.chain,source:l.source,reverse:reverseKey(l),reverseWasBaseline:bkeys.has(reverseKey(l))});}
  rows.push({fixtureId:fixture.fixtureId,baseline:{confidence:b.confidence.level,count:b.buildLoop.length},current:{confidence:c.confidence.level,count:c.buildLoop.length},addedLinks:added.map(x=>({chain:x.chain,source:x.source,evidence:x.evidence})),traitLinks:c.buildLoop.filter(x=>String(x.source).includes('runtime-traitid-parsing')).map(x=>({chain:x.chain,source:x.source,evidence:x.evidence})),candidates:c.candidateRelationships??[]});
}
const pf04=rows.find(x=>x.fixtureId==='PF-BETA-04');
const detail04=await loadBetaFixture('PF-BETA-04');
const a04=current.analyzeGuardianBuild(detail04);
const forward=a04.buildLoop.find(x=>Number(x.from?.hash)===4194622037&&x.output==='jolt'&&Number(x.to?.hash)===4194622036);
const reverse=a04.buildLoop.find(x=>Number(x.from?.hash)===4194622036&&x.output==='jolt'&&Number(x.to?.hash)===4194622037);
assert.ok(forward,'PF-BETA-04 forward link missing');
assert.equal(reverse,undefined,'PF-BETA-04 reverse link must be absent');
console.log(JSON.stringify({baselineDistribution:baseDist,currentDistribution:currentDist,pfBeta04:{baseline:pf04.baseline,current:pf04.current,forward,reverse:reverse??null},newlySymmetric,duplicateCurrent,rows},null,2));
