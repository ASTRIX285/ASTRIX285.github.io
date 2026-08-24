#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveArtifactViewState,resolveFixtureArtifactDefinition,resolveIntendedArtifactConfiguration } from '../pages/guardian-workspace-v2/guardian-artifact-state.mjs';

const live={
  source:'bungie-live',
  artifact:{
    hash:123,
    state:'resolved',
    name:'Live Seasonal Artifact',
    icon:'https://www.bungie.net/common/destiny2_content/icons/live.png',
    perks:[
      {hash:1,name:'Inactive',icon:'i.png',isActive:false},
      {hash:2,name:'Active A',icon:'a.png',isActive:true},
      {hash:3,name:'Active B',icon:'b.png',isActive:true}
    ],
    activePerks:[
      {hash:2,name:'Active A',icon:'a.png',isActive:true},
      {hash:3,name:'Active B',icon:'b.png',isActive:true}
    ],
    artifactConfiguration:{
      artifactHash:123,
      seasonNumber:28,
      selectedPerkHashes:[2,3],
      source:'bungie-live',
      provenance:{component:202,characterId:'cid-live'}
    }
  }
};
const state=resolveArtifactViewState(live,{fixtureArtifact:{hash:999,name:'Fixture Artifact'},fixtureSelected:[77]});
assert.equal(state.mode,'live');
assert.equal(state.artifact.hash,123);
assert.deepEqual(state.selectedHashes,[2,3]);
assert.equal(state.perks.length,2);
assert.equal(state.editable,false);
assert.equal(state.artifactConfiguration.provenance.component,202);

const unavailable=resolveArtifactViewState({source:'bungie-live',artifact:{hash:123,state:'state-unavailable',activePerks:null,perks:null}},{fixtureSelected:[77]});
assert.equal(unavailable.state,'state-unavailable');
assert.equal(unavailable.selectedHashes,null);
assert.equal(unavailable.perks.length,0);

const fixture=resolveArtifactViewState({source:'paradox-beta',fixtureId:'PF-X'},{fixtureArtifact:{hash:999,name:'Fixture Artifact'},fixtureSelected:[77,88]});
assert.equal(fixture.mode,'fixture');
assert.equal(fixture.artifact.hash,999);
assert.deepEqual(fixture.selectedHashes,[77,88]);
assert.equal(fixture.editable,true);

const manifestArtifacts={
  first:{hash:111,seasonNumber:29,display:{name:'First real Artifact'}},
  requested:{bungieHash:222,seasonNumber:30,display:{name:'Requested real Artifact'}}
};
assert.equal(resolveFixtureArtifactDefinition(manifestArtifacts,222).bungieHash,222,'explicit Artifact hash resolves its real manifest definition');
assert.equal(resolveFixtureArtifactDefinition(manifestArtifacts,999),null,'unknown explicit Artifact hash must not fall back to another definition');
assert.equal(resolveFixtureArtifactDefinition(manifestArtifacts,null).hash,111,'manifest default is used only when no Artifact hash was supplied');

const savedConfiguration={
  schemaVersion:1,
  artifactHash:222,
  seasonNumber:30,
  selectedPerkHashes:[91,92],
  source:'shared-build-intent',
  provenance:{provider:'verified-share',shareId:'share-222'}
};
const retained=resolveIntendedArtifactConfiguration(
  {artifactConfiguration:savedConfiguration},
  {hash:222,seasonNumber:30},
  savedConfiguration.selectedPerkHashes,
  {source:'fixture-intent',provenance:{provider:'fallback'}}
);
assert.equal(retained.artifactHash,222);
assert.equal(retained.seasonNumber,30);
assert.deepEqual(retained.selectedPerkHashes,[91,92]);
assert.equal(retained.source,'shared-build-intent');
assert.deepEqual(retained.provenance,{provider:'verified-share',shareId:'share-222'});
assert.equal(resolveIntendedArtifactConfiguration({},null,[]).artifactHash,null,'missing Artifact identity must remain unavailable, not hash zero');
const savedBefore=structuredClone(savedConfiguration);
const edited=resolveIntendedArtifactConfiguration(
  {artifactConfiguration:savedConfiguration},
  {hash:222,seasonNumber:30},
  [92,93,93],
  {source:'fixture-intent',provenance:{provider:'fallback'}}
);
assert.deepEqual(edited.selectedPerkHashes,[92,93],'picker changes update only intended perk hashes and remove duplicates');
assert.equal(edited.artifactHash,222);
assert.equal(edited.seasonNumber,30);
assert.equal(edited.source,'shared-build-intent');
assert.deepEqual(edited.provenance,{provider:'verified-share',shareId:'share-222'});
assert.deepEqual(savedConfiguration,savedBefore,'picker round trip must not mutate the incoming saved configuration');


console.log('LIVE_ARTIFACT_WINS=PASS');
console.log('ACTIVE_PERKS_ONLY=PASS');
console.log('UNAVAILABLE_IS_NOT_ZERO=PASS');
console.log('FIXTURE_ARTIFACT_ISOLATED=PASS');
console.log('FIXTURE_PROVENANCE_RETAINED=PASS');
console.log('FIXTURE_MANIFEST_HASH_BOUND=PASS');
console.log('FIXTURE_PICKER_ROUND_TRIP=PASS');
