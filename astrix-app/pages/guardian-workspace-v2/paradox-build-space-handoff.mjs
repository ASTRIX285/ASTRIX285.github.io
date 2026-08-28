import {clone,createBuildState} from './paradox-build-space/paradox-build-state.mjs';
import {markGuardianFastReturn} from './guardian-session-cache.mjs';
import {bindingOf,createHandoffEnvelope,validateHandoffEnvelope} from './paradox-build-binding.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const BUILD_SNAPSHOT_KEY='astrix:guardian-build-snapshot:v1';
const LAST_LOADOUT_KEY='astrix:paradox-last-bungie-loadout:v1';
const SELECTED_CHARACTER_KEY='astrix:selected-character-id';
let latestGuardian=null;
let latestExplicitLoadout=null;
let activeCharacterId='';
const safeStore=(key,value,{durable=false}={})=>{const json=JSON.stringify(createHandoffEnvelope(value));let stored=false;try{sessionStorage.setItem(key,json);stored=true;}catch{}if(durable)try{localStorage.setItem(key,json);stored=true;}catch{}return stored;};
const safeRead=(key,options={})=>{for(const [store,durable] of [[sessionStorage,false],[localStorage,true]]){try{const parsed=JSON.parse(store.getItem(key)||'null');const value=validateHandoffEnvelope(parsed,{...options,allowLegacy:!durable});if(value)return value;if(parsed)store.removeItem(key);}catch{}}return null;};

