#!/usr/bin/env node
import assert from 'node:assert/strict';
import {classifyArtifact} from '../pages/guardian-workspace-v2/guardian-artifact-semantics.mjs';

const perk=(hash,{active=false,visible=true,resolved=true}={})=>({
  hash,
  name:`Artifact Perk ${hash}`,
  isActive:active,
  isVisible:visible,
  definition:resolved?{displayProperties:{name:`Artifact Perk ${hash}`}}:{}
});

const applied=[1,2,3,4,5,6,7].map(hash=>perk(hash,{active:true}));
const inactive=perk(8,{active:false,visible:true});
const artifact={hash:999,name:'Test Artifact',perks:[...applied,inactive],activePerks:applied};
const semantic=classifyArtifact(artifact);

assert.equal(semantic.appliedCount,7);
assert.equal(semantic.sevenOfSeven,true);
assert.equal(semantic.definitionsComplete,true);
assert.equal(semantic.complete,true);
assert.equal(semantic.appliedPerks.some(row=>row.hash===8),false,'Visible but inactive Artifact perk must not be treated as applied');

const unresolvedApplied=[...applied.slice(0,6),perk(7,{active:true,resolved:false})];
const incomplete=classifyArtifact({hash:999,name:'Test Artifact',perks:unresolvedApplied,activePerks:unresolvedApplied});
assert.equal(incomplete.appliedCount,7);
assert.equal(incomplete.sevenOfSeven,true);
assert.equal(incomplete.definitionsComplete,false);
assert.deepEqual(incomplete.unresolvedAppliedHashes,[7]);
assert.equal(incomplete.complete,false);

console.log('PARADOX_ARTIFACT_SEMANTICS=PASS');
console.log('ARTIFACT_APPLIED_7_OF_7=PASS');
console.log('INACTIVE_ARTIFACT_PERK_EXCLUDED=PASS');
console.log('UNRESOLVED_ACTIVE_PERK_DETECTED=PASS');
