import {createBuildState} from '../guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {bindingOf,bindingsEqual,createHandoffEnvelope} from '../guardian-workspace-v2/paradox-build-binding.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const BUILD_SNAPSHOT_KEY='astrix:guardian-build-snapshot:v1';

const text=value=>String(value??'').trim();

function compactForgeLoaderProfileBuild(profileBuild={},binding={}){
  const subclassBuild=profileBuild.subclassBuild&&typeof profileBuild.subclassBuild==='object'?profileBuild.subclassBuild:{};
  return {
    version:1,
    capturedAt:new Date().toISOString(),
    source:'bungie-live',
    characterId:text(binding.characterId),
    membershipId:text(binding.membershipId),
    membershipType:text(binding.membershipType),
    characterClass:profileBuild.characterClass||'',
    displayName:profileBuild.displayName||'Guardian',
    power:profileBuild.power??null,
    guardianRank:profileBuild.guardianRank??null,
    titleHash:profileBuild.titleHash??null,
    title:profileBuild.title||'',
    selectedLoadoutIndex:Number.isInteger(profileBuild.selectedLoadoutIndex)?profileBuild.selectedLoadoutIndex:null,
    subclass:profileBuild.subclass||'',
    subclassName:profileBuild.subclassName||'',
    subclassIcon:profileBuild.subclassIcon||'',
    subclassCatalog:profileBuild.subclassCatalog||[],
    subclassBuild,
    super:profileBuild.super??subclassBuild.super??null,
    abilities:profileBuild.abilities||subclassBuild.abilities||[],
    aspects:profileBuild.aspects||subclassBuild.aspects||[],
    fragments:profileBuild.fragments||subclassBuild.fragments||[],
    artifact:profileBuild.artifact||null,
    artifactConfiguration:profileBuild.artifactConfiguration||profileBuild.artifact?.artifactConfiguration||null,
    availableArtifacts:profileBuild.availableArtifacts||[],
    artifactOptions:profileBuild.artifactOptions||[],
    weapons:profileBuild.weapons||[],
    armour:profileBuild.armour||[],
    mods:profileBuild.mods||profileBuild.armourMods||[],
    stats:profileBuild.stats||[],
    emblem:profileBuild.emblem||null,
    ghost:profileBuild.ghost||null,
    shader:profileBuild.shader||null,
    ornaments:profileBuild.ornaments||[],
    hashCoverage:profileBuild.hashCoverage||null,
    semanticCoverage:profileBuild.semanticCoverage||null,
    paradoxAnalysis:profileBuild.paradoxAnalysis||null,
    weaponRollAdvice:profileBuild.weaponRollAdvice||null,
    locks:{},
    objective:null,
    activityContext:null
  };
}

function createForgeLoaderBuildSnapshot(profileBuild={},binding={}){
  const expected={
    characterId:text(binding.characterId),
    membershipId:text(binding.membershipId),
    membershipType:text(binding.membershipType)
  };
  if(!expected.characterId||!expected.membershipId||!expected.membershipType)return null;
  if(text(profileBuild.characterId)!==expected.characterId)return null;
  const source=compactForgeLoaderProfileBuild(profileBuild,expected);
  const state=createBuildState(source);
  if(!bindingsEqual(bindingOf(state.originalBuild),expected)||!bindingsEqual(bindingOf(state.workingBuild),expected))return null;
  return createHandoffEnvelope(state);
}

function writeForgeLoaderBuildSnapshot(profileBuild,binding,{stores=[]}={}){
  let envelope=null,json='';
  try{
    envelope=createForgeLoaderBuildSnapshot(profileBuild,binding);
    if(!envelope)return false;
    json=JSON.stringify(envelope);
  }catch{return false;}
  let stored=false;
  for(const store of stores){
    if(!store)continue;
    try{
      store.removeItem(BUILD_SPACE_KEY);
      store.setItem(BUILD_SNAPSHOT_KEY,json);
      stored=true;
    }catch{}
  }
  return stored;
}

export {BUILD_SNAPSHOT_KEY,BUILD_SPACE_KEY,compactForgeLoaderProfileBuild,createForgeLoaderBuildSnapshot,writeForgeLoaderBuildSnapshot};
