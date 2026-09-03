import {createBuildState} from '../guardian-workspace-v2/paradox-build-space/paradox-build-state.mjs';
import {bindingOf,bindingsEqual,createHandoffEnvelope} from '../guardian-workspace-v2/paradox-build-binding.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const BUILD_SNAPSHOT_KEY='astrix:guardian-build-snapshot:v1';

const text=value=>String(value??'').trim();

function createForgeLoaderBuildSnapshot(profileBuild={},binding={}){
  const expected={
    characterId:text(binding.characterId),
    membershipId:text(binding.membershipId),
    membershipType:text(binding.membershipType)
  };
  if(!expected.characterId||!expected.membershipId||!expected.membershipType)return null;
  if(text(profileBuild.characterId)!==expected.characterId)return null;
  const source={...profileBuild,...expected,source:'bungie-live'};
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

export {BUILD_SNAPSHOT_KEY,BUILD_SPACE_KEY,createForgeLoaderBuildSnapshot,writeForgeLoaderBuildSnapshot};
