import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url);
const F=new URL('astrix-app/data/paradox-forge/beta/ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json',ROOT);
const I=new URL('astrix-app/data/paradox-forge/beta/beta-component-identities.json',ROOT);
const M=new URL('astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache.json',ROOT);
const D=new URL('astrix-app/data/paradox-forge/beta/beta-bungie-manifest-cache-trait-direction-extension.json',ROOT);
const L=new URL('astrix-app/pages/guardian-workspace-v2/guardian-fixture-loader.mjs',ROOT);
const C=new URL('astrix-app/pages/guardian-workspace-v2/guardian-paradox-engine.mjs',ROOT);
const B=new URL('astrix-app/tools/_baseline-no-trait-engine.mjs',ROOT);
const readJson=async u=>JSON.parse(await readFile(u,'utf8'));
const fixtures=await readJson(F);
const listeners=new Map();
globalThis.document={readyState:'loading',addEventListener(t,h){const a=listeners.get(t)??[];a.push(h);listeners.set(t,a);},dispatchEvent(e){for(const h of listeners.get(e.type)??[])h(e);return true;},getElementById(){return null;},querySelector(){return null;}};
globalThis.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}};
globalThis.fetch=async url=>{const s=String(url);let t=null;if(s.includes('ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json'))t=F;else if(s.includes('beta-component-identities.json'))t=I;else if(s.includes('beta-bungie-manifest-cache-trait-direction-extension.json'))t=D;else if(s.includes('beta-bungie-manifest-cache.json'))t=M;if(!t)return {ok:false,status:404,json:async()=>({})};return {ok:true,status:200,json:async()=>readJson(t)};};
const [{loadBetaFixture},cur,base]=await Promise.all([import(L.href),import(C.href),import(B.href)]);
const key=l=>`${Number(l.from?.hash)}|${l.output}|${Number(l.to?.hash)}`;
const rev=l=>`${Number(l.to?.hash)}|${l.output}|${Number(l.from?.hash)}`;
const dist=()=>({high:0,medium:0,insufficient:0,low:0,totalLinks:0});
const before=dist(),after=dist();
const added=[];const removed=[];const newlySymmetric=[];const newDuplicates=[];const rows=[];
for(const f of fixtures.fixtures??[]){
 const d=await loadBetaFixture(f.fixtureId);const b=base.analyzeGuardianBuild(d);const c=cur.analyzeGuardianBuild(d);
 before[b.confidence.level]++;before.totalLinks+=b.buildLoop.length;after[c.confidence.level]++;after.totalLinks+=c.buildLoop.length;
 const bk=new Set(b.buildLoop.map(key));const ck=new Set(c.buildLoop.map(key));
 const addedHere=c.buildLoop.filter(l=>!bk.has(key(l)));
 const removedHere=b.buildLoop.filter(l=>!ck.has(key(l)));
 for(const l of addedHere){const row={fixtureId:f.fixtureId,chain:l.chain,source:l.source,evidence:l.evidence};added.push(row);if(ck.has(rev(l)))newlySymmetric.push({...row,reverse:rev(l),reverseWasBaseline:bk.has(rev(l))});}
 for(const l of removedHere)removed.push({fixtureId:f.fixtureId,chain:l.chain,source:l.source,evidence:l.evidence});
 const counts=new Map();for(const l of c.buildLoop)counts.set(key(l),(counts.get(key(l))??0)+1);for(const [k,n] of counts)if(n>1&&!b.buildLoop.some(x=>key(x)===k))newDuplicates.push({fixtureId:f.fixtureId,key:k,count:n});
 rows.push({fixtureId:f.fixtureId,before:{confidence:b.confidence.level,count:b.buildLoop.length},after:{confidence:c.confidence.level,count:c.buildLoop.length},added:addedHere.map(l=>({chain:l.chain,source:l.source})),removed:removedHere.map(l=>({chain:l.chain,source:l.source})),traitLinks:c.buildLoop.filter(l=>String(l.source).includes('runtime-traitid-parsing')).map(l=>({chain:l.chain,source:l.source,evidence:l.evidence})),candidates:c.candidateRelationships??[]});
}
const d4=await loadBetaFixture('PF-BETA-04');const a4=cur.analyzeGuardianBuild(d4);const forward=a4.buildLoop.find(l=>Number(l.from?.hash)===4194622037&&l.output==='jolt'&&Number(l.to?.hash)===4194622036);const reverse=a4.buildLoop.find(l=>Number(l.from?.hash)===4194622036&&l.output==='jolt'&&Number(l.to?.hash)===4194622037);
assert.ok(forward);assert.equal(reverse,undefined);assert.ok(String(forward.source).includes('runtime-traitid-parsing'));
console.log(JSON.stringify({before,after,delta:{high:after.high-before.high,medium:after.medium-before.medium,insufficient:after.insufficient-before.insufficient,low:after.low-before.low,totalLinks:after.totalLinks-before.totalLinks},pfBeta04:{forward,reverse:reverse??null,confidence:a4.confidence,buildLoop:a4.buildLoop,candidates:a4.candidateRelationships??[]},added,removed,newlySymmetric,newDuplicates,rows},null,2));
assert.deepEqual(removed,[],'TraitIds removed an existing description/curated buildLoop relationship');
assert.deepEqual(newlySymmetric,[],'TraitIds introduced a new symmetric/backwards relationship');
assert.deepEqual(newDuplicates,[],'TraitIds introduced a new duplicate relationship');
