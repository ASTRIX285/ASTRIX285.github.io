import assert from 'node:assert/strict';
import {createBuildState,createIntendedArtifactConfiguration,toggleIntendedArtifactPerk,protectBuildState,restoreWorkingBuild,diffBuilds} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';

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

const hydrated=JSON.parse(JSON.stringify(state));
assert.equal(Object.isFrozen(hydrated.originalBuild),false,'browser storage hydration removes JavaScript immutability');
const protectedHydrated=protectBuildState(hydrated);
assert.equal(Object.isFrozen(protectedHydrated.originalBuild),true,'hydrated Original Build must be frozen again');
assert.equal(Object.isFrozen(protectedHydrated.originalBuild.artifactConfiguration),true,'nested Original Build state must also be frozen');
assert.equal(Object.isFrozen(protectedHydrated.workingBuild),false,'Working Build must remain editable');
assert.throws(()=>{protectedHydrated.originalBuild.artifactConfiguration.selectedPerkHashes.push(777);},TypeError);
protectedHydrated.workingBuild.artifactConfiguration.selectedPerkHashes.push(777);
assert.deepEqual(protectedHydrated.originalBuild.artifactConfiguration.selectedPerkHashes,[123]);
assert.deepEqual(protectedHydrated.workingBuild.artifactConfiguration.selectedPerkHashes,[123,777]);
assert.deepEqual(protectedHydrated.validationRecords,[{testId:'preserved-history'}]);

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

const fixtureWithoutConfiguration=createBuildState({
  source:'paradox-beta',
  characterId:'fixture-generated-configuration',
  artifact:{
    hash:2001,
    seasonNumber:30,
    source:'verified-manifest-fixture',
    activePerks:[{hash:601},{hash:602}]
  }
});
assert.equal(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.artifactHash,2001);
assert.equal(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.seasonNumber,30);
assert.deepEqual(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.selectedPerkHashes,[601,602]);
assert.equal(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.source,'paradox-build-space-intended');
assert.equal(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.provenance.state,'intended');
assert.equal(fixtureWithoutConfiguration.originalBuild.artifactConfiguration.provenance.derivedFrom,'verified-manifest-fixture');

const explicitShareConfiguration={
  schemaVersion:1,
  artifactHash:3001,
  seasonNumber:31,
  selectedPerkHashes:[701],
  source:'shared-build-intent',
  provenance:{provider:'verified-share',shareId:'share-1'}
};
const sharedBuild=createBuildState({source:'shared-build',characterId:'shared',artifact:{hash:3001},artifactConfiguration:explicitShareConfiguration});
assert.deepEqual(sharedBuild.originalBuild.artifactConfiguration,explicitShareConfiguration,'explicit share provenance must be retained unchanged');

const liveWithoutConfiguration=createBuildState({source:'bungie-live',characterId:'live',artifact:{hash:4001,seasonNumber:31,activePerks:[{hash:801}]}});
assert.equal(liveWithoutConfiguration.originalBuild.artifactConfiguration,null,'missing live configuration must remain unavailable instead of being reclassified as intended');

console.log('Build Design Artifact intent tests passed.');
