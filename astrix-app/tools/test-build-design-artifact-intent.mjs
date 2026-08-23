import assert from 'node:assert/strict';
import {createBuildState,createIntendedArtifactConfiguration,toggleIntendedArtifactPerk} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';

const originalConfiguration={schemaVersion:1,artifactHash:999,seasonNumber:28,selectedPerkHashes:[123],source:'fixture-intent',provenance:{provider:'fixture'}};
const state=createBuildState({characterId:'fixture',artifactConfiguration:originalConfiguration});
const candidate={hash:1001,seasonNumber:29,source:'verified-catalogue',activePerks:[{hash:501},{hash:502}],artifactConfiguration:{provenance:{provider:'verified-fixture'}}};
const intended=createIntendedArtifactConfiguration(candidate,state.workingBuild.artifactConfiguration);
state.workingBuild.artifact=structuredClone(candidate);
state.workingBuild.artifact.artifactConfiguration=structuredClone(intended);
state.workingBuild.artifactConfiguration=intended;

assert.deepEqual(state.originalBuild.artifactConfiguration,originalConfiguration);
assert.equal(state.workingBuild.artifactConfiguration.artifactHash,1001);
assert.equal(state.workingBuild.artifactConfiguration.seasonNumber,29);
assert.deepEqual(state.workingBuild.artifactConfiguration.selectedPerkHashes,[501,502]);
assert.equal(state.workingBuild.artifactConfiguration.source,'paradox-build-space-intended');
assert.equal(state.workingBuild.artifactConfiguration.provenance.state,'intended');
assert.equal(state.workingBuild.artifactConfiguration.provenance.upstream.provider,'verified-fixture');

const unavailable=createIntendedArtifactConfiguration({hash:1002,seasonNumber:29,state:'state-unavailable'},null);
assert.equal(unavailable.selectedPerkHashes,null);


const liveArtifact={
  hash:1001,
  seasonNumber:29,
  source:'bungie-character-progressions-202',
  perks:[
    {hash:501,isActive:true,isVisible:true,tierUnlocked:true},
    {hash:502,isActive:false,isVisible:true,tierUnlocked:true},
    {hash:503,isActive:false,isVisible:true,tierUnlocked:false}
  ],
  activePerks:[{hash:501,isActive:true}]
};
const liveBefore=structuredClone(liveArtifact);
const toggled=toggleIntendedArtifactPerk(liveArtifact,null,1);
assert.deepEqual(toggled.selectedPerkHashes,[501,502]);
assert.equal(toggled.source,'paradox-working-build-intended');
assert.equal(toggled.provenance.intent,'working-build-selection');
assert.deepEqual(liveArtifact,liveBefore,'staging intended perks must not mutate Bungie live isActive evidence');
const locked=toggleIntendedArtifactPerk(liveArtifact,toggled,2);
assert.deepEqual(locked.selectedPerkHashes,[501,502],'locked tiers must not be staged');

console.log('Build Design Artifact intent tests passed.');
