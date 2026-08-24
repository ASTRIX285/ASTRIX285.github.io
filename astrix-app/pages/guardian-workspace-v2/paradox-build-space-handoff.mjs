import {clone,createBuildState} from './paradox-build-space/paradox-build-state.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const LAST_LOADOUT_KEY='astrix:paradox-last-bungie-loadout:v1';
let latestGuardian=null;
let latestExplicitLoadout=null;
const safeStore=(key,value)=>{const json=JSON.stringify(value);try{sessionStorage.setItem(key,json);}catch{}try{localStorage.setItem(key,json);}catch{}};
const safeRead=key=>{for(const store of [sessionStorage,localStorage]){try{const value=JSON.parse(store.getItem(key)||'null');if(value)return value;}catch{}}return null;};

function compactBuild(detail={}){
  const subclassBuild=detail.subclassBuild&&typeof detail.subclassBuild==='object'?detail.subclassBuild:{
    super:detail.super||null,superOptions:detail.superOptions||[],abilities:detail.abilities||[],abilityOptionsBySocket:detail.abilityOptionsBySocket||{},availableAbilities:detail.availableAbilities||[],aspects:detail.aspects||[],availableAspects:detail.availableAspects||[],fragments:detail.fragments||[],availableFragments:detail.availableFragments||[],transcendenceOptions:detail.transcendenceOptions||[],transcendenceSlots:detail.transcendenceSlots||[]
  };
  return {
    version:1,capturedAt:new Date().toISOString(),
    source:detail.selectedLoadoutIndex!=null?'bungie-loadout':(detail.source||'current-guardian'),
    characterId:String(detail.characterId||''),characterClass:detail.characterClass||'',displayName:detail.displayName||'Guardian',
    selectedLoadoutIndex:Number.isInteger(detail.selectedLoadoutIndex)?detail.selectedLoadoutIndex:null,
    subclass:detail.subclass||'',subclassName:detail.subclassName||'',subclassIcon:detail.subclassIcon||'',
    subclassBuild:clone(subclassBuild),artifact:clone(detail.artifact||null),artifactConfiguration:clone(detail.artifactConfiguration||detail.artifact?.artifactConfiguration||null),weapons:clone(detail.weapons||[]),armour:clone(detail.armour||[]),
    loadoutsAvailable:detail.loadoutsAvailable===true,loadouts:clone(detail.loadouts||[]),
    stats:clone(detail.stats||[]),hashCoverage:clone(detail.hashCoverage||null),semanticCoverage:clone(detail.semanticCoverage||null),coverage:clone(detail.coverage||null),paradoxAnalysis:clone(detail.paradoxAnalysis||null),
    locks:{},objective:null,activityContext:null
  };
}
function rememberGuardian(detail={}){
  if(!detail?.characterId)return;
  latestGuardian=compactBuild(detail);
  const isExplicit=Number.isInteger(detail.selectedLoadoutIndex);
  if(isExplicit){latestExplicitLoadout=clone(latestGuardian);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);return;}
  if(latestExplicitLoadout&&String(latestExplicitLoadout.characterId)!==String(detail.characterId))latestExplicitLoadout=null;
}
function rememberExplicitLoadout(detail={}){if(!detail?.characterId||!Number.isInteger(detail.selectedLoadoutIndex))return;latestExplicitLoadout=compactBuild(detail);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}
function rememberAnalysis(analysis={}){const matches=build=>build&&String(build.characterId)===String(analysis.characterId)&&Number(build.selectedLoadoutIndex??-1)===Number(analysis.selectedLoadoutIndex??-1);if(matches(latestGuardian))latestGuardian.paradoxAnalysis=clone(analysis);if(matches(latestExplicitLoadout)){latestExplicitLoadout.paradoxAnalysis=clone(analysis);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}}
function rememberWeaponAdvice(advice={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!build)continue;build.weaponRollAdvice=clone(advice);for(const row of advice.recommendations||[]){const weapon=build.weapons?.find(item=>String(item?.itemInstanceId||"")===String(row.itemInstanceId||""));if(weapon)weapon.weaponRollAdvice=clone(row);}}if(latestExplicitLoadout)safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}
function rememberArtifactSelection(detail={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!build)continue;build.artifactConfiguration=clone(detail.artifactConfiguration||null);if(detail.artifact)build.artifact={...clone(build.artifact||{}),...clone(detail.artifact),state:detail.state||build.artifact?.state,activePerks:clone(detail.perks||build.artifact?.activePerks||[]),artifactConfiguration:clone(detail.artifactConfiguration||null)};}if(latestExplicitLoadout)safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}
function resolveBuildSource(){
  if(latestGuardian&&Number.isInteger(latestGuardian.selectedLoadoutIndex))return clone(latestGuardian);
  if(latestExplicitLoadout&&latestGuardian&&String(latestExplicitLoadout.characterId)===String(latestGuardian.characterId))return clone(latestExplicitLoadout);
  if(latestGuardian)return clone(latestGuardian);
  const remembered=safeRead(LAST_LOADOUT_KEY);
  return remembered?.characterId?remembered:null;
}
function openBuildSpace(event){const button=event.target?.closest?.('.improve-cta');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const source=resolveBuildSource();if(source){const state=createBuildState(source);state.sourcePriority=source.source==='bungie-loadout'?'selected-or-last-bungie-loadout':'current-equipped-guardian';safeStore(BUILD_SPACE_KEY,state);}location.href='./paradox-build-space/';}

document.addEventListener('astrix:guardian-selection-changed',e=>rememberGuardian(e.detail||{}));
document.addEventListener('astrix:bungie-loadout-loaded',e=>rememberExplicitLoadout(e.detail||{}));
document.addEventListener('astrix:paradox-live-analysis-changed',e=>rememberAnalysis(e.detail||{}));
document.addEventListener('astrix:weapon-roll-advice-changed',e=>rememberWeaponAdvice(e.detail||{}));
document.addEventListener('astrix:artifact-selection-changed',e=>rememberArtifactSelection(e.detail||{}));
document.addEventListener('click',openBuildSpace,true);
export {compactBuild,resolveBuildSource,BUILD_SPACE_KEY,LAST_LOADOUT_KEY};
