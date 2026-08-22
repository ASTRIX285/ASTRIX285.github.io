#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveArtifactViewState } from '../pages/guardian-workspace-v2/guardian-artifact-state.mjs';

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

console.log('LIVE_ARTIFACT_WINS=PASS');
console.log('ACTIVE_PERKS_ONLY=PASS');
console.log('UNAVAILABLE_IS_NOT_ZERO=PASS');
console.log('FIXTURE_ARTIFACT_ISOLATED=PASS');