function compactBuild(detail={}){
  const subclassBuild=detail.subclassBuild&&typeof detail.subclassBuild==='object'?detail.subclassBuild:{
    super:detail.super||null,superOptions:detail.superOptions||[],abilities:detail.abilities||[],abilityOptionsBySocket:detail.abilityOptionsBySocket||{},availableAbilities:detail.availableAbilities||[],aspects:detail.aspects||[],availableAspects:detail.availableAspects||[],fragments:detail.fragments||[],availableFragments:detail.availableFragments||[],transcendenceOptions:detail.transcendenceOptions||[],transcendenceSlots:detail.transcendenceSlots||[]
  };
  const superItem=detail.super??subclassBuild.super??null;
  const abilities=Array.isArray(detail.abilities)?detail.abilities:(Array.isArray(subclassBuild.abilities)?subclassBuild.abilities:[]);
  const aspects=Array.isArray(detail.aspects)?detail.aspects:(Array.isArray(subclassBuild.aspects)?subclassBuild.aspects:[]);
  const fragments=Array.isArray(detail.fragments)?detail.fragments:(Array.isArray(subclassBuild.fragments)?subclassBuild.fragments:[]);
  return {
    version:1,capturedAt:new Date().toISOString(),
    source:detail.selectedLoadoutIndex!=null?'bungie-loadout':(detail.source||'current-guardian'),
    characterId:String(detail.characterId||''),membershipId:String(detail.membershipId||detail.bungieMembershipId||detail.membership?.membershipId||''),membershipType:String(detail.membershipType||detail.membership?.membershipType||''),characterClass:detail.characterClass||'',displayName:detail.displayName||'Guardian',
    selectedLoadoutIndex:Number.isInteger(detail.selectedLoadoutIndex)?detail.selectedLoadoutIndex:null,
    subclass:detail.subclass||'',subclassName:detail.subclassName||'',subclassIcon:detail.subclassIcon||'',subclassCatalog:clone(detail.subclassCatalog||[]),
    subclassBuild:clone({...subclassBuild,super:superItem,abilities,aspects,fragments}),super:clone(superItem),abilities:clone(abilities),aspects:clone(aspects),fragments:clone(fragments),artifact:clone(detail.artifact||null),artifactConfiguration:clone(detail.artifactConfiguration||detail.artifact?.artifactConfiguration||null),weapons:clone(detail.weapons||[]),armour:clone(detail.armour||[]),mods:clone(detail.mods||detail.armourMods||[]),
    loadoutsAvailable:detail.loadoutsAvailable===true,loadouts:clone(detail.loadouts||[]),
    stats:clone(detail.stats||[]),hashCoverage:clone(detail.hashCoverage||null),semanticCoverage:clone(detail.semanticCoverage||null),coverage:clone(detail.coverage||null),paradoxAnalysis:clone(detail.paradoxAnalysis||null),
    locks:{},objective:null,activityContext:null
  };
}
function rememberGuardian(detail={}){
  const characterId=String(detail?.characterId||selectedCharacterId());
  if(!characterId)return;
  latestGuardian=compactBuild({...detail,characterId});
  activeCharacterId=characterId;
  const isExplicit=Number.isInteger(detail.selectedLoadoutIndex);
  if(isExplicit){latestExplicitLoadout=clone(latestGuardian);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});return;}
  if(latestExplicitLoadout&&String(latestExplicitLoadout.characterId)!==String(detail.characterId))latestExplicitLoadout=null;
}
function rememberExplicitLoadout(detail={}){const characterId=String(detail?.characterId||selectedCharacterId());if(!characterId||!Number.isInteger(detail.selectedLoadoutIndex))return;latestExplicitLoadout=compactBuild({...detail,characterId});activeCharacterId=characterId;safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function matchesSelection(build,detail={}){if(!build)return false;const characterId=String(detail.characterId||activeCharacterId||'');if(!characterId||String(build.characterId)!==characterId)return false;if(Object.prototype.hasOwnProperty.call(detail,'selectedLoadoutIndex'))return Number(build.selectedLoadoutIndex??-1)===Number(detail.selectedLoadoutIndex??-1);return true;}
function rememberAnalysis(analysis={}){if(matchesSelection(latestGuardian,analysis))latestGuardian.paradoxAnalysis=clone(analysis);if(matchesSelection(latestExplicitLoadout,analysis)){latestExplicitLoadout.paradoxAnalysis=clone(analysis);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}}
function rememberWeaponAdvice(advice={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!matchesSelection(build,advice))continue;build.weaponRollAdvice=clone(advice);for(const row of advice.recommendations||[]){const weapon=build.weapons?.find(item=>String(item?.itemInstanceId||"")===String(row.itemInstanceId||""));if(weapon)weapon.weaponRollAdvice=clone(row);}}if(matchesSelection(latestExplicitLoadout,advice))safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function activePerksFromArtifactEvent(detail={},build={}){const state=String(detail.state||detail.artifact?.state||build.artifact?.state||'');if(state==='state-unavailable')return null;if(Array.isArray(detail.perks))return clone(detail.perks);return clone(build.artifact?.activePerks??null);}
function rememberArtifactSelection(detail={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!matchesSelection(build,detail))continue;build.artifactConfiguration=clone(detail.artifactConfiguration||null);if(detail.artifact)build.artifact={...clone(build.artifact||{}),...clone(detail.artifact),state:detail.state||build.artifact?.state,activePerks:activePerksFromArtifactEvent(detail,build),artifactConfiguration:clone(detail.artifactConfiguration||null)};}if(matchesSelection(latestExplicitLoadout,detail))safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function rememberActiveCharacter(detail={}){const characterId=String(detail.characterId||'');if(characterId)activeCharacterId=characterId;}
function selectedCharacterId(){
  const selectedCard=globalThis.document?.querySelector?.('#guardianCharacterCards [data-character-id].is-selected, #guardianCharacterCards [data-character-id][aria-pressed="true"]');
  const visibleId=String(selectedCard?.dataset?.characterId||'');
  let storedId='';
  try{storedId=String(sessionStorage.getItem(SELECTED_CHARACTER_KEY)||'');}catch{}
  return visibleId||activeCharacterId||storedId;
}
function bindSourceToCharacter(source,characterId=''){
  if(!source)return null;
  const selectedId=String(characterId||''),sourceId=bindingOf(source).characterId;
  if(sourceId&&selectedId&&sourceId!==selectedId)return null;
  const resolvedId=sourceId||selectedId;
  return resolvedId?{...clone(source),characterId:resolvedId}:null;
}
function resolveBuildSource(){
  const selectedId=selectedCharacterId();
  const candidates=[];
  if(latestGuardian&&Number.isInteger(latestGuardian.selectedLoadoutIndex))candidates.push(latestGuardian);
  if(latestExplicitLoadout&&latestGuardian&&String(latestExplicitLoadout.characterId)===String(latestGuardian.characterId))candidates.push(latestExplicitLoadout);
  candidates.push(latestGuardian,latestExplicitLoadout);
  for(const candidate of candidates){const bound=bindSourceToCharacter(candidate,selectedId);if(bound)return bound;}
  const remembered=safeRead(LAST_LOADOUT_KEY);
  return bindSourceToCharacter(remembered,selectedId);
}
function currentProfileBuildSource(){
  const selectedId=selectedCharacterId();
  const state=safeRead(BUILD_SNAPSHOT_KEY,{expectedCharacterId:selectedId});
  return bindSourceToCharacter(state?.workingBuild||state?.originalBuild||null,selectedId);
}
function armBuildSpacePortal(){globalThis.AstrixLoader?.mount?.();globalThis.AstrixLoader?.set?.(0);globalThis.AstrixLoader?.status?.('Opening Build Forge');}
const afterPortalPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function openBuildSpace(event){
  const button=event.target?.closest?.('.improve-cta');
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  // guardian-bungie-profile persists the currently painted, post-enrichment
  // build earlier in this same capture phase. Prefer it over an older in-memory
  // listener snapshot so every resolved armour set and socket crosses intact.
  const source=currentProfileBuildSource()||resolveBuildSource(),characterId=bindingOf(source).characterId;
  if(!source||!characterId){
    console.error('[ASTRIX Build Forge] A selected Guardian with a resolved characterId is required.');
    document.dispatchEvent(new CustomEvent('astrix:build-handoff-error',{detail:{message:'Select a loaded Guardian before opening Build Forge.'}}));
    return;
  }
  armBuildSpacePortal();
  let target='./paradox-build-space/';
  if(source){
    const boundSource={...source,characterId},state=createBuildState(boundSource),binding=bindingOf(state.originalBuild);
    if(!binding.characterId||binding.characterId!==characterId||bindingOf(state.workingBuild).characterId!==characterId){console.error('[ASTRIX Build Forge] Build binding could not be preserved.');return;}
    state.sourcePriority=source.source==='bungie-loadout'?'selected-or-last-bungie-loadout':'current-equipped-guardian';
    if(!safeStore(BUILD_SPACE_KEY,state,{durable:true})){
      globalThis.AstrixLoader?.status?.('Build snapshot could not be secured');
      document.dispatchEvent(new CustomEvent('astrix:build-handoff-error',{detail:{message:'Build Forge could not secure the current Guardian snapshot on this device.'}}));
      return;
    }
    const params=new URLSearchParams();
    params.set('characterId',binding.characterId);
    if(binding.membershipId)params.set('membershipId',binding.membershipId);
    if(binding.membershipType)params.set('membershipType',binding.membershipType);
    const query=params.toString();
    if(query)target+='?'+query;}
  await afterPortalPaint();
  markGuardianFastReturn();location.href=target;
}

document.addEventListener('astrix:guardian-selection-changed',e=>rememberGuardian(e.detail||{}));
document.addEventListener('astrix:character-selected',e=>rememberActiveCharacter(e.detail||{}));
document.addEventListener('astrix:bungie-loadout-loaded',e=>rememberExplicitLoadout(e.detail||{}));
document.addEventListener('astrix:paradox-live-analysis-changed',e=>rememberAnalysis(e.detail||{}));
document.addEventListener('astrix:weapon-roll-advice-changed',e=>rememberWeaponAdvice(e.detail||{}));
document.addEventListener('astrix:artifact-selection-changed',e=>rememberArtifactSelection(e.detail||{}));
document.addEventListener('click',openBuildSpace,true);
export {compactBuild,rememberGuardian,rememberExplicitLoadout,rememberWeaponAdvice,rememberArtifactSelection,resolveBuildSource,currentProfileBuildSource,BUILD_SPACE_KEY,BUILD_SNAPSHOT_KEY,LAST_LOADOUT_KEY};
