const BUILD_STATE_VERSION = 1;
const VALIDATION_STATUS = Object.freeze({UNTESTED:'untested',INITIAL:'initial-result',PROVISIONAL:'provisionally-validated',REPEATED:'repeatedly-validated',INVALIDATED:'not-validated'});
function clone(value){try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}}
function freezeDeep(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(freezeDeep);return value;}
function itemIdentity(item){if(!item)return null;return String(item.itemInstanceId||item.instanceId||item.hash||item.bungieHash||item.name||'');}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;}
function createIntendedArtifactConfiguration(candidate={},previous=null){
  const embedded=candidate?.artifactConfiguration&&typeof candidate.artifactConfiguration==='object'?candidate.artifactConfiguration:{};
  const prior=previous&&typeof previous==='object'?previous:{};
  const selectedSource=Array.isArray(embedded.selectedPerkHashes)?embedded.selectedPerkHashes:Array.isArray(candidate?.selectedPerkHashes)?candidate.selectedPerkHashes:Array.isArray(candidate?.activePerks)?candidate.activePerks.map(item=>item?.hash??item?.bungieHash??item?.itemHash):Array.isArray(prior.selectedPerkHashes)?prior.selectedPerkHashes:null;
  const selectedPerkHashes=Array.isArray(selectedSource)?[...new Set(selectedSource.map(numberOrNull).filter(value=>value!==null))]:null;
  const upstream=embedded.provenance&&typeof embedded.provenance==='object'?clone(embedded.provenance):prior.provenance&&typeof prior.provenance==='object'?clone(prior.provenance):null;
  return {schemaVersion:1,artifactHash:numberOrNull(candidate?.artifactHash??candidate?.hash??candidate?.bungieHash??embedded.artifactHash??prior.artifactHash),seasonNumber:numberOrNull(candidate?.seasonNumber??candidate?.artifactSeason??embedded.seasonNumber??prior.seasonNumber),selectedPerkHashes,source:'paradox-build-space-intended',provenance:{provider:'paradox-forge',path:'workingBuild.artifactConfiguration',state:'intended',derivedFrom:String(candidate?.source||embedded.source||prior.source||'resolved-artifact-option'),upstream}};
}
function toggleIntendedArtifactPerk(artifact={},previous=null,index=-1){
  const configuration=createIntendedArtifactConfiguration(artifact,previous);
  const perk=Array.isArray(artifact?.perks)?artifact.perks[index]:null;
  const hash=numberOrNull(perk?.hash??perk?.bungieHash??perk?.itemHash);
  if(hash===null)return configuration;
  const selected=new Set(Array.isArray(configuration.selectedPerkHashes)?configuration.selectedPerkHashes:[]);
  if(selected.has(hash))selected.delete(hash);else selected.add(hash);
  return {...configuration,selectedPerkHashes:[...selected]};
}
function restoreWorkingBuild(state={}){
  if(!state?.originalBuild)return state;
  return {...state,workingBuild:clone(state.originalBuild),recommendation:null};
}
function normalizeBuild(build={}){return {...clone(build),version:BUILD_STATE_VERSION,characterId:String(build.characterId||''),selectedLoadoutIndex:Number.isInteger(build.selectedLoadoutIndex)?build.selectedLoadoutIndex:null,subclassBuild:clone(build.subclassBuild||{}),artifact:clone(build.artifact||null),artifactConfiguration:clone(build.artifactConfiguration||build.artifact?.artifactConfiguration||null),weapons:Array.isArray(build.weapons)?clone(build.weapons):[],armour:Array.isArray(build.armour)?clone(build.armour):[],stats:Array.isArray(build.stats)?clone(build.stats):[],paradoxAnalysis:clone(build.paradoxAnalysis||null),weaponRollAdvice:clone(build.weaponRollAdvice||null),locks:clone(build.locks||{}),objective:build.objective||null,activityContext:clone(build.activityContext||null)};}
function createBuildState(sourceBuild){const normalized=normalizeBuild(sourceBuild||{});const original=freezeDeep(clone(normalized));return {version:BUILD_STATE_VERSION,createdAt:new Date().toISOString(),originalBuild:original,workingBuild:clone(normalized),recommendation:null,validationRecords:[]};}
function diffSlot(prefix,before,after,index){const a=itemIdentity(before);const b=itemIdentity(after);if(a===b)return null;return {path:`${prefix}.${index}`,before:clone(before),after:clone(after),beforeId:a,afterId:b};}
function diffBuilds(original={},working={}){const changes=[];['subclass','subclassName'].forEach(path=>{if(String(original?.[path]??'')!==String(working?.[path]??''))changes.push({path,before:original?.[path]??null,after:working?.[path]??null});});const a=original.subclassBuild||{},b=working.subclassBuild||{};if(itemIdentity(a.super)!==itemIdentity(b.super))changes.push({path:'subclassBuild.super',before:clone(a.super),after:clone(b.super),beforeId:itemIdentity(a.super),afterId:itemIdentity(b.super)});['abilities','aspects','fragments'].forEach(key=>{const left=Array.isArray(a[key])?a[key]:[],right=Array.isArray(b[key])?b[key]:[],count=Math.max(left.length,right.length);for(let i=0;i<count;i++){const c=diffSlot(`subclassBuild.${key}`,left[i],right[i],i);if(c)changes.push(c);}});for(const key of ['weapons','armour']){const left=Array.isArray(original[key])?original[key]:[],right=Array.isArray(working[key])?working[key]:[],count=Math.max(left.length,right.length);for(let i=0;i<count;i++){const c=diffSlot(key,left[i],right[i],i);if(c)changes.push(c);}}return changes;}
function createValidationRecord({build,testId=null,targetActivity='Vanguard Master Operation',objective=null}={}){const snapshot=normalizeBuild(build||{});return {schemaVersion:1,testId:testId||`PF-TEST-${Date.now()}`,createdAt:new Date().toISOString(),status:VALIDATION_STATUS.UNTESTED,targetActivity,objective:objective||snapshot.objective||null,characterId:snapshot.characterId,selectedLoadoutIndex:snapshot.selectedLoadoutIndex,buildSnapshot:freezeDeep(clone(snapshot)),activityInstanceId:null,pgcr:null,buildIntegrity:'unverified',baseline:null,outcome:null};}
export {BUILD_STATE_VERSION,VALIDATION_STATUS,clone,freezeDeep,itemIdentity,createIntendedArtifactConfiguration,toggleIntendedArtifactPerk,restoreWorkingBuild,normalizeBuild,createBuildState,diffBuilds,createValidationRecord};
