import assert from 'node:assert/strict';
import {validateHandoffEnvelope} from '../pages/guardian-workspace-v2/paradox-build-binding.mjs';

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

const {
  rememberGuardian,
  rememberExplicitLoadout,
  rememberWeaponAdvice,
  rememberArtifactSelection,
  resolveBuildSource,
  LAST_LOADOUT_KEY
}=await import('../pages/guardian-workspace-v2/paradox-build-space-handoff.mjs');

const intendedWarlockArtifactConfiguration={
  schemaVersion:1,
  artifactHash:8001,
  seasonNumber:29,
  selectedPerkHashes:[101],
  source:'saved-build-intent',
  provenance:{provider:'bungie-manifest',manifestHash:8001,component:202}
};
const warlockLoadout={characterId:'warlock-1',membershipId:'membership-1',membershipType:'3',characterClass:'Warlock',selectedLoadoutIndex:2,weapons:[{itemInstanceId:'warlock-weapon'}],artifactConfiguration:intendedWarlockArtifactConfiguration};
rememberGuardian(warlockLoadout);
rememberExplicitLoadout(warlockLoadout);
assert.equal(resolveBuildSource().selectedLoadoutIndex,2,'selected loadout is preferred while its Guardian remains active');

const titanEquipped={characterId:'titan-1',membershipId:'membership-1',membershipType:'3',characterClass:'Titan',selectedLoadoutIndex:null,weapons:[{itemInstanceId:'titan-weapon'}],artifactConfiguration:{selectedPerkHashes:[201]}};
rememberGuardian(titanEquipped);
assert.equal(resolveBuildSource().characterId,'titan-1','switching Guardian rejects a stale loadout from another character');
assert.equal(resolveBuildSource().selectedLoadoutIndex,null,'current equipped Guardian remains the source after the switch');

rememberArtifactSelection({characterId:'titan-1',selectedLoadoutIndex:null,artifact:{hash:9001},artifactConfiguration:{selectedPerkHashes:[202]},perks:[{hash:202}]});
rememberWeaponAdvice({characterId:'titan-1',selectedLoadoutIndex:null,recommendations:[{itemInstanceId:'titan-weapon',verdict:'keep'}]});
const titanSource=resolveBuildSource();
assert.deepEqual(titanSource.artifactConfiguration.selectedPerkHashes,[202]);
assert.equal(titanSource.weapons[0].weaponRollAdvice.verdict,'keep');

rememberArtifactSelection({
  characterId:'titan-1',
  selectedLoadoutIndex:null,
  state:'state-unavailable',
  artifact:{hash:9001,state:'state-unavailable',activePerks:null,perks:null},
  artifactConfiguration:{
    schemaVersion:1,
    artifactHash:9001,
    seasonNumber:29,
    selectedPerkHashes:null,
    source:'bungie-live-state-unavailable',
    provenance:{provider:'bungie',component:202,state:'state-unavailable'}
  },
  perks:null
});
const unavailableTitanSource=resolveBuildSource();
assert.equal(unavailableTitanSource.artifact.state,'state-unavailable');
assert.equal(unavailableTitanSource.artifact.activePerks,null,'unavailable component-202 evidence must not become an empty active-perk list');
assert.equal(unavailableTitanSource.artifactConfiguration.selectedPerkHashes,null,'unavailable live selection remains distinct from explicit empty intent');

const persistedWarlockEnvelope=JSON.parse(localStorage.getItem(LAST_LOADOUT_KEY));
assert.equal(persistedWarlockEnvelope.schemaVersion,2,'durable loadouts use the versioned handoff envelope');
assert.equal(persistedWarlockEnvelope.binding.characterId,'warlock-1','durable envelope remains bound to the saved Guardian');
assert.equal(persistedWarlockEnvelope.binding.membershipId,'membership-1','durable envelope remains bound to the Bungie membership');
assert.equal(persistedWarlockEnvelope.binding.membershipType,'3','durable envelope retains the Bungie membership type');
assert.equal(validateHandoffEnvelope(persistedWarlockEnvelope,{expectedCharacterId:'warlock-1',expectedMembershipId:'membership-1',expectedMembershipType:'3'})?.characterId,'warlock-1','exact Guardian and platform binding is accepted');
for(const [field,value] of [['characterId','titan-1'],['membershipId','membership-2'],['membershipType','2']]){
  const tampered=structuredClone(persistedWarlockEnvelope);
  tampered.binding[field]=value;
  assert.equal(validateHandoffEnvelope(tampered),null,`tampered ${field} binding must be rejected`);
}
assert.equal(validateHandoffEnvelope(persistedWarlockEnvelope,{expectedMembershipType:'2'}),null,'a different requested Bungie platform must not reuse the cached loadout');
const expired=structuredClone(persistedWarlockEnvelope);
expired.savedAt=Date.now()-(31*60*1000);
assert.equal(validateHandoffEnvelope(expired),null,'expired durable handoffs must remain unavailable');
const persistedWarlock=persistedWarlockEnvelope.payload;
assert.deepEqual(persistedWarlock.artifactConfiguration,intendedWarlockArtifactConfiguration,'saved Artifact intent must retain its exact hash, season, perks, source and provenance through JSON storage');
assert.notEqual(persistedWarlock.artifactConfiguration,intendedWarlockArtifactConfiguration,'persisted Artifact intent must be a detached JSON snapshot');
assert.deepEqual(persistedWarlock.artifactConfiguration.selectedPerkHashes,[101],'Titan Artifact intent cannot contaminate the cached Warlock loadout');
assert.equal(persistedWarlock.weaponRollAdvice,undefined,'Titan weapon advice cannot contaminate the cached Warlock loadout');

rememberGuardian({...warlockLoadout,selectedLoadoutIndex:null});
assert.equal(resolveBuildSource().selectedLoadoutIndex,null,'returning to a character current-equipped view does not silently reopen its old saved loadout');

console.log('Build Space character isolation tests passed.');
