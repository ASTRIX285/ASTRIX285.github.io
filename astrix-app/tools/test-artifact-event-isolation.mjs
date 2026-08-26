import assert from 'node:assert/strict';

class MemoryStore{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}

globalThis.sessionStorage=new MemoryStore();
globalThis.localStorage=new MemoryStore();
globalThis.document={addEventListener(){}};
globalThis.location={href:''};

const {rememberGuardian,rememberExplicitLoadout,rememberArtifactSelection,resolveBuildSource,LAST_LOADOUT_KEY}=await import('../pages/guardian-workspace-v2/paradox-build-space-handoff.mjs');

const warlock={characterId:'warlock-1',characterClass:'Warlock',selectedLoadoutIndex:2,artifact:{hash:8001,activePerks:[{hash:101}]},artifactConfiguration:{selectedPerkHashes:[101]}};
rememberGuardian(warlock);
rememberExplicitLoadout(warlock);

const titan={characterId:'titan-1',characterClass:'Titan',selectedLoadoutIndex:null,artifact:{hash:9001,activePerks:[{hash:201}]},artifactConfiguration:{selectedPerkHashes:[201]}};
rememberGuardian(titan);
rememberArtifactSelection({characterId:'titan-1',selectedLoadoutIndex:null,artifact:{hash:9001},artifactConfiguration:{selectedPerkHashes:[202]},perks:[{hash:202}],state:'intended'});
assert.deepEqual(resolveBuildSource().artifactConfiguration.selectedPerkHashes,[202]);

const cachedWarlockEnvelope=JSON.parse(localStorage.getItem(LAST_LOADOUT_KEY));
assert.equal(cachedWarlockEnvelope.schemaVersion,2,'durable Artifact state must use the character-bound handoff envelope');
assert.equal(cachedWarlockEnvelope.binding.characterId,'warlock-1');
const cachedWarlock=cachedWarlockEnvelope.payload;
assert.deepEqual(cachedWarlock.artifactConfiguration.selectedPerkHashes,[101],'Titan Artifact events must not contaminate the cached Warlock loadout');

rememberArtifactSelection({characterId:'warlock-1',selectedLoadoutIndex:2,artifact:{hash:8001},artifactConfiguration:{selectedPerkHashes:[102]},perks:[{hash:102}],state:'intended'});
const updatedWarlockEnvelope=JSON.parse(localStorage.getItem(LAST_LOADOUT_KEY));
assert.deepEqual(updatedWarlockEnvelope.payload.artifactConfiguration.selectedPerkHashes,[101],'inactive loadout Artifact events must not mutate the persisted cached snapshot');
assert.deepEqual(resolveBuildSource().artifactConfiguration.selectedPerkHashes,[202],'Warlock loadout events must not contaminate the active Titan');

rememberArtifactSelection({characterId:'titan-1',selectedLoadoutIndex:null,state:'state-unavailable',artifact:{hash:9001,state:'state-unavailable',activePerks:null},artifactConfiguration:{artifactHash:9001,selectedPerkHashes:null,source:'bungie-live-state-unavailable'},perks:null});
const unavailable=resolveBuildSource();
assert.equal(unavailable.artifact.activePerks,null,'unavailable component-202 evidence must not become an empty active-perk list');
assert.equal(unavailable.artifactConfiguration.selectedPerkHashes,null);

console.log('Artifact event isolation tests passed.');
