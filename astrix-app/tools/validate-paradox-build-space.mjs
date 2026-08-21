#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createBuildState,diffBuilds,createValidationRecord,VALIDATION_STATUS} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';

const item=(hash,name)=>({hash,bungieHash:hash,name});
const source={
  source:'bungie-loadout',
  characterId:'hunter-1',
  characterClass:'hunter',
  selectedLoadoutIndex:4,
  subclass:'stasis',
  subclassName:'Revenant',
  subclassBuild:{
    super:item(1,'Silence and Squall'),
    abilities:[item(2,'Dodge'),item(3,'Jump'),item(4,'Melee'),item(5,'Grenade')],
    aspects:[item(6,'Aspect A'),item(7,'Aspect B')],
    fragments:[item(8,'Fragment A'),item(9,'Fragment B')]
  },
  artifact:{hash:20,name:'Seasonal Artifact',activePerks:[item(21,'Perk A')]},
  weapons:[item(30,'Primary'),item(31,'Special'),item(32,'Heavy')],
  armour:[item(40,'Helmet'),item(41,'Arms'),item(42,'Chest'),item(43,'Legs'),item(44,'Class')]
};

const state=createBuildState(source);
assert.equal(state.originalBuild.characterId,'hunter-1');
assert.equal(state.workingBuild.selectedLoadoutIndex,4);
assert.notEqual(state.originalBuild,state.workingBuild,'Original and working states must not share the root object');
assert.equal(Object.isFrozen(state.originalBuild),true,'Original build must be immutable');
assert.equal(Object.isFrozen(state.originalBuild.subclassBuild),true,'Nested original build state must be immutable');

state.workingBuild.weapons[2]=item(99,'Paradox Heavy');
const changes=diffBuilds(state.originalBuild,state.workingBuild);
assert.equal(changes.length,1,'One weapon mutation should produce one deterministic diff');
assert.equal(changes[0].path,'weapons.2');
assert.equal(changes[0].beforeId,'32');
assert.equal(changes[0].afterId,'99');

const test=createValidationRecord({build:state.workingBuild,targetActivity:'Vanguard Master Operation',objective:'survivability'});
assert.match(test.testId,/^PF-TEST-/);
assert.equal(test.status,VALIDATION_STATUS.UNTESTED);
assert.equal(test.targetActivity,'Vanguard Master Operation');
assert.equal(test.objective,'survivability');
assert.equal(test.buildIntegrity,'unverified');
assert.equal(Object.isFrozen(test.buildSnapshot),true,'Validation build snapshot must be immutable');

console.log('PARADOX_BUILD_SPACE_STATE=PASS');
console.log('ORIGINAL_WORKING_ISOLATION=PASS');
console.log('DETERMINISTIC_BUILD_DIFF=PASS');
console.log('VANGUARD_VALIDATION_RECORD=PASS');
