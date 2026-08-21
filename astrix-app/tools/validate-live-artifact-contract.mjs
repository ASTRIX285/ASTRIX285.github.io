#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveArtifactViewState } from '../pages/guardian-workspace-v2/guardian-artifact-state.mjs';

const live={
  source:'bungie-live',
  artifact:{
    hash:123,
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
    ]
  }
};
const state=resolveArtifactViewState(live,{fixtureArtifact:{hash:999,name:'Fixture Artifact'},fixtureSelected:[77]});
assert.equal(state.mode,'live');
assert.equal(state.artifact.hash,123);
assert.deepEqual(state.selectedHashes,[2,3]);
assert.equal(state.perks.length,2);
assert.equal(state.editable,false);

const fixture=resolveArtifactViewState({source:'paradox-beta',fixtureId:'PF-X'},{fixtureArtifact:{hash:999,name:'Fixture Artifact'},fixtureSelected:[77,88]});
assert.equal(fixture.mode,'fixture');
assert.equal(fixture.artifact.hash,999);
assert.deepEqual(fixture.selectedHashes,[77,88]);
assert.equal(fixture.editable,true);

console.log('LIVE_ARTIFACT_WINS=PASS');
console.log('ACTIVE_PERKS_ONLY=PASS');
console.log('FIXTURE_ARTIFACT_ISOLATED=PASS');
