import {clone,createBuildState} from './paradox-build-space/paradox-build-state.mjs';

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const LAST_LOADOUT_KEY='astrix:paradox-last-bungie-loadout:v1';
let latestGuardian=null;
let latestExplicitLoadout=null;
const safeStore=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
const safeRead=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};

function compactBuild(detail={}){
  return {
    version:1,capturedAt:new Date().toISOString(),
    source:detail.selectedLoadoutIndex!=null?'bungie-loadout':(detail.source||'current-guardian'),
    characterId:String(detail.characterId||''),characterClass:detail.characterClass||'',displayName:detail.displayName||'Guardian',
    selectedLoadoutIndex:Number.isInteger(detail.selectedLoadoutIndex)?detail.selectedLoadoutIndex:null,
    subclass:detail.subclass||'',subclassName:detail.subclassName||'',subclassIcon:detail.subclassIcon||'',
    subclassBuild:clone(detail.subclassBuild||{}),artifact:clone(detail.artifact||null),weapons:clone(detail.weapons||[]),armour:clone(detail.armour||[]),
    stats:clone(detail.stats||[]),hashCoverage:clone(detail.hashCoverage||null),semanticCoverage:clone(detail.semanticCoverage||null),coverage:clone(detail.coverage||null),paradoxAnalysis:clone(detail.paradoxAnalysis||null),
    locks:{},objective:null,activityContext:null
  };
}
function rememberGuardian(detail={}){if(detail?.characterId)latestGuardian=compactBuild(detail);}
function rememberExplicitLoadout(detail={}){if(!detail?.characterId||!Number.isInteger(detail.selectedLoadoutIndex))return;latestExplicitLoadout=compactBuild(detail);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}
function rememberAnalysis(analysis={}){const matches=build=>build&&String(build.characterId)===String(analysis.characterId)&&Number(build.selectedLoadoutIndex??-1)===Number(analysis.selectedLoadoutIndex??-1);if(matches(latestGuardian))latestGuardian.paradoxAnalysis=clone(analysis);if(matches(latestExplicitLoadout)){latestExplicitLoadout.paradoxAnalysis=clone(analysis);safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}}
function rememberWeaponAdvice(advice={}){for(const build of [latestGuardian,latestExplicitLoadout]){if(!build)continue;build.weaponRollAdvice=clone(advice);for(const row of advice.recommendations||[]){const weapon=build.weapons?.find(item=>String(item?.itemInstanceId||"")===String(row.itemInstanceId||""));if(weapon)weapon.weaponRollAdvice=clone(row);}}if(latestExplicitLoadout)safeStore(LAST_LOADOUT_KEY,latestExplicitLoadout);}
function resolveBuildSource(){if(latestExplicitLoadout)return clone(latestExplicitLoadout);const remembered=safeRead(LAST_LOADOUT_KEY);if(remembered?.characterId)return remembered;if(latestGuardian)return clone(latestGuardian);return null;}
function openBuildSpace(event){const button=event.target?.closest?.('.improve-cta');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const source=resolveBuildSource();if(source){const state=createBuildState(source);state.sourcePriority=source.source==='bungie-loadout'?'selected-or-last-bungie-loadout':'current-equipped-guardian';safeStore(BUILD_SPACE_KEY,state);}location.href='./paradox-build-space/';}

document.addEventListener('astrix:guardian-selection-changed',e=>rememberGuardian(e.detail||{}));
document.addEventListener('astrix:bungie-loadout-loaded',e=>rememberExplicitLoadout(e.detail||{}));
document.addEventListener('astrix:paradox-live-analysis-changed',e=>rememberAnalysis(e.detail||{}));
document.addEventListener('astrix:weapon-roll-advice-changed',e=>rememberWeaponAdvice(e.detail||{}));
document.addEventListener('click',openBuildSpace,true);
export {compactBuild,resolveBuildSource,BUILD_SPACE_KEY,LAST_LOADOUT_KEY};
