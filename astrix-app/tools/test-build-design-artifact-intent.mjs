import assert from 'node:assert/strict';
import {createBuildState,createIntendedArtifactConfiguration,toggleIntendedArtifactPerk,restoreWorkingBuild,diffBuilds} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';

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
const changes=diffBuilds(state.originalBuild,state.workingBuild);
assert.deepEqual(changes.map(change=>change.path),['artifact','artifactConfiguration']);
state.recommendation={id:'stale-working-recommendation'};
state.validationRecords.push({testId:'preserved-history'});
const restored=restoreWorkingBuild(state);
assert.strictEqual(restored.originalBuild,state.originalBuild);
assert.notStrictEqual(restored.workingBuild,restored.originalBuild);
assert.deepEqual(diffBuilds(restored.originalBuild,restored.workingBuild),[]);
assert.equal(restored.recommendation,null);
assert.deepEqual(restored.validationRecords,[{testId:'preserved-history'}]);
restored.workingBuild.artifactConfiguration.selectedPerkHashes.push(999);
assert.deepEqual(restored.originalBuild.artifactConfiguration.selectedPerkHashes,[123]);

const perkOnly=createBuildState({characterId:'fixture',artifact:{hash:1001},artifactConfiguration:{artifactHash:1001,seasonNumber:29,selectedPerkHashes:[501]}});
perkOnly.workingBuild.artifactConfiguration.selectedPerkHashes=[501,502];
assert.deepEqual(diffBuilds(perkOnly.originalBuild,perkOnly.workingBuild).map(change=>change.path),['artifactConfiguration']);
perkOnly.workingBuild.artifactConfiguration.selectedPerkHashes=[501];
assert.deepEqual(diffBuilds(perkOnly.originalBuild,perkOnly.workingBuild),[]);

const reordered=createBuildState({characterId:'fixture',artifactConfiguration:{artifactHash:1001,seasonNumber:29,selectedPerkHashes:[501,502]}});
reordered.workingBuild.artifactConfiguration.selectedPerkHashes=[502,501];
assert.deepEqual(diffBuilds(reordered.originalBuild,reordered.workingBuild),[],'Artifact perk ordering alone is not a Working Build change');

const unavailableState=createBuildState({characterId:'fixture',artifactConfiguration:{artifactHash:1001,seasonNumber:29,selectedPerkHashes:null}});
unavailableState.workingBuild.artifactConfiguration.selectedPerkHashes=[];
assert.deepEqual(diffBuilds(unavailableState.originalBuild,unavailableState.workingBuild).map(change=>change.path),['artifactConfiguration'],'unknown active state remains distinct from an explicit empty intended selection');

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
