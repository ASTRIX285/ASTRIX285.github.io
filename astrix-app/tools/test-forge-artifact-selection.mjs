import assert from 'node:assert/strict';
import {createBuildState} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {applyForgeArtifactRecommendation} from '../pages/guardian-workspace-v2/paradox-build-space/paradox-artifact-selection.mjs';

const perk=(hash,name,description,tierIndex,itemIndex,minimumUnlockPointsUsedRequirement,{active=false,visible=true}={})=>({
  hash,
  name,
  description,
  displayResolved:true,
  unresolved:false,
  isActive:active,
  isVisible:visible,
  tierUnlocked:true,
  tierIndex,
  itemIndex,
  column:tierIndex+1,
  order:itemIndex+1,
  minimumUnlockPointsUsedRequirement
});

const source={
  source:'bungie-live',
  characterId:'hunter-artifact',
  currentSeasonNumber:31,
  subclass:'Solar',
  subclassBuild:{super:{hash:501,name:'Solar Super',description:'Solar Super final blows ignite targets.'},abilities:[],aspects:[],fragments:[]},
  weapons:[{hash:601,name:'Verified Sidearm',weaponType:'Sidearm',element:'Solar'}],
  artifact:{
    hash:999,
    artifactHash:999,
    name:'Verified Current Artifact',
    seasonNumber:31,
    pointsUsed:3,
    state:'resolved',
    provenance:'bungie-character-progressions-202',
    perks:[
      perk(101,'Piercing Sidearm','Your equipped Sidearms stun Barrier Champions.',0,0,0,{active:true}),
      perk(106,'Void Recovery','Void effects grant overshield.',0,1,0),
      perk(102,'Solar Grenade Engine','Solar grenade final blows improve grenade recharge.',1,0,1,{active:true}),
      perk(103,'Precision Reserve','Precision weapon final blows improve ammo reserves.',1,1,1),
      perk(105,'Charged Ordnance','Armour Charge improves grenade damage.',2,0,2,{active:true})
    ],
    activePerks:[],
    artifactConfiguration:{artifactHash:999,seasonNumber:31,selectedPerkHashes:[101,102,105],source:'bungie-live',provenance:{provider:'bungie',component:202}}
  },
  artifactConfiguration:{artifactHash:999,seasonNumber:31,selectedPerkHashes:[101,102,105],source:'bungie-live',provenance:{provider:'bungie',component:202}},
  forgeLoaderDecision:{
    buildAnchor:{perk:{hash:801,name:'Exotic Grenade Loop',description:'Solar grenade final blows grant Armour Charge.'}},
    statDirective:{targets:{health:0,melee:0,grenade:200,super:0,class:0,weapon:100},priorities:{health:null,melee:null,grenade:1,super:null,class:null,weapon:2}},
    setProtocol:[{count:4,trait:{hash:901,name:'Charged Arsenal',description:'Armour Charge improves grenade and weapon damage.'}}]
  }
};
source.artifact.activePerks=source.artifact.perks.filter(row=>row.isActive);

const state=createBuildState(source);
const originalBefore=JSON.stringify(state.originalBuild);
const liveBefore=JSON.stringify(state.originalBuild.artifactConfiguration);
const result=applyForgeArtifactRecommendation(state,{currentSeasonNumber:31});
assert.equal(result.applied,true);
assert.equal(JSON.stringify(result.state.originalBuild),originalBefore,'Artifact recommendation must not mutate Original Build');
assert.equal(JSON.stringify(result.state.originalBuild.artifactConfiguration),liveBefore,'Artifact recommendation must not rewrite captured live Artifact state');
assert.equal(Object.isFrozen(result.state.originalBuild),true);
assert.equal(result.state.workingBuild.artifactConfiguration.source,'paradox-forge-loader-recommendation');
assert.equal(result.state.workingBuild.artifactConfiguration.provenance.state,'recommended-working-build-only');
assert.equal(result.state.workingBuild.artifactRecommendation.source,'paradox-forge-loader-artifact-fit');
assert.equal(result.state.workingBuild.artifactRecommendation.selectionStatus,'ready');
assert.equal(result.state.workingBuild.artifactRecommendation.selectionLimit,3);
assert.deepEqual(result.state.workingBuild.artifactConfiguration.selectedPerkHashes,[101,102,105]);
assert.equal('confirmed' in result.state.workingBuild.artifactConfiguration,false,'a recommendation must not masquerade as user confirmation');
assert.equal('liveApplied' in result.state.workingBuild.artifactConfiguration,false,'a recommendation must not claim a live mutation');

const repeated=applyForgeArtifactRecommendation(result.state,{currentSeasonNumber:31});
assert.equal(repeated.applied,false,'unchanged inputs must reuse the deterministic recommendation');
assert.equal(repeated.state,result.state);

const staleState=createBuildState(source);
const stale=applyForgeArtifactRecommendation(staleState,{currentSeasonNumber:32});
assert.equal(stale.applied,false);
assert.equal(stale.recommendation.status,'stale-artifact');
assert.deepEqual(stale.state.workingBuild.artifactConfiguration.selectedPerkHashes,[101,102,105],'stale season evidence must not stage a replacement');
assert.equal(JSON.stringify(stale.state.originalBuild),JSON.stringify(staleState.originalBuild));

const withoutForgeDecision=createBuildState({...source,forgeLoaderDecision:null});
const skipped=applyForgeArtifactRecommendation(withoutForgeDecision,{currentSeasonNumber:31});
assert.equal(skipped.applied,false);
assert.equal(skipped.state,withoutForgeDecision,'Artifact automation requires the exact Forge Loader decision');

console.log('FORGE_ARTIFACT_WORKING_ONLY=PASS');
console.log('FORGE_ARTIFACT_ORIGINAL_PROTECTED=PASS');
console.log('FORGE_ARTIFACT_CONFIRMATION_BOUNDARY=PASS');
