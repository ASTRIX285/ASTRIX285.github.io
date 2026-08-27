import assert from 'node:assert/strict';
import {resolveArtifactByProvenance,createArtifactConfiguration} from '../pages/guardian-workspace-v2/guardian-artifact-provenance.mjs';
import {createBuildState} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {resolveArtifactViewState} from '../pages/guardian-workspace-v2/guardian-artifact-state.mjs';

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

const missingLiveView=resolveArtifactViewState({source:'bungie-live',artifact:null});
assert.equal(missingLiveView.mode,'live','a live event without an Artifact must not fall back to fixture mode');
assert.equal(missingLiveView.state,'state-unavailable');
assert.equal(missingLiveView.artifact,null);
assert.equal(missingLiveView.perks,null,'missing component-202 Artifact evidence must not become zero active perks');
assert.equal(missingLiveView.selectedHashes,null);

const unavailableLiveView=resolveArtifactViewState({source:'bungie-live',artifact:unavailable});
assert.equal(unavailableLiveView.mode,'live');
assert.equal(unavailableLiveView.perks,null,'unavailable component-202 activation evidence must remain unknown');
assert.equal(unavailableLiveView.selectedHashes,null);

const incompleteActivationPayload=structuredClone(payload);
delete incompleteActivationPayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].isActive;
const incompleteActivation=resolveArtifactByProvenance(incompleteActivationPayload,'cid-live');
assert.equal(incompleteActivation.state,'state-unavailable');
assert.equal(incompleteActivation.activePerks,null,'missing isActive evidence must not become zero active perks');
assert.equal(incompleteActivation.artifactConfiguration.selectedPerkHashes,null);
assert.match(incompleteActivation.stateMessage,/incomplete Artifact tier activation evidence/);

const malformedHashPayload=structuredClone(payload);
malformedHashPayload.profile.characterProgressions.data['cid-live'].seasonalArtifact.tiers[0].items[0].itemHash=null;
const malformedHash=resolveArtifactByProvenance(malformedHashPayload,'cid-live');
assert.equal(malformedHash.state,'state-unavailable');
assert.equal(malformedHash.activePerks,null,'missing perk identity must leave activation state unavailable');

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
