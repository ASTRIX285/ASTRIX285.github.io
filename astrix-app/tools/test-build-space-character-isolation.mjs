import assert from 'node:assert/strict';

class MemoryStore{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
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

const warlockLoadout={characterId:'warlock-1',characterClass:'Warlock',selectedLoadoutIndex:2,weapons:[{itemInstanceId:'warlock-weapon'}],artifactConfiguration:{selectedPerkHashes:[101]}};
rememberGuardian(warlockLoadout);
rememberExplicitLoadout(warlockLoadout);
assert.equal(resolveBuildSource().selectedLoadoutIndex,2,'selected loadout is preferred while its Guardian remains active');

const titanEquipped={characterId:'titan-1',characterClass:'Titan',selectedLoadoutIndex:null,weapons:[{itemInstanceId:'titan-weapon'}],artifactConfiguration:{selectedPerkHashes:[201]}};
rememberGuardian(titanEquipped);
assert.equal(resolveBuildSource().characterId,'titan-1','switching Guardian rejects a stale loadout from another character');
assert.equal(resolveBuildSource().selectedLoadoutIndex,null,'current equipped Guardian remains the source after the switch');

rememberArtifactSelection({characterId:'titan-1',selectedLoadoutIndex:null,artifact:{hash:9001},artifactConfiguration:{selectedPerkHashes:[202]},perks:[{hash:202}]});
rememberWeaponAdvice({characterId:'titan-1',selectedLoadoutIndex:null,recommendations:[{itemInstanceId:'titan-weapon',verdict:'keep'}]});
const titanSource=resolveBuildSource();
assert.deepEqual(titanSource.artifactConfiguration.selectedPerkHashes,[202]);
assert.equal(titanSource.weapons[0].weaponRollAdvice.verdict,'keep');

const persistedWarlockEnvelope=JSON.parse(localStorage.getItem(LAST_LOADOUT_KEY));
assert.equal(persistedWarlockEnvelope.schemaVersion,2,'durable loadouts use the versioned handoff envelope');
assert.equal(persistedWarlockEnvelope.binding.characterId,'warlock-1','durable envelope remains bound to the saved Guardian');
const persistedWarlock=persistedWarlockEnvelope.payload;
assert.deepEqual(persistedWarlock.artifactConfiguration.selectedPerkHashes,[101],'Titan Artifact intent cannot contaminate the cached Warlock loadout');
assert.equal(persistedWarlock.weaponRollAdvice,undefined,'Titan weapon advice cannot contaminate the cached Warlock loadout');

rememberGuardian({...warlockLoadout,selectedLoadoutIndex:null});
assert.equal(resolveBuildSource().selectedLoadoutIndex,null,'returning to a character current-equipped view does not silently reopen its old saved loadout');

console.log('Build Space character isolation tests passed.');
