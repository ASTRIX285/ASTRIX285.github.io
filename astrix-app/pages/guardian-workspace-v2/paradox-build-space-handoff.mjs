import {clone,createBuildState} from './paradox-build-space/paradox-build-state.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const LAST_LOADOUT_KEY='astrix:paradox-last-bungie-loadout:v1';
const HANDOFF_SCHEMA=2;
const HANDOFF_TTL_MS=30*60*1000;
let latestGuardian=null;
let latestExplicitLoadout=null;
let activeCharacterId='';
const bindingOf=value=>({membershipId:String(value?.membershipId||value?.bungieMembershipId||value?.membership?.membershipId||''),membershipType:String(value?.membershipType||value?.membership?.membershipType||''),characterId:String(value?.characterId||'')});
const safeStore=(key,value,{durable=false}={})=>{const envelope={schemaVersion:HANDOFF_SCHEMA,savedAt:Date.now(),binding:bindingOf(value?.originalBuild||value),payload:value};const json=JSON.stringify(envelope);try{sessionStorage.setItem(key,json);}catch{}if(durable)try{localStorage.setItem(key,json);}catch{}};
const validEnvelope=(envelope,{expectedCharacterId='',allowLegacy=false}={})=>{if(!envelope||typeof envelope!=='object')return null;if(envelope.schemaVersion!==HANDOFF_SCHEMA)return allowLegacy&&envelope.characterId?envelope:null;if(!envelope.payload||Date.now()-Number(envelope.savedAt||0)>HANDOFF_TTL_MS)return null;const binding=envelope.binding||{},payloadBinding=bindingOf(envelope.payload?.originalBuild||envelope.payload);if(!binding.characterId||binding.characterId!==payloadBinding.characterId)return null;if(expectedCharacterId&&binding.characterId!==String(expectedCharacterId))return null;return envelope.payload;};
const safeRead=(key,options={})=>{for(const [store,durable] of [[sessionStorage,false],[localStorage,true]]){try{const parsed=JSON.parse(store.getItem(key)||'null');const value=validEnvelope(parsed,{...options,allowLegacy:!durable});if(value)return value;if(parsed)store.removeItem(key);}catch{}}return null;};

function compactBuild(detail={}){
  return {
    version:1,capturedAt:new Date().toISOString(),
    source:detail.selectedLoadoutIndex!=null?'bungie-loadout':(detail.source||'current-guardian'),
    characterId:String(detail.characterId||''),membershipId:String(detail.membershipId||detail.bungieMembershipId||detail.membership?.membershipId||''),membershipType:String(detail.membershipType||detail.membership?.membershipType||''),characterClass:detail.characterClass||'',displayName:detail.displayName||'Guardian',
    selectedLoadoutIndex:Number.isInteger(detail.selectedLoadoutIndex)?detail.selectedLoadoutIndex:null,
    subclass:detail.subclass||'',subclassName:detail.subclassName||'',subclassIcon:detail.subclassIcon||'',
    subclassBuild:clone(detail.subclassBuild||{}),artifact:clone(detail.artifact||null),artifactConfiguration:clone(detail.artifactConfiguration||detail.artifact?.artifactConfiguration||null),weapons:clone(detail.weapons||[]),armour:clone(detail.armour||[]),
    stats:clone(detail.stats||[]),hashCoverage:clone(detail.hashCoverage||null),semanticCoverage:clone(detail.semanticCoverage||null),coverage:clone(detail.coverage||null),paradoxAnalysis:clone(detail.paradoxAnalysis||null),
    locks:{},objective:null,activityContext:null
  };
}
function rememberGuardian(detail={}){if(detail?.characterId){latestGuardian=compactBuild(detail);activeCharacterId=String(detail.characterId);}}
function rememberExplicitLoadout(detail={}){if(!detail?.characterId||!Number.isInteger(detail.selectedLoadoutIndex))return;latestExplicitLoadout=compactBuild(detail);activeCharacterId=String(detail.characterId);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function rememberAnalysis(analysis={}){const matches=build=>build&&String(build.characterId)===String(analysis.characterId)&&Number(build.selectedLoadoutIndex??-1)===Number(analysis.selectedLoadoutIndex??-1);if(matches(latestGuardian))latestGuardian.paradoxAnalysis=clone(analysis);if(matches(latestExplicitLoadout)){latestExplicitLoadout.paradoxAnalysis=clone(analysis);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}}
function matchesSelection(build,detail={}){if(!build)return false;const characterId=String(detail.characterId||activeCharacterId||'');if(!characterId||String(build.characterId)!==characterId)return false;if(Object.prototype.hasOwnProperty.call(detail,'selectedLoadoutIndex'))return Number(build.selectedLoadoutIndex??-1)===Number(detail.selectedLoadoutIndex??-1);return true;}
function rememberWeaponAdvice(advice={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!matchesSelection(build,advice))continue;build.weaponRollAdvice=clone(advice);for(const row of advice.recommendations||[]){const weapon=build.weapons?.find(item=>String(item?.itemInstanceId||"")===String(row.itemInstanceId||""));if(weapon)weapon.weaponRollAdvice=clone(row);}}if(matchesSelection(latestExplicitLoadout,advice))safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function rememberArtifactSelection(detail={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!matchesSelection(build,detail))continue;build.artifactConfiguration=clone(detail.artifactConfiguration||null);if(detail.artifact)build.artifact={...clone(build.artifact||{}),...clone(detail.artifact),state:detail.state||build.artifact?.state,activePerks:clone(detail.perks||build.artifact?.activePerks||[]),artifactConfiguration:clone(detail.artifactConfiguration||null)};}if(matchesSelection(latestExplicitLoadout,detail))safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout,{durable:true});}
function resolveBuildSource(){if(latestGuardian){if(latestExplicitLoadout&&matchesSelection(latestExplicitLoadout,latestGuardian))return clone(latestExplicitLoadout);return clone(latestGuardian);}if(latestExplicitLoadout)return clone(latestExplicitLoadout);const remembered=safeRead(LAST_LOADOUT_KEY);return remembered?.characterId?remembered:null;}
function openBuildSpace(event){const button=event.target?.closest?.('.improve-cta');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const source=resolveBuildSource();let target='./paradox-build-space/';if(source){const state=createBuildState(source);state.sourcePriority=source.source==='bungie-loadout'?'selected-or-last-bungie-loadout':'current-equipped-guardian';safeStore(BUILD_SPACE_KEY,state,{durable:true});const binding=bindingOf(source),params=new URLSearchParams();if(binding.characterId)params.set('characterId',binding.characterId);if(binding.membershipId)params.set('membershipId',binding.membershipId);const query=params.toString();if(query)target+='?'+query;}location.href=target;}

document.addEventListener('astrix:guardian-selection-changed',e=>rememberGuardian(e.detail||{}));
document.addEventListener('astrix:bungie-loadout-loaded',e=>rememberExplicitLoadout(e.detail||{}));
document.addEventListener('astrix:paradox-live-analysis-changed',e=>rememberAnalysis(e.detail||{}));
document.addEventListener('astrix:weapon-roll-advice-changed',e=>rememberWeaponAdvice(e.detail||{}));
document.addEventListener('astrix:artifact-selection-changed',e=>rememberArtifactSelection(e.detail||{}));
document.addEventListener('click',openBuildSpace,true);
export {compactBuild,rememberGuardian,rememberExplicitLoadout,rememberWeaponAdvice,rememberArtifactSelection,resolveBuildSource,BUILD_SPACE_KEY,LAST_LOADOUT_KEY};
