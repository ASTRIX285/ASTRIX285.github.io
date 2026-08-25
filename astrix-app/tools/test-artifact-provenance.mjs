import assert from 'node:assert/strict';
import {resolveArtifactByProvenance,createArtifactConfiguration} from '../pages/guardian-workspace-v2/guardian-artifact-provenance.mjs';
import {createBuildState} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';

const definitions={'123':{displayProperties:{name:'Verified Active Perk',icon:'/common/test.png'}}};
const payload={
  profile:{
    profileProgression:{data:{seasonalArtifact:{artifactHash:999}}},
    characterProgressions:{data:{'cid-live':{seasonalArtifact:{artifactHash:999,tiers:[{items:[
      {itemHash:123,isActive:true,isVisible:true},
      {itemHash:456,isActive:false,isVisible:true}
    ]}]}}}}
  },
  definitions,
  artifactDefinition:{hash:999,displayProperties:{name:'Verified Artifact'}}
};

const live=resolveArtifactByProvenance(payload,'cid-live');
assert.equal(live.state,'resolved');
assert.deepEqual(live.artifactConfiguration.selectedPerkHashes,[123]);
assert.equal(live.artifactConfiguration.provenance.component,202);
assert.equal(live.activePerks[0].name,'Verified Active Perk');

const nonePayload=structuredClone(payload);
nonePayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].isActive=false;
const none=resolveArtifactByProvenance(nonePayload,'cid-live');
assert.equal(none.state,'none-active');
assert.deepEqual(none.artifactConfiguration.selectedPerkHashes,[]);

const unavailable=resolveArtifactByProvenance(payload,'missing-character');
assert.equal(unavailable.state,'state-unavailable');
assert.equal(unavailable.activePerks,null);
assert.equal(unavailable.artifactConfiguration.selectedPerkHashes,null);

const unresolvedPayload=structuredClone(payload);
unresolvedPayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].itemHash=789;
const unresolved=resolveArtifactByProvenance(unresolvedPayload,'cid-live');
assert.equal(unresolved.activePerks[0].name,'');
assert.equal(unresolved.activePerks[0].unresolved,true);
assert.deepEqual(unresolved.unresolvedPerkHashes,[789]);

const mismatchedDefinitionPayload=structuredClone(payload);
mismatchedDefinitionPayload.artifactDefinition={hash:111,displayProperties:{name:'Wrong Artifact',icon:'/common/wrong.png'}};
const mismatchedDefinition=resolveArtifactByProvenance(mismatchedDefinitionPayload,'cid-live');
assert.equal(mismatchedDefinition.hash,999);
assert.equal(mismatchedDefinition.name,'','a stale definition must not label a different Artifact hash');
assert.equal(mismatchedDefinition.definition,null);
assert.equal(mismatchedDefinition.displayResolved,false);
assert.equal(mismatchedDefinition.unresolved,true);

const exactManifestPayload=structuredClone(mismatchedDefinitionPayload);
exactManifestPayload.definitions['999']={hash:999,displayProperties:{name:'Exact Manifest Artifact',icon:'/common/exact.png'}};
const exactManifestArtifact=resolveArtifactByProvenance(exactManifestPayload,'cid-live');
assert.equal(exactManifestArtifact.name,'Exact Manifest Artifact','an exact manifest hash may resolve display identity');
assert.equal(exactManifestArtifact.definition.hash,999);
assert.equal(exactManifestArtifact.unresolved,false);

const intended=createArtifactConfiguration({artifactHash:999,seasonNumber:28,selectedPerkHashes:[123],source:'fixture-intent',provenance:{provider:'fixture'}});
assert.equal(createArtifactConfiguration({source:'fixture-intent'}).artifactHash,null);
const state=createBuildState({characterId:'fixture',artifactConfiguration:intended});
assert.deepEqual(state.originalBuild.artifactConfiguration,intended);
state.workingBuild.artifactConfiguration.selectedPerkHashes.push(456);
assert.deepEqual(state.originalBuild.artifactConfiguration.selectedPerkHashes,[123]);

console.log('Artifact provenance and build-state tests passed.');
