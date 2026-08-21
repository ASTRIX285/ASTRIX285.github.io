#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createBuildState,diffBuilds,createValidationRecord,VALIDATION_STATUS} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {analyzeScenario,normalizeScenario} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-intelligence-contract.mjs';

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

const scenario=normalizeScenario({
  scenarioId:'PF-INT-001',
  buildSource:'bungie-loadout',
  objective:'ability-uptime',
  activityType:'vanguard-master-operation',
  champions:['unstoppable'],
  locks:{weapons:{2:true}},
  evidenceNodes:[
    {id:'grenade',componentType:'ability',name:'Grenade',emits:['scorch'],verified:true,sources:['bungie']},
    {id:'fragment',componentType:'fragment',name:'Fragment',consumes:['scorch'],emits:['grenade-energy'],verified:true,sources:['verified-fixture']},
    {id:'weapon',componentType:'weapon',name:'Weapon',consumes:['grenade-energy'],triggers:['weapon-final-blow'],verified:false,sources:[]}
  ]
});
assert.equal(scenario.objective,'ability-uptime');
assert.equal(scenario.activity.type,'vanguard-master-operation');
assert.equal(scenario.locks.weapons[2],true);

const analysis=analyzeScenario(scenario);
assert.deepEqual(analysis.edges.map(edge=>[edge.from,edge.to,edge.token]),[['grenade','fragment','scorch'],['fragment','weapon','grenade-energy']]);
assert.equal(analysis.edges[0].verified,true);
assert.equal(analysis.edges[1].verified,false);
assert.deepEqual(analysis.isolated,[]);
assert.equal(analysis.unverifiedEdges.length,1);

assert.throws(()=>normalizeScenario({evidenceNodes:[{id:'bad',emits:['invented-token']}]}),/unknown Paradox token/,'Unknown reasoning tokens must fail closed');

console.log('PARADOX_BUILD_SPACE_STATE=PASS');
console.log('ORIGINAL_WORKING_ISOLATION=PASS');
console.log('DETERMINISTIC_BUILD_DIFF=PASS');
console.log('VANGUARD_VALIDATION_RECORD=PASS');
console.log('PARADOX_SCENARIO_CONTRACT=PASS');
console.log('DIRECTED_SYNERGY_EDGES=PASS');
console.log('UNKNOWN_TOKEN_FAIL_CLOSED=PASS');
