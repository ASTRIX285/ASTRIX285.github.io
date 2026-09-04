import {diffBuilds,createBuildState,createIntendedArtifactConfiguration,toggleIntendedArtifactPerk,protectBuildState,restoreWorkingBuild} from './paradox-build-state.mjs?v=20260904-memory-safe-transfer-1';
import {mountForgeShell} from '../platform-forge-shell.mjs';
import {armBuildTest,collectBuildTestResults,confirmCandidateActivity,captureMatchesCharacter,readCapture,readCaptureArchive} from '../guardian-shooting-range-capture.mjs?v=20260902-shared-account-orbit-1';
import {analyzeLiveGuardian,renderLiveAnalysis} from '../guardian-paradox-live-adapter.mjs';
import {createLiveTransferPlan} from '../guardian-perk-change-plan.mjs?v=20260904-weapon-model-2';
import {armourCard} from '../guardian-gear-layout.mjs?v=20260904-weapon-model-2';
import {renderWeapons,weaponPerkMatrixMarkup,weaponTraitHierarchyMarkup} from '../guardian-semantic-ui.mjs?v=20260904-weapon-model-2';
import {adviseLiveWeaponRolls} from '../guardian-weapon-roll-advisor.mjs?v=20260904-weapon-model-2';
import {renderEquippedSubclass,renderSubclassPicker,renderSuperFormation} from '../guardian-super-formation.mjs?v=20260829-subclass-identity-1';
import {mergeSubclassCatalog,mergeSuperOptions} from '../guardian-super-catalog.mjs?v=20260829-subclass-identity-1';
import {markGuardianFastReturn,readForgeLoaderTransfer} from '../guardian-session-cache.mjs?v=20260904-atomic-forge-transfer-1';
import {guardianManifest} from '../guardian-manifest-service.mjs?v=20260904-artifact-sandbox-effects-1';
import {AUTH_ORIGIN} from '../guardian-bungie-auth.mjs?v=20260902-shared-account-orbit-1';
import {HANDOFF_SCHEMA,bindingOf,bindingsEqual,createHandoffEnvelope,validateHandoffEnvelope} from '../paradox-build-binding.mjs';
import {applyVaultArmourSelection,clearVaultArmourSelection,readVaultArmourSelection,validateVaultArmourSelection} from '../../vault/vault-selection-state.mjs?v=20260904-exotic-equip-rule-1';
import {applyForgeArtifactRecommendation} from './paradox-artifact-selection.mjs?v=20260904-cross-system-loop-1';
import {BUILD_ELEMENTS,validateTierFiveArmour} from './paradox-build-recommendation.mjs';
import {composeForgeRecommendation,filterExoticCompatibleSubclasses,hasVerifiedSubclassSockets,synchroniseSubclassProjection} from './paradox-forge-intelligence.mjs?v=20260904-exotic-anchor-1';
import {createLiveTransferPreflight,deriveLoadoutIntent,recommendArmourMods,selectOwnedWeapons,validateArmourModLoadout,validateExoticLoadout,validateLoadoutCoherence} from './paradox-loadout-intelligence.mjs?v=20260904-weapon-model-2';
import '../guardian-character-cards.mjs?v=20260824-bungie-icons-3';
import '../guardian-loadouts.mjs';
import '../guardian-bungie-profile.mjs?v=20260904-weapon-model-2';
import '../guardian-portal-progress.mjs?v=20260904-atomic-forge-transfer-1';
import '../guardian-vault-access.mjs?v=20260902-forge-loader-1';

mountForgeShell({rootSelector:'.build-space',gameId:'destiny-2',gameName:'Destiny 2',developerName:'Bungie'});

const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const BUILD_SNAPSHOT_KEY='astrix:guardian-build-snapshot:v1';
const LOAD_STAGES=Object.freeze({SNAPSHOT:20,VALIDATE:40,PROFILE:58,SOCKETS:74,ARTIFACT:88,READY:100});
const BUNGIE='https://www.bungie.net';
const byId=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const abs=path=>path?(String(path).startsWith('http')?path:`${BUNGIE}${path}`):'';
const iconOf=item=>item?.icon||item?.definition?.displayProperties?.icon||item?.displayProperties?.icon||'';
const elementOf=item=>{const text=[item?.element,item?.damageType,item?.name,item?.displayName,item?.definition?.itemTypeDisplayName,...(item?.definition?.traitIds||[])].filter(Boolean).join(' ').toLowerCase();return ['stasis','arc','strand','void','solar','prismatic'].find(value=>text.includes(value))||'unknown';};
const isPrismaticBuild=build=>[build?.subclass,build?.subclassName,build?.subclassBuild?.name].filter(Boolean).join(' ').toLowerCase().includes('prismatic');
let activeLoadError='';
let testDomain='pve';
let buildRenderSequence=0;
let volatileState=null;
let volatileStateMemoryOnly=false;
let artifactSeasonRequest=null;
let selectedRecommendationElement='';
let selectedRecommendationObjective='';
let recommendationBusy=false;
function validateBuildState(state,expectedBinding={},{protect=true}={}){
  if(!state||state.version!==1||!state.originalBuild||!state.workingBuild)return null;
  const originalBinding=bindingOf(state.originalBuild),workingBinding=bindingOf(state.workingBuild);
  if(!originalBinding.characterId||!bindingsEqual(originalBinding,workingBinding))return null;
  const expected=bindingOf(expectedBinding);
  if(expected.characterId&&expected.characterId!==originalBinding.characterId)return null;
  if(expected.membershipId&&expected.membershipId!==originalBinding.membershipId)return null;
  if(expected.membershipType&&expected.membershipType!==originalBinding.membershipType)return null;
  return protect?protectBuildState(state):state;
}
function decodeState(raw,{durable=false,expectedBinding={}}={}){
  if(!raw||typeof raw!=='object')return null;
  if(raw.schemaVersion===HANDOFF_SCHEMA){
    const payload=validateHandoffEnvelope(raw);
    const state=payload?.originalBuild?payload:(payload?.characterId?createBuildState(payload):null);
    return state?validateBuildState(state,expectedBinding):null;
  }
  return durable?null:validateBuildState(raw,expectedBinding);
}
function readState(){
  activeLoadError='';
  const params=new URLSearchParams(location.search),expectedCharacterId=params.get('characterId')||'',expectedMembershipId=params.get('membershipId')||'',expectedMembershipType=params.get('membershipType')||'';
  const expectedBinding={characterId:expectedCharacterId,membershipId:expectedMembershipId,membershipType:expectedMembershipType};
  if(volatileState){const state=validateBuildState(volatileState,expectedBinding,{protect:false});if(state)return state;volatileState=null;volatileStateMemoryOnly=false;}
  // The explicit Character -> Build handoff contains the post-enrichment armour
  // state (including resolved set bonuses). The generic profile snapshot is a
  // recovery fallback only and must not replace that selected build.
  for(const key of [BUILD_SPACE_KEY,BUILD_SNAPSHOT_KEY]){
    for(const [store,durable] of [[sessionStorage,false],[localStorage,true]]){
      try{
        const raw=JSON.parse(store.getItem(key)||'null'),state=decodeState(raw,{durable,expectedBinding});
        if(state){
          volatileState=state;
          volatileStateMemoryOnly=false;
          if(key===BUILD_SNAPSHOT_KEY){writeState(state,{memoryOnly:false});for(const target of [sessionStorage,localStorage]){try{target.removeItem(BUILD_SNAPSHOT_KEY);}catch{}}}
          return state;
        }
        if(raw)store.removeItem(key);
      }
      catch{activeLoadError='The protected Build Forge snapshot could not be read on this device.';}
    }
  }
  activeLoadError=activeLoadError||(params.get('baseline')==='bungie-recovery'?'Recovering the protected Original Build from the authenticated Bungie profile.':'No current Build Forge snapshot was found. Return to the Guardian page and choose Improve My Guardian again.');
  return null;
}
function emitLoad(stage,percent,label,status='loading',message=''){
  window.AstrixLoader?.set(percent);
  window.AstrixLoader?.status(message||label);
  window.dispatchEvent(new CustomEvent('astrix:build-load-progress',{detail:{stage,percent,label,status,message}}));
}
document.addEventListener('astrix:manifest-progress',event=>{
  window.AstrixLoader?.set(Number(event.detail?.percent)||12);
  window.AstrixLoader?.status(event.detail?.label||'Preparing Bungie manifest');
});
function tile(item){if(!item)return '<span class="icon-tile empty">◆</span>';const icon=abs(iconOf(item)),name=esc(item.name||'Destiny item');return `<span class="icon-tile" title="${name}">${icon?`<img src="${esc(icon)}" alt="${name}">`:'◆'}</span>`;}
function weaponCardShell(index){return `<div class="weap"><div class="art ph"><span class="ph-glyph">⌖</span></div><div class="cap"><b>Weapon slot ${index+1}</b><small>Awaiting resolved weapon semantics</small></div></div>`;}
function gearCard(item,fallback){const index=Math.max(0,(Number(String(fallback).match(/\d+/)?.[0])||1)-1);return String(fallback).startsWith('Weapon')?weaponCardShell(index):armourCard(index,item);}
function blankArmourModCanvas(){
  const blankSlots=Array.from({length:6},()=>'<button class="gear-mod is-recommendation-pending" type="button" title="AI recommendation pending" aria-label="AI recommendation pending" disabled><span class="ph-glyph" aria-hidden="true">◇</span></button>').join('');
  document.querySelectorAll('#armourGrid .gear-mods').forEach(grid=>{grid.classList.add('is-recommendation-pending');grid.dataset.modPresentation='pending';grid.setAttribute('aria-label','Blank AI mod recommendation canvas');grid.innerHTML=blankSlots;});
}
function renderArmourRecommendationState(build={}){
  const generated=Boolean(build.recommendationGeneratedAt),state=byId('armourBuildState'),instruction=byId('armourBuildInstruction'),evidence=byId('armourBuildEvidence');
  if(state)state.textContent=generated?'PARADOX RECOMMENDATION · REVIEW REQUIRED':'STAGED ARMOUR · MOD PLAN PENDING';
  if(instruction)instruction.textContent=generated?'AI mod plan generated · review the recommendation before live action':'Blank recommendation canvas · select an elemental build and generate the AI sequence';
  if(evidence)evidence.textContent=generated?'Original and installed mods remain protected':'Installed mods retained as evaluation evidence';
  if(!generated)blankArmourModCanvas();
}
function renderBuildGear(build={}){byId('weaponGrid').innerHTML=Array.from({length:3},(_,i)=>gearCard(build.weapons?.[i],`Weapon slot ${i+1}`)).join('');byId('armourGrid').innerHTML=Array.from({length:5},(_,i)=>gearCard(build.armour?.[i],`Armour slot ${i+1}`)).join('');renderArmourRecommendationState(build);renderWeapons(build.weapons||[]);byId('weaponRecommendationState').textContent=build.recommendationGeneratedAt?'PARADOX VERIFIED SELECTION':'GENERATE TO RECOMMEND';}
function currentBuild(){const state=readState();return state?.workingBuild||state?.originalBuild||null;}

function verifiedActivities(build,domain=testDomain){
  const sources=[build?.availableActivities,build?.activityCatalog?.activities,build?.catalog?.activities].find(Array.isArray)||[];
  return sources.filter(row=>{
    if(row?.source&&row.source!=='bungie-definition')return false;
    const declared=String(row?.domain||row?.testDomain||row?.activityModeCategory||'').toLowerCase();
    if(declared)return declared===domain;
    if(typeof row?.isPvP==='boolean')return domain==='pvp'?row.isPvP:!row.isPvP;
    return false;
  }).filter(row=>Number(row?.hash||row?.activityHash||row?.activityTypeHash||row?.mode)>0);
}
function selectedExpectedActivity(){const node=byId('expectedActivity'),row=verifiedActivities(currentBuild()).find(item=>String(item.hash||item.activityHash||item.activityTypeHash||item.mode)===node?.value);return row?{activityHash:Number(row.activityHash||row.hash)||null,activityTypeHash:Number(row.activityTypeHash)||null,mode:Number(row.mode)||null,mapHash:Number(row.mapHash)||null,modifierHashes:Array.isArray(row.modifierHashes)?row.modifierHashes:[],name:String(row.name||row.displayName||'Bungie activity'),source:'bungie-definition'}:null;}
function renderTestConfiguration(){const build=currentBuild(),node=byId('expectedActivity'),rows=verifiedActivities(build),destination=byId('expectedDestination'),destinationApi=globalThis.AstrixDestinations;if(destination&&destinationApi){destination.innerHTML=destinationApi.options().map(option=>'<option value="'+esc(option.key)+'">'+esc(option.label.toUpperCase())+'</option>').join('');destination.value=destinationApi.current();}if(node){node.innerHTML='<option value="">ANY COMPLETED ACTIVITY</option>'+rows.map(row=>'<option value="'+esc(row.hash||row.activityHash||row.activityTypeHash||row.mode)+'">'+esc(row.name||row.displayName||'Bungie activity '+(row.hash||row.activityHash))+'</option>').join('');}byId('testDomainLabel').textContent=testDomain.toUpperCase()+' BUILD TEST';byId('calibrationOption').hidden=testDomain!=='pve';byId('testContextNote').textContent=testDomain==='pvp'?'Crucible modes appear only when resolved from current Bungie activity definitions. Map and modifier context can attach to the same verified intake contract.':'Select a verified PvE activity, leave Any Activity selected, or use optional Shooting Range calibration.';document.querySelectorAll('[data-test-domain]').forEach(button=>{const active=button.dataset.testDomain===testDomain;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});}

function writeState(next,{memoryOnly=volatileStateMemoryOnly}={}){
  const state=protectBuildState(next);
  volatileState=state;
  volatileStateMemoryOnly=Boolean(memoryOnly);
  // The atomic IndexedDB handoff remains the refresh fallback. Keeping its
  // expanded Original + Working pair in memory avoids another very large JSON
  // allocation and duplicate Web Storage copies on the Build Forge page.
  if(volatileStateMemoryOnly)return true;
  let json='';
  try{json=JSON.stringify(createHandoffEnvelope(state));}
  catch{volatileStateMemoryOnly=true;return false;}
  let stored=false;
  for(const store of [sessionStorage,localStorage]){try{store.setItem(BUILD_SPACE_KEY,json);stored=true;}catch{}}
  if(!stored)volatileStateMemoryOnly=true;
  return stored;
}
function requestedTransferBinding(){const params=new URLSearchParams(location.search);return {characterId:params.get('characterId')||'',membershipId:params.get('membershipId')||'',membershipType:params.get('membershipType')||''};}
async function restoreAtomicForgeTransfer(){
  if(new URLSearchParams(location.search).get('vault')!=='selection')return null;
  const binding=requestedTransferBinding(),transfer=await readForgeLoaderTransfer(binding);
  if(!transfer)return null;
  const source=validateHandoffEnvelope(transfer.snapshotEnvelope,{expectedCharacterId:binding.characterId,expectedMembershipId:binding.membershipId,expectedMembershipType:binding.membershipType});
  const selection=validateVaultArmourSelection(transfer.armourSelection,{expectedBinding:binding});
  if(!source||!selection)return null;
  const baseline=source?.originalBuild?validateBuildState(source,binding):createBuildState(source);
  const applied=applyVaultArmourSelection(baseline,selection);
  if(!applied.applied)return null;
  writeState(applied.state,{memoryOnly:true});
  clearVaultArmourSelection();
  return volatileState;
}
function applyPendingVaultSelection(state){
  if(!state?.originalBuild||!state?.workingBuild||new URLSearchParams(location.search).get('vault')!=='selection')return state;
  const expectedBinding=bindingOf(state);
  const selection=readVaultArmourSelection({expectedBinding});
  if(!selection)return state;
  const result=applyVaultArmourSelection(state,selection);
  if(!result.applied)return state;
  try{
    const analysis=analyzeLiveGuardian(result.state.workingBuild);
    result.state.workingBuild.paradoxAnalysis=analysis||null;
  }catch(error){
    result.state.workingBuild.paradoxAnalysis=null;
    console.error('Build Forge retained the protected Forge Loader selection after PARADOX analysis failed.',error);
  }
  clearVaultArmourSelection();
  return result.state;
}
function switchBuildCharacter(detail={}){if(detail?.source!=="bungie-live"||!detail.characterId)return;const current=readState(),currentBinding=bindingOf(current||{}),isProtectedForgeTransfer=new URLSearchParams(location.search).get('vault')==='selection'&&current?.workingBuild?.forgeLoaderDecision&&currentBinding.characterId===String(detail.characterId);if(isProtectedForgeTransfer)return;const requested=requestedTransferBinding(),boundDetail={...detail,membershipId:detail.membershipId||requested.membershipId,membershipType:detail.membershipType??requested.membershipType};const next=applyPendingVaultSelection(createBuildState(boundDetail));writeState(next,{memoryOnly:false});render();}
function recoverMissingBuild(detail={}){if(detail?.source!=="bungie-live"||!detail.characterId||readState())return;switchBuildCharacter(detail);}
function settleBuildImage(image){if(!image?.src||image.hidden||image.closest('[hidden]')||image.complete)return Promise.resolve();return Promise.race([typeof image.decode==='function'?image.decode().catch(()=>{}):new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}),new Promise(resolve=>setTimeout(resolve,5000))]);}
function completeBuildRender(build){
  const sequence=++buildRenderSequence;
  requestAnimationFrame(()=>requestAnimationFrame(async()=>{
    if(sequence!==buildRenderSequence)return;
    const images=[...document.querySelectorAll('.build-space img,.build-character-selector img')].filter(image=>!image.closest('[hidden]'));
    await Promise.all(images.map(settleBuildImage));
    if(sequence!==buildRenderSequence)return;
    guardianManifest.ready().finally(()=>{
      if(sequence!==buildRenderSequence)return;
      const ready=Boolean(build),status=ready?'ready':'pending',label=ready?'Build Forge rendered':'Waiting for authenticated Guardian build';
      emitLoad('render',ready?LOAD_STAGES.READY:LOAD_STAGES.SNAPSHOT,label,status);
      document.dispatchEvent(new CustomEvent('astrix:build-render-complete',{detail:{status,characterId:String(build?.characterId||''),selectedLoadoutIndex:Number.isInteger(build?.selectedLoadoutIndex)?build.selectedLoadoutIndex:null,renderedImages:images.filter(image=>image.complete&&image.naturalWidth>0).length}}));
    });
  }));
}
const list=(...values)=>values.find(Array.isArray)||[];
function resolvedSubclassOptions(build){const options=list(build?.subclassCatalog,build?.availableSubclasses,build?.subclassOptions,build?.resolvedSubclasses,build?.catalog?.subclasses);const current={name:build?.subclassName||build?.subclass||'Subclass',element:build?.subclass,icon:build?.subclassIcon,subclassBuild:build?.subclassBuild};return mergeSubclassCatalog(options.length?options:[current],build?.characterClass||'hunter');}
function resolvedOptions(build,kind){const sb=build?.subclassBuild||{},cap=kind[0].toUpperCase()+kind.slice(1),pluralCap=kind==='super'?'Supers':kind==='artifact'?'Artifacts':cap,equipped=kind==='super'?[sb.super].filter(Boolean):kind==='artifact'?[build.artifact].filter(Boolean):list(sb[kind],build?.[kind]),options=list(sb['available'+cap],sb['available'+pluralCap],sb[kind+'Options'],build?.['available'+cap],build?.['available'+pluralCap],build?.[kind+'Options'],build?.resolvedOptions?.[kind]),merged=[...equipped,...options].filter(Boolean);if(kind==='super')return mergeSuperOptions(build?.characterClass||'hunter',build?.subclass||build?.subclassName||'',merged);return merged.filter((item,index,all)=>{const key=item?.hash??item?.itemHash??item?.name??iconOf(item);return all.findIndex(other=>(other?.hash??other?.itemHash??other?.name??iconOf(other))===key)===index;});}
function itemKey(item){return String(item?.hash??item?.itemHash??item?.name??iconOf(item)??'');}
function selectorCard(item,{kind,index,selected=false,recommended=false}={}){const icon=abs(iconOf(item)),name=esc(item?.name||item?.displayName||'Resolved option'),element=elementOf(item);return '<button type="button" class="selector-card element-'+element+(selected?' is-selected':'')+(recommended?' is-recommended':'')+'" data-select-kind="'+esc(kind)+'" data-select-index="'+index+'" title="'+name+' · select to stage in Working Build">'+(icon?'<img src="'+esc(icon)+'" alt="">':'<span class="selector-glyph">◆</span>')+'<small>'+name+'</small></button>';}
function unavailableCard(label='Evidence unavailable'){return '<button type="button" class="selector-card is-unavailable" disabled title="Bungie did not supply a verified option for this slot"><span class="selector-glyph">◇</span><small>'+esc(label)+'</small></button>';}
function fillUnavailable(markup,count,label){return markup.concat(Array.from({length:Math.max(0,count-markup.length)},()=>unavailableCard(label)));}
function abilityGroups(build,equipped){const groups=build?.subclassBuild?.abilityOptionsBySocket||{},all=resolvedOptions(build,'abilities'),labels=[['classAbility','CLASS ABILITY'],['movement','MOVEMENT'],['melee','MELEE'],['grenade','GRENADE']];return labels.map(([key,label])=>{const options=Array.isArray(groups[key])?groups[key]:[],cards=options.map(item=>{const index=all.findIndex(value=>itemKey(value)===itemKey(item));return selectorCard(item,{kind:'abilities',index,selected:equipped.some(value=>itemKey(value)===itemKey(item))});});return '<section class="ability-option-group" data-ability-socket="'+esc(key)+'"><h4>'+label+'</h4><div class="socket-options">'+(cards.length?cards.join(''):unavailableCard(label+' unavailable'))+'</div></section>';}).join('');}
function artifactRecommendationMap(recommendation){return new Map((recommendation?.recommendations||[]).map(row=>[String(row?.artifactPerk?.hash),row]));}
function artifactPerkCard(perk,index,{compact=false,selected=null,recommended=false,recommendation=null}={}){
  const icon=abs(iconOf(perk)),name=esc(perk?.name||'Artifact perk'),description=esc(perk?.description||perk?.definition?.displayProperties?.description||'Verified Bungie Artifact perk');
  const active=selected===null?perk?.isActive===true:selected===true,liveActive=perk?.isActive===true,locked=!active&&(perk?.isVisible===false||perk?.tierUnlocked===false),reason=esc(recommendation?.reasons?.[0]?.label||'');
  const classes=['selector-card','artifact-perk',active?'is-selected':'',recommended?'is-recommended-choice':'',liveActive?'was-live-active':'',locked?'is-locked':'',compact?'is-compact':''].filter(Boolean).join(' ');
  const recommendationLabel=recommended?'<span class="artifact-best-badge">BEST</span>':'';
  return '<button type="button" class="'+classes+'" data-select-kind="artifactPerks" data-select-index="'+index+'" '+(locked?'disabled':'')+' title="'+name+' — '+description+(reason?' — PARADOX fit: '+reason:'')+'" data-evidence-name="'+name+'" data-evidence-description="'+description+'">'+recommendationLabel+(icon?'<img src="'+esc(icon)+'" alt="">':'<span class="selector-glyph">◆</span>')+'<small>'+name+'</small></button>';
}
function artifactRecommendationMarkup(build){
  const recommendation=build?.artifactRecommendation;
  if(!build?.forgeLoaderDecision)return '<div class="artifact-recommendation is-neutral"><b>FORGE LOADER INPUT REQUIRED</b><small>Load a staged Forge Loader result to calculate an Artifact fit.</small></div>';
  if(!recommendation)return '<div class="artifact-recommendation is-neutral"><b>VERIFYING CURRENT ARTIFACT</b><small>Checking the active Bungie season and legal perk matrix.</small></div>';
  if(recommendation.userOverride)return '<div class="artifact-recommendation is-manual"><b>MANUAL WORKING SELECTION</b><small>Your staged Artifact choices are preserved. The live Guardian remains unchanged.</small><button type="button" data-artifact-recommend>RESTORE PARADOX BEST FIT</button></div>';
  if(recommendation.selectionStatus!=='ready'){
    const blocker=esc(recommendation.blockers?.[0]||'A complete verified Artifact match is not available.');
    return '<div class="artifact-recommendation is-blocked"><b>BEST FIT NOT STAGED</b><small>'+blocker+' The live Guardian remains unchanged.</small><button type="button" data-artifact-recommend>CHECK VERIFIED ARTIFACT</button></div>';
  }
  const selected=new Set((recommendation.selectedPerkHashes||[]).map(String));
  const strongest=(recommendation.recommendations||[]).filter(row=>row?.selected&&selected.has(String(row?.artifactPerk?.hash))).slice(0,3);
  const reasons=strongest.map(row=>'<li><b>'+esc(row.artifactPerk?.name||'Artifact perk')+'</b><span>'+esc(row.reasons?.[0]?.label||'Verified Forge Loader compatibility')+'</span></li>').join('');
  const artifactChoice=recommendation.artifactCandidateCount>1?esc(`${recommendation.artifactName||'Artifact'} · best of ${recommendation.artifactCandidateCount} verified Artifacts`):esc(recommendation.artifactName||'Verified Artifact');
  const fullTarget=recommendation.planMode==='full-build-target';
  const planLabel=fullTarget?'PARADOX FULL TARGET PLAN':'PARADOX BEST VERIFIED FIT';
  const planDetail=fullTarget
    ?'This complete target plan is ranked from the current verified Artifact perk tree even when Bungie reports no unused unlock points. Apply the picks in game as they become available. Working Build only · currently unlocked and equipped perks remain unchanged.'
    :'Artifact 2.0 is ranked from its verified socket buckets, then each bucket is filled from the staged Exotic, stat priorities, armour-set traits, subclass/Super and weapons. Working Build only · currently unlocked and equipped perks remain unchanged.';
  return '<div class="artifact-recommendation is-ready"><div><b>'+planLabel+'</b><span>'+artifactChoice+' · '+Number(recommendation.selectedMatchedCount||0)+' OF '+Number(recommendation.selectionLimit||0)+' PICKS DIRECTLY MATCH</span></div>'+(reasons?'<ol>'+reasons+'</ol>':'')+'<small>'+planDetail+'</small><button type="button" data-artifact-recommend>RECALCULATE BEST FIT</button></div>';
}
function artifactMatrix(artifact,configuration,recommendation){
  const perks=Array.isArray(artifact?.perks)?artifact.perks:[];
  if(!perks.length)return '<div class="artifact-spectrum-unavailable"><b>FULL PERK SPECTRUM UNRESOLVED</b><small>Requires verified Artifact socket-bucket or CharacterProgressions perk definitions from Bungie.</small></div>';
  const selected=new Set((Array.isArray(configuration?.selectedPerkHashes)?configuration.selectedPerkHashes:[]).map(String)),ranked=artifactRecommendationMap(recommendation),automatic=recommendation?.selectionStatus==='ready'&&!recommendation?.userOverride,tiers=new Map();
  perks.forEach((perk,index)=>{const tier=Number.isInteger(perk?.tierIndex)?perk.tierIndex:0;if(!tiers.has(tier))tiers.set(tier,[]);tiers.get(tier).push({perk,index});});
  const artifactTwo=artifact?.availabilityModel==='artifact-2-socket-buckets';
  return [...tiers.entries()].sort((a,b)=>a[0]-b[0]).map(([tier,rows])=>{const requirement=Number(rows[0]?.perk?.minimumUnlockPointsUsedRequirement??rows[0]?.perk?.pointsToUnlock),capacity=Number(artifact?.selectionSlots?.find(slot=>Number(slot?.tierIndex)===tier)?.capacity??rows[0]?.perk?.bucketCapacity),tierTitle=esc(rows[0]?.perk?.tierTitle||((artifactTwo?'BUCKET ':'TIER ')+(tier+1))),suffix=artifactTwo&&Number.isFinite(capacity)?` · ${capacity} PICKS`:Number.isFinite(requirement)&&requirement>0?' · '+requirement+' PRIOR PICKS':'';return '<section class="artifact-tier" data-artifact-tier="'+tier+'"><h4>'+tierTitle+suffix+'</h4><div class="artifact-tier-perks">'+rows.sort((a,b)=>(a.perk.itemIndex||0)-(b.perk.itemIndex||0)).map(row=>{const key=String(row.perk?.hash),detail=ranked.get(key);return artifactPerkCard(row.perk,row.index,{selected:selected.has(key),recommended:automatic&&selected.has(key),recommendation:detail});}).join('')+'</div></section>';}).join('');
}
function stageWorkingBuild(mutator){const state=readState();if(!state?.originalBuild)return;const working=JSON.parse(JSON.stringify(state.workingBuild||state.originalBuild));mutator(working);writeState({...state,workingBuild:working});render();}
async function fetchCurrentArtifactSeason(){
  if(!artifactSeasonRequest){
    artifactSeasonRequest=fetch(new URL('/bungie/current-season',AUTH_ORIGIN),{credentials:'include',headers:{Accept:'application/json'}}).then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload?.error||`Current season request failed (${response.status}).`);const seasonNumber=Number(payload?.season?.seasonNumber);return Number.isInteger(seasonNumber)?seasonNumber:null;}).catch(error=>{console.info('[ASTRIX Artifact] Current season verification is temporarily unavailable.',error);return null;});
  }
  const pending=artifactSeasonRequest,result=await pending;
  if(artifactSeasonRequest===pending)artifactSeasonRequest=null;
  return result;
}
async function refreshForgeArtifactRecommendation({force=false}={}){
  const state=readState(),build=state?.workingBuild;
  if(!build?.forgeLoaderDecision)return;
  if(build.artifactRecommendation?.userOverride&&!force)return;
  const supplied=Number(build.currentSeasonNumber??build.currentSeason?.seasonNumber),currentSeasonNumber=Number.isInteger(supplied)?supplied:await fetchCurrentArtifactSeason();
  const result=applyForgeArtifactRecommendation(state,{currentSeasonNumber,force});
  if(result.state!==state)writeState(result.state);
  render();
}
function replaceEquipped(collection,candidate){const next=[...(collection||[])],slot=Number.isInteger(candidate?.slotIndex)?candidate.slotIndex:Number.isInteger(candidate?.slot)?candidate.slot:-1,type=String(candidate?.abilityType||candidate?.type||candidate?.category||'').toLowerCase();let index=slot>=0?slot:next.findIndex(item=>type&&String(item?.abilityType||item?.type||item?.category||'').toLowerCase()===type);if(index<0)index=0;if(next.length)next[index]=candidate;else next.push(candidate);return next;}
function applySubclassCandidate(working,candidate){working.subclassBuild=working.subclassBuild||{};working.subclassName=candidate.name||candidate.displayName||working.subclassName;working.subclass=candidate.key||candidate.element||candidate.name||working.subclass;working.subclassIcon=iconOf(candidate)||working.subclassIcon;if(candidate.subclassBuild||candidate.build)working.subclassBuild=JSON.parse(JSON.stringify(candidate.subclassBuild||candidate.build));return synchroniseSubclassProjection(working);}
function resolvedTranscendenceSlots(build){const sb=build?.subclassBuild||{},mapped=Array.isArray(sb.transcendenceSlots)?sb.transcendenceSlots.filter(Boolean):[];if(mapped.length)return mapped.slice(0,2);return (Array.isArray(sb.transcendenceOptions)?sb.transcendenceOptions:[]).filter(Boolean).slice(0,2).map((item,socketIndex)=>({socketIndex,equipped:item,options:[item]}));}
function transcendenceChoices(build){return resolvedTranscendenceSlots(build).flatMap((slot,slotPosition)=>(Array.isArray(slot?.options)?slot.options:[]).map(option=>({...option,transcendenceSlotPosition:slotPosition})));}
function stageSelection(kind,index){const build=currentBuild(),candidate=kind==='subclass'?resolvedSubclassOptions(build)[index]:kind==='artifactPerks'?build?.artifact?.perks?.[index]:kind==='transcendence'?transcendenceChoices(build)[index]:resolvedOptions(build,kind)[index];if(!candidate)return;stageWorkingBuild(working=>{working.subclassBuild=working.subclassBuild||{};delete working.recommendationGeneratedAt;delete working.recommendationElement;delete working.recommendationStatus;delete working.forgeIntelligence;if(kind==='subclass')applySubclassCandidate(working,candidate);else if(kind==='super'){working.subclassBuild.super=candidate;working.super=candidate;}else if(kind==='transcendence'){const slots=[...(working.subclassBuild.transcendenceSlots||[])],slotPosition=Number(candidate.transcendenceSlotPosition);if(slots[slotPosition])slots[slotPosition]={...slots[slotPosition],equipped:candidate};working.subclassBuild.transcendenceSlots=slots;}else if(kind==='abilities')working.subclassBuild.abilities=replaceEquipped(working.subclassBuild.abilities,candidate);else if(kind==='aspects')working.subclassBuild.aspects=replaceEquipped(working.subclassBuild.aspects,candidate);else if(kind==='fragments'){const equipped=[...(working.subclassBuild.fragments||[])],key=itemKey(candidate),at=equipped.findIndex(item=>itemKey(item)===key);if(at>=0)equipped.splice(at,1);else if(equipped.length<5)equipped.push(candidate);else equipped[0]=candidate;working.subclassBuild.fragments=equipped;}else if(kind==='artifactPerks'){working.artifactConfiguration=toggleIntendedArtifactPerk(working.artifact,working.artifactConfiguration||working.artifact?.artifactConfiguration,index);working.artifact.artifactConfiguration=JSON.parse(JSON.stringify(working.artifactConfiguration));if(working.artifactRecommendation)working.artifactRecommendation={...working.artifactRecommendation,userOverride:true};}else if(kind==='artifact'){const configuration=createIntendedArtifactConfiguration(candidate,working.artifactConfiguration||working.artifact?.artifactConfiguration);working.artifact={...JSON.parse(JSON.stringify(candidate)),artifactConfiguration:JSON.parse(JSON.stringify(configuration))};working.artifactConfiguration=configuration;}synchroniseSubclassProjection(working);});}

function renderRecommendationControls(build={}){
  const verified=resolvedSubclassOptions(build).filter(hasVerifiedSubclassSockets),verifiedElements=new Set(verified.map(elementOf)),compatible=filterExoticCompatibleSubclasses(build,verified),supported=new Map(compatible.map(item=>[elementOf(item),item]).filter(([element])=>BUILD_ELEMENTS.includes(element)));
  const active=elementOf({element:build.subclass||build.subclassName||''}),hasDecision=Boolean(build.forgeLoaderDecision);
  if(!hasDecision)selectedRecommendationElement='';
  else if(!selectedRecommendationElement||!supported.has(selectedRecommendationElement))selectedRecommendationElement=supported.has(active)?active:(supported.keys().next().value||'');
  const elementButtons=[...document.querySelectorAll('[data-recommendation-element]')],elementGrid=byId('recommendationElements');
  elementGrid?.classList.toggle('has-multiple-options',hasDecision&&supported.size>1);
  elementButtons.forEach(button=>{const element=button.dataset.recommendationElement,available=hasDecision&&supported.has(element),selected=available&&element===selectedRecommendationElement;button.disabled=!available||recommendationBusy;button.classList.toggle('is-available',available);button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));button.title=!hasDecision?'Stage a verified Forge Loader armour result first.':available?`Evaluate a verified ${element} damage build with the staged Exotic armour result.`:verifiedElements.has(element)?`The selected Exotic armour perk is not compatible with the verified ${element} subclass components.`:`No verified ${element} build option is available for this Guardian.`;});
  if(!['balanced','dps','add-clear','survivability','ability-uptime'].includes(selectedRecommendationObjective))selectedRecommendationObjective=build.objective||'balanced';document.querySelectorAll('[data-build-objective]').forEach(button=>{const selected=button.dataset.buildObjective===selectedRecommendationObjective;button.disabled=!hasDecision||recommendationBusy;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));});
  const armourValidation=validateTierFiveArmour(build),exoticValidation=validateExoticLoadout(build,{requireArmourAnchor:true}),hasElement=Boolean(selectedRecommendationElement&&supported.has(selectedRecommendationElement)),ready=hasDecision&&armourValidation.ready&&exoticValidation.ready&&hasElement&&!recommendationBusy,button=byId('generateMaxLoadout'),status=byId('recommendationReadiness');
  if(button){button.disabled=!ready;button.textContent=recommendationBusy?'GENERATING VERIFIED BUILD…':build.recommendationGeneratedAt?'REGENERATE MAX LOADOUT':'GENERATE MAX LOADOUT';}
  if(status){status.className='recommendation-readiness'+(ready?' is-ready':' is-blocked');status.textContent=recommendationBusy?'Resolving elemental damage, weapon and Artifact evidence…':!hasDecision?'Stage a verified Forge Loader armour result to unlock compatible build options.':!armourValidation.ready?armourValidation.reason:!exoticValidation.ready?exoticValidation.reason:!hasElement?'Select an available verified elemental build option.':`Ready · ${selectedRecommendationElement.toUpperCase()} damage build · one verified Exotic armour anchor · Maximized Forge Loader result.`;}
}

function reviewIcon(item,label='Verified item'){const icon=abs(iconOf(item)),name=esc(item?.name||item?.displayName||label);return `<span class="review-icon" title="${name}">${icon?`<img src="${esc(icon)}" alt="">`:'◆'}<small>${name}</small></span>`;}
function decisionReasonText(row={}){const reason=row.reasons?.[0];return reason?.label||`${row.componentName||'Verified component'} retained because no resolved alternative proved a stronger directed evidence score.`;}
function reviewModIdentity(item,label='EMPTY'){if(!item)return `<span class="review-mod-empty">${esc(label)}</span>`;const icon=abs(iconOf(item)),name=esc(item?.name||label);return `<span class="review-mod-identity" title="${name}">${icon?`<img src="${esc(icon)}" alt="">`:'◆'}<b>${name}</b></span>`;}
function renderModRecommendation(build={}){
  const host=byId('recommendedModPlan'),plan=build.armourModRecommendation;if(!host)return;
  if(!plan){host.innerHTML='<div class="review-mod-unavailable">No verified armour-mod plan was generated.</div>';return;}
  const stats=plan.projectedStats||{},raw=stats.raw||{},current=stats.currentTotal||{},recommended=stats.recommendedTotal||{};
  const statRows=['health','melee','grenade','super','class','weapon'].map(key=>`<span><small>${esc(key.toUpperCase())}</small><b>${Number(raw[key]||0)}</b><i>${Number(current[key]||0)}</i><strong>${Number(recommended[key]||0)}</strong></span>`).join('');
  const changedItems=(plan.items||[]).map(item=>({...item,decisions:(item.decisions||[]).filter(row=>row.action!=='KEEP')})).filter(item=>item.decisions.length);
  const itemRows=changedItems.map(item=>`<article class="review-mod-item"><header><b>${esc(item.itemName)}</b><span>${item.projectedUsed==null?'ENERGY UNRESOLVED':`${item.projectedUsed}/${item.capacity} ENERGY`}</span></header><div>${item.decisions.map(row=>`<div class="review-mod-decision is-${String(row.action||'change').toLowerCase()}"><em>${esc(row.action)}</em><span class="review-mod-swap">${reviewModIdentity(row.current)}<i>→</i>${reviewModIdentity(row.recommended)}</span><small>${esc(row.reasons?.[0]?.label||`${row.verifiedOptions} verified insertable option${row.verifiedOptions===1?'':'s'} evaluated.`)}</small></div>`).join('')}</div></article>`).join('');
  const changeCount=Number(plan.summary?.replace||0)+Number(plan.summary?.add||0)+Number(plan.summary?.remove||0),changeSummary=[`${changeCount} PROPOSED MOD CHANGE${changeCount===1?'':'S'}`,plan.summary?.replace?`${Number(plan.summary.replace)} REPLACE`:'',plan.summary?.add?`${Number(plan.summary.add)} ADD`:'',plan.summary?.remove?`${Number(plan.summary.remove)} REMOVE`:''].filter(Boolean).join(' · ');
  host.innerHTML=`<div class="review-mod-summary"><div><b>RAW → CURRENT → RECOMMENDED</b><span>Forge Loader raw stats remain mod-free. Installed and proposed mod contributions are evaluated separately.</span></div><div class="review-mod-stats">${statRows}</div><small>${changeSummary}</small></div><div class="review-mod-items">${itemRows||'<div class="review-mod-no-changes">No verified mod change improves this Working Build.</div>'}</div>${plan.limitations?.length?`<ul class="review-mod-limitations">${plan.limitations.slice(0,5).map(row=>`<li>${esc(row)}</li>`).join('')}</ul>`:''}`;
}
function renderForgeDecision(build={}){
  const label=byId('forgeDecisionLabel'),detail=byId('forgeDecisionDetail'),listNode=byId('forgeDecisionReasons'),decision=build.forgeIntelligence;
  if(!label||!detail||!listNode)return;
  if(!build.forgeLoaderDecision){label.textContent='AWAITING ARMOUR EVIDENCE';detail.textContent='Stage a verified Forge Loader result to begin armour-led build reasoning.';listNode.innerHTML='<li>No component choice is claimed before generation.</li>';return;}
  if(!decision){const anchor=build.forgeLoaderDecision?.buildAnchor?.perk?.name||build.forgeLoaderDecision?.buildAnchor?.name||'verified Exotic',setName=build.forgeLoaderDecision?.setProtocol?.[0]?.setName||build.forgeLoaderDecision?.setProtocol?.[0]?.trait?.name||'verified armour-set protocol';label.textContent='ARMOUR EVIDENCE STAGED';detail.textContent='Generate Max Loadout to compare only the verified subclass catalogue against this Forge Loader result.';listNode.innerHTML=`<li>${esc(anchor)} anchors the recommendation.</li><li>${esc(setName)} is carried into the evidence score.</li>`;return;}
  const evidence=decision.evidence||{},coverage=decision.prismaticCoverage,rows=(decision.decisions||[]).filter(row=>row.score>0).slice(0,3);label.textContent=`${String(decision.element||'VERIFIED').toUpperCase()} BUILD READY FOR REVIEW`;detail.textContent=`${Number(evidence.directedLinks||0)} directed evidence link${Number(evidence.directedLinks||0)===1?'':'s'} · ${decision.decisions?.length||0} verified subclass component decisions${coverage?` · ${coverage.covered.length}/5 Prismatic elements evidenced`:''}.`;
  listNode.innerHTML=(rows.length?rows:(decision.decisions||[]).slice(0,3)).map(row=>`<li>${esc(decisionReasonText(row))}</li>`).join('')||(decision.limitations||[]).slice(0,2).map(row=>`<li>${esc(row)}</li>`).join('')||'<li>The verified equipped configuration remains the safest evidence-bound result.</li>';
}
function renderRecommendedBuildReview(build={}){
  const subclass=resolvedSubclassOptions(build).find(item=>elementOf(item)===elementOf({element:build.subclass||build.subclassName||''})),superItem=build.subclassBuild?.super||build.super,abilities=build.subclassBuild?.abilities||[],aspects=build.subclassBuild?.aspects||[],fragments=build.subclassBuild?.fragments||[],anchor=build.forgeLoaderDecision?.buildAnchor||{},anchorName=anchor.name||'VERIFIED EXOTIC',anchorPerk=anchor.perk||null,exoticRule=validateExoticLoadout(build,{requireArmourAnchor:true});
  byId('recommendedBuildSubtitle').textContent=`${String(build.characterClass||'Guardian').toUpperCase()} · ${String(build.recommendationElement||build.subclassName||build.subclass||'verified subclass').toUpperCase()} · ${String(build.objective||'balanced').toUpperCase()} · EXOTIC ANCHOR: ${String(anchorName).toUpperCase()}`;
  byId('recommendedSubclassSummary').innerHTML=`<div class="review-subclass-identity">${reviewIcon(subclass,'Subclass')}<div><b>${esc(build.subclassName||build.subclass||'VERIFIED SUBCLASS')}</b><span>${esc(superItem?.name||'SUPER NOT RESOLVED')}</span></div></div><div class="review-socket-group"><b>ABILITIES</b><div>${abilities.map(item=>reviewIcon(item,'Ability')).join('')||'<small>NO VERIFIED ABILITIES</small>'}</div></div><div class="review-socket-group"><b>ASPECTS</b><div>${aspects.map(item=>reviewIcon(item,'Aspect')).join('')||'<small>NO VERIFIED ASPECTS</small>'}</div></div><div class="review-socket-group"><b>FRAGMENTS</b><div>${fragments.map(item=>reviewIcon(item,'Fragment')).join('')||'<small>NO VERIFIED FRAGMENTS</small>'}</div></div>`;
  const intelligenceHost=byId('recommendedIntelligenceSummary'),decisions=build.forgeIntelligence?.decisions||[],matched=decisions.filter(row=>row.score>0).slice(0,4),reviewRows=matched.length?matched:decisions.slice(0,4),anchorReason=`EXOTIC ANCHOR · ${anchorName}${anchorPerk?.name?` · ${anchorPerk.name}`:''} drives the subclass, stat, mod, Artifact and weapon ranking.`;if(intelligenceHost)intelligenceHost.innerHTML=`<li>${esc(anchorReason)}</li>`+(reviewRows.map(row=>`<li>${esc(decisionReasonText(row))}</li>`).join('')||(build.forgeIntelligence?.limitations||[]).map(row=>`<li>${esc(row)}</li>`).join('')||'<li>No additional intelligence claim is available for this snapshot.</li>');
  const armourHost=byId('recommendedArmourSummary')?.querySelector('.gear-columns');if(armourHost)armourHost.innerHTML=Array.from({length:5},(_,index)=>armourCard(index,build.armour?.[index])).join('');
  const armourRule=byId('armourExoticRule');if(armourRule)armourRule.textContent=`DESTINY EQUIP RULE · ${exoticRule.exoticArmourCount}/1 EXOTIC ARMOUR`;
  renderModRecommendation(build);
  const advice=build.weaponRollAdvice||build.paradoxAnalysis?.weaponRollAdvice,recommendations=new Map((advice?.recommendations||[]).map(row=>[String(row.itemInstanceId||row.weaponHash||''),row]));
  const weaponSelections=new Map((build.weaponSelectionRecommendation?.decisions||[]).map(row=>[String(row.bucketHash),row])),weaponConstraint=build.weaponSelectionRecommendation?.constraints||{},weaponRule=byId('weaponExoticRule');
  if(weaponRule)weaponRule.textContent=`OWNED VAULT + CHARACTER INVENTORY · ${Number(weaponConstraint.selectedExoticWeaponCount||0)}/1 EXOTIC WEAPON`;
  byId('recommendedWeaponsSummary').innerHTML=Array.from({length:3},(_,index)=>{
    const item=build.weapons?.[index];
    if(!item)return '<article class="review-weapon is-unresolved"><b>WEAPON SLOT '+(index+1)+'</b><small>Verified instance unavailable</small></article>';
    const key=String(item.itemInstanceId||item.hash||item.bungieHash||''),row=item.weaponRollAdvice||recommendations.get(key),options=row?.best?.options||[],recommendedHashes=options.map(option=>Number(option?.hash)).filter(Number.isInteger),selection=weaponSelections.get(String(item.bucketHash)),decisionLabel=selection?.action==='KEEP'?'CURRENT BEST FIT':(selection?.action||'CURRENT BEST FIT'),model=item.weaponSemantics?.perkModel||item.weaponPerkModel||{},tier=Number(model.weaponTier??item.weaponSemantics?.gearTier??item.gearTier),rowCount=Math.max(1,Number(model.expectedRowCount||item.weaponPerkRowCount)||1),perkMatrix=weaponPerkMatrixMarkup(item,{recommendedHashes}),traitHierarchy=weaponTraitHierarchyMarkup(item,{compact:true});
    return `<article class="review-weapon"><div>${reviewIcon(item,'Weapon')}<span><b>${esc(item.name||`Weapon ${index+1}`)}</b><small>${esc(item.itemTypeDisplayName||item.weaponType||'Verified owned weapon')}</small><em>${esc(decisionLabel)} · ${Number(selection?.candidateCount||0)} OWNED CANDIDATES</em></span></div><div class="review-weapon-tier-model"><b>${Number.isInteger(tier)&&tier>0?`TIER ${tier}`:'TIER UNRESOLVED'} · ${rowCount} PERK ROW${rowCount===1?'':'S'}</b>${perkMatrix||'<small>NO VERIFIED PERK MODEL</small>'}${traitHierarchy}</div><p>${esc(selection?.reasons?.[0]?.label||'Exact owned instance retained; no stronger explicit synergy evidence was proven.')}</p></article>`;
  }).join('');
  const artifact=build.artifact,recommendation=build.artifactRecommendation,selected=new Set((build.artifactConfiguration?.selectedPerkHashes||recommendation?.selectedPerkHashes||[]).map(String)),perkByHash=new Map((artifact?.perks||[]).map(perk=>[String(perk?.hash??perk?.itemHash??perk?.bungieHash),perk])),sequence=(recommendation?.selectionSequence||[]).filter(row=>selected.has(String(row?.artifactPerk?.hash))).sort((a,b)=>Number(a.order)-Number(b.order)),perks=sequence.length?sequence.map(row=>perkByHash.get(String(row.artifactPerk?.hash))||row.artifactPerk):(artifact?.perks||[]).filter(perk=>selected.has(String(perk?.hash??perk?.itemHash??perk?.bungieHash))),selectedRecommendations=(recommendation?.recommendations||[]).filter(row=>row.selected||selected.has(String(row?.artifactPerk?.hash))),artifactReasons=[...new Set(selectedRecommendations.flatMap(row=>(row.reasons||[]).map(reason=>reason.label)).filter(Boolean))].slice(0,6),artifactBlockers=(recommendation?.blockers||[]).slice(0,3),artifactReady=recommendation?.selectionStatus==='ready';
  const artifactSynergyRows=(artifactReady?artifactReasons:artifactBlockers).map(row=>`<li>${esc(row)}</li>`).join('')||'<li>No verified Artifact synergy claim is available from the supplied Bungie evidence.</li>';
  const artifactPlanLabel=recommendation?.planMode==='full-build-target'?'PARADOX FULL TARGET PLAN':'PARADOX BEST VERIFIED FIT';
  const pickOrder=new Map(sequence.map(row=>[String(row.artifactPerk?.hash),Number(row.order)]));byId('recommendedArtifactSummary').innerHTML=artifact?`<div class="review-artifact-identity">${reviewIcon(artifact,'Artifact')}<div><b>${esc(artifact.name||'VERIFIED ARTIFACT')}</b><span>${artifactReady?`${artifactPlanLabel} · ${Number(recommendation.selectionLimit||0)} LEGAL PICKS · ${Number(recommendation.totalScore||0)} SYNERGY SCORE`:'EVIDENCE LIMITED · CURRENT CONFIGURATION SHOWN'}</span><small>${artifactReady?'RECOMMENDED WORKING PLAN · APPLY PICKS IN NUMBERED ORDER':'No complete legal recommendation was resolved from the supplied Bungie evidence.'}</small></div></div><div class="review-artifact-perks">${perks.map((perk,index)=>`<span class="review-artifact-pick"><em>PICK ${pickOrder.get(String(perk?.hash??perk?.itemHash??perk?.bungieHash))||index+1}</em>${reviewIcon(perk,'Artifact perk')}</span>`).join('')||'<small>NO LEGAL VERIFIED PERK CHANGE RESOLVED</small>'}</div><div class="review-artifact-synergy"><b>ARTIFACT SYNERGY</b><ul>${artifactSynergyRows}</ul></div>`:'<small>ARTIFACT STATE UNAVAILABLE</small>';
  const transfer=byId('liveTransferStatus'),apply=byId('applyBuild'),preflight=build.liveTransferPreflight||null,plan=createLiveTransferPlan({build,advice,capabilities:build.liveTransferCapabilities||{}}),canApply=Boolean(preflight?.ready&&plan.ready);build.liveTransferPlan=plan;if(apply){apply.disabled=!canApply;apply.title=canApply?'Review and confirm the complete equip-first transfer sequence.':preflight?.ready?plan.blockers[0]||'The complete authenticated live-transfer route is not enabled.':'Recommendation transfer preflight is blocked.';}if(transfer)transfer.textContent=canApply?'Complete equip-first transfer is ready: equipment, verification, perks, mods, Artifact and final verification.':preflight?.ready?`Live transfer staged · ${plan.blockers[0]||'complete authenticated mutation support is unavailable.'}`:`Live transfer blocked · ${preflight?.violations?.[0]||'the generated build has not passed exact-loadout preflight.'}`;
}
function openRecommendedBuild(){const build=currentBuild(),dialog=byId('recommendedBuildReveal');if(!build?.recommendationGeneratedAt||!dialog)return;renderRecommendedBuildReview(build);dialog.hidden=false;document.body.classList.add('recommended-build-open');byId('closeRecommendedBuild')?.focus();}
function closeRecommendedBuild(){const dialog=byId('recommendedBuildReveal');if(dialog)dialog.hidden=true;document.body.classList.remove('recommended-build-open');byId('generateMaxLoadout')?.focus();}
function continueToBuildTest(){closeRecommendedBuild();const panel=document.querySelector('.validation-panel'),arm=byId('armRangeTest'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;panel?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});setRangeStatus('Recommendation ready. Choose PvE or PvP, select the activity, then arm this exact Working Build.','good');arm?.focus();}
async function showForgeGenerationLoader(element){const loader=byId('forgeGenerationLoader'),panel=document.querySelector('.recommendation-panel'),status=byId('forgeGenerationStatus');if(!loader)return;loader.hidden=false;loader.dataset.element=element||'';if(panel)panel.setAttribute('aria-busy','true');if(status)status.textContent=`FORGING ${String(element||'VERIFIED').toUpperCase()} GUARDIAN BUILD…`;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
function hideForgeGenerationLoader(){const loader=byId('forgeGenerationLoader'),panel=document.querySelector('.recommendation-panel');if(loader)loader.hidden=true;if(panel)panel.removeAttribute('aria-busy');}
const FORGE_COMPUTATION_FIELDS=Object.freeze(['version','source','characterId','membershipId','membershipType','characterClass','selectedLoadoutIndex','subclass','subclassName','subclassIcon','subclassBuild','super','superOptions','classAbility','movement','melee','grenade','abilities','aspects','fragments','artifact','artifactConfiguration','weapons','armour','mods','stats','hashCoverage','statModel','coverage','semanticCoverage','paradoxEvidence','forgeLoaderDecision','objective','activityContext','locks']);
const FORGE_COMPOSED_FIELDS=Object.freeze(['subclass','subclassName','subclassIcon','subclassBuild','super','superOptions','classAbility','movement','melee','grenade','abilities','aspects','fragments']);
function forgeComputationProjection(build={}){return Object.fromEntries(FORGE_COMPUTATION_FIELDS.filter(key=>Object.hasOwn(build,key)).map(key=>[key,build[key]]));}
function mergeComposedRecommendation(build={},composed={}){const next={...build};for(const key of FORGE_COMPOSED_FIELDS)if(Object.hasOwn(composed,key))next[key]=composed[key];return next;}
async function updateForgeGenerationPhase(message){const status=byId('forgeGenerationStatus');if(status)status.textContent=message;await new Promise(resolve=>setTimeout(resolve,0));}
async function generateMaxLoadout(){
  if(recommendationBusy)return;
  const state=readState(),build=state?.workingBuild,armourValidation=validateTierFiveArmour(build||{}),exoticValidation=validateExoticLoadout(build||{},{requireArmourAnchor:true}),candidate=filterExoticCompatibleSubclasses(build||{},resolvedSubclassOptions(build||{}).filter(hasVerifiedSubclassSockets)).find(item=>elementOf(item)===selectedRecommendationElement);
  if(!state?.originalBuild||!build?.forgeLoaderDecision||!armourValidation.ready||!exoticValidation.ready||!candidate){const reason=!build?.forgeLoaderDecision?'Forge Loader decision required.':armourValidation.reason||exoticValidation.reason||'The selected elemental build option is not supported by this Guardian’s verified subclass catalogue.';const status=byId('recommendationReadiness');if(status){status.className='recommendation-readiness is-blocked';status.textContent=reason;}return;}
  recommendationBusy=true;renderRecommendationControls(build);await showForgeGenerationLoader(selectedRecommendationElement);
  try{
    let next=protectBuildState(state),working={...next.workingBuild};
    await updateForgeGenerationPhase('OPTIMISING VERIFIED SUBCLASS COMPONENTS…');
    const composed=composeForgeRecommendation({build:forgeComputationProjection(working),candidate,element:selectedRecommendationElement,analyzeBuild:analyzeLiveGuardian});
    working=mergeComposedRecommendation(working,composed.workingBuild);working.recommendationGeneratedAt=new Date().toISOString();working.recommendationElement=selectedRecommendationElement;working.recommendationStatus='review-required';working.forgeIntelligence={...composed.intelligence,generatedAt:working.recommendationGeneratedAt};working.paradoxAnalysis=composed.analysis||analyzeLiveGuardian(working)||null;next={...next,workingBuild:working,recommendation:{status:'review-required',generatedAt:working.recommendationGeneratedAt,element:selectedRecommendationElement,source:'verified-forge-loader-working-build',intelligenceMethod:working.forgeIntelligence.method}};
    const supplied=Number(working.currentSeasonNumber??working.currentSeason?.seasonNumber),currentSeasonNumber=Number.isInteger(supplied)?supplied:await fetchCurrentArtifactSeason();
    working.objective=selectedRecommendationObjective;
    working.loadoutIntent=deriveLoadoutIntent(working);
    await updateForgeGenerationPhase('RANKING ALL VERIFIED OWNED WEAPONS…');
    const initialWeaponResult=selectOwnedWeapons({build:working,objective:selectedRecommendationObjective});working=initialWeaponResult.workingBuild;working.paradoxAnalysis=analyzeLiveGuardian(working)||working.paradoxAnalysis||null;
    await updateForgeGenerationPhase('BUILDING GRENADE, ORB AND SUPER MOD LOOP…');
    const provisionalModResult=recommendArmourMods({build:working,objective:selectedRecommendationObjective});working=provisionalModResult.workingBuild;
    await updateForgeGenerationPhase('MATCHING ARTIFACT SYNERGY…');
    next=protectBuildState({...next,workingBuild:working});const artifactResult=applyForgeArtifactRecommendation(next,{currentSeasonNumber,force:true});next=artifactResult.state;working={...next.workingBuild};
    await updateForgeGenerationPhase('RE-RANKING OWNED WEAPONS WITH ARTIFACT FIT…');
    const artifactAwareWeaponResult=selectOwnedWeapons({build:working,objective:selectedRecommendationObjective});working=artifactAwareWeaponResult.workingBuild;working.paradoxAnalysis=analyzeLiveGuardian(working)||working.paradoxAnalysis||null;
    const generatedExoticValidation=validateExoticLoadout(working,{requireArmourAnchor:true});if(!generatedExoticValidation.ready)throw new Error(generatedExoticValidation.reason);
    await updateForgeGenerationPhase('OPTIMISING VERIFIED ARMOUR MOD CHANGES…');
    const modResult=recommendArmourMods({build:working,objective:selectedRecommendationObjective});working=modResult.workingBuild;const generatedModValidation=validateArmourModLoadout(working);if(!generatedModValidation.ready)throw new Error(generatedModValidation.reason);working.paradoxAnalysis=analyzeLiveGuardian(working)||working.paradoxAnalysis||null;
    await updateForgeGenerationPhase('FINALISING ORDERED ARTIFACT PICKS…');
    next=protectBuildState({...next,workingBuild:working});const finalArtifactResult=applyForgeArtifactRecommendation(next,{currentSeasonNumber,force:true});next=finalArtifactResult.state;working={...next.workingBuild};const coherence=validateLoadoutCoherence(working);if(!coherence.ready)throw new Error(coherence.reason);working.loadoutCoherence=coherence;working.liveTransferPreflight=createLiveTransferPreflight(working);if(!working.liveTransferPreflight.ready)throw new Error(working.liveTransferPreflight.violations[0]||'Live transfer preflight failed.');
    await updateForgeGenerationPhase('VERIFYING RECOMMENDED WEAPON PERK ROLLS…');
    await adviseLiveWeaponRolls(working,working.paradoxAnalysis||{}, {insertSocketPlugFree:false});if(working.forgeIntelligence&&working.paradoxAnalysis){working.forgeIntelligence.evidence={...working.forgeIntelligence.evidence,directedLinks:working.paradoxAnalysis.buildLoop?.length||0,strengths:working.paradoxAnalysis.strengths?.length||0,weakLinks:working.paradoxAnalysis.weakLinks?.length||0,confidence:working.paradoxAnalysis.confidence?.level||'evidence-limited',ownedWeaponCandidates:working.weaponSelectionRecommendation?.candidateCount||0,artifactSynergyScore:Number(working.artifactRecommendation?.totalScore||0),armourModDecisions:working.armourModRecommendation?.decisions?.length||0};working.forgeIntelligence.limitations=[...new Set([...(working.forgeIntelligence.limitations||[]),...(working.weaponSelectionRecommendation?.limitations||[]),...(working.armourModRecommendation?.limitations||[])])];}
    await updateForgeGenerationPhase('PREPARING BUILD REVIEW…');
    next=protectBuildState({...next,workingBuild:working});writeState(next);render();hideForgeGenerationLoader();openRecommendedBuild();
  }catch(error){const status=byId('recommendationReadiness');if(status){status.className='recommendation-readiness is-blocked';status.textContent=error?.message||'Unable to generate a verified recommendation.';}console.error('Build Forge recommendation generation failed.',error);}
  finally{hideForgeGenerationLoader();recommendationBusy=false;renderRecommendationControls(currentBuild()||{});}
}

function renderBuildSurface(){
  emitLoad('snapshot',LOAD_STAGES.SNAPSHOT,'Locating protected build snapshot…');
  const state=readState(),original=state?.originalBuild||null,build=state?.workingBuild||original;
  if(!build||!original){
    const recovering=new URLSearchParams(location.search).get('baseline')==='bungie-recovery';
    byId('sourcePill').textContent=recovering?'BUILD SOURCE · RECOVERING BUNGIE':'BUILD SOURCE · ACTION REQUIRED';
    byId('sourceLabel').textContent=recovering?'RECOVERING VERIFIED GUARDIAN':'NO BUILD SNAPSHOT FOUND';byId('sourceDetail').textContent=recovering?'Rebuilding the protected Original Build before the staged armour is applied.':'Return to the Guardian page, load a Guardian or Bungie loadout, then press Improve My Guardian.';
    byId('buildStateLabel').textContent=recovering?'PROTECTING ORIGINAL BUILD':'SNAPSHOT UNAVAILABLE';byId('buildStateDetail').textContent=recovering?'The Working Build will remain separate from the authenticated equipped baseline.':'No verified Original or Working Build has been loaded.';
    byId('artifactStatus').textContent='NOT CHECKED';byId('artifactStatusDetail').textContent='Artifact resolution starts only after a verified build snapshot is loaded.';
    const armButton=byId('armRangeTest');if(armButton)armButton.disabled=true;
    renderRecommendationControls({});renderForgeDecision({});
    emitLoad('snapshot',LOAD_STAGES.SNAPSHOT,recovering?'Recovering authenticated Guardian…':'Build snapshot required',recovering?'loading':'error',activeLoadError);
    completeBuildRender(null);
    return;
  }
  const armButton=byId('armRangeTest');if(armButton)armButton.disabled=!String(build.characterId||'').trim();
  emitLoad('validation',LOAD_STAGES.VALIDATE,'Validating character-bound snapshot…');
  const changes=diffBuilds(original,build),loadoutNumber=Number.isInteger(build.selectedLoadoutIndex)?build.selectedLoadoutIndex+1:null,sourceName=loadoutNumber?`BUNGIE LOADOUT ${loadoutNumber}`:'CURRENT EQUIPPED GUARDIAN';
  byId('sourcePill').textContent=`BUILD SOURCE · ${sourceName}`;byId('sourceLabel').textContent=sourceName;byId('buildStateLabel').textContent='ORIGINAL SNAPSHOT CAPTURED';byId('buildStateDetail').textContent='Recommendations mutate a separate Working Build so the protected source can always be restored.';emitLoad('profile',LOAD_STAGES.PROFILE,'Resolving Guardian profile…');byId('sourceDetail').textContent=loadoutNumber?`Character ${build.characterClass||''} · Bungie slot ${loadoutNumber} · exact resolved loadout snapshot.`:`Character ${build.characterClass||''} · current equipped state captured at entry.`;byId('guardianHeading').textContent=String(build.characterClass||'Guardian').toUpperCase();
  const notice=byId('buildStateNotice'),restore=byId('restoreOriginal'),vaultCount=Array.isArray(build.vaultArmourSelection?.slots)?build.vaultArmourSelection.slots.length:0;if(notice)notice.innerHTML=changes.length?`<b>${changes.length} working change${changes.length===1?'':'s'}${vaultCount?` · ${vaultCount} from Vault`:''}.</b> Original build remains protected and can be restored.`:'<b>Baseline protected.</b> Working build currently matches the immutable original snapshot.';if(restore){restore.disabled=!changes.length;restore.title=changes.length?'Discard Working Build changes and restore the protected Original snapshot.':'Working Build already matches Original.';}
  try{
  const subclassOptions=resolvedSubclassOptions(build),activeElement=elementOf({element:build.subclass||build.subclassName||''}),activeSubclass=subclassOptions.find(item=>elementOf(item)===activeElement)||null;
  renderEquippedSubclass({root:byId('buildEquippedSubclassSummary'),iconNode:byId('buildEquippedSubclassIcon'),nameNode:byId('buildEquippedSubclassName'),metaNode:byId('buildEquippedSubclassMeta'),subclass:build.subclass||'',subclassName:build.subclassName||'',characterClass:build.characterClass||'Guardian',icon:iconOf(activeSubclass)||build.subclassIcon||''});
  renderSubclassPicker({root:byId('buildSubclassPicker'),characterClass:build.characterClass||'Guardian',subclass:build.subclass||build.subclassName||'',subclassOptions:resolvedSubclassOptions(build),selectKind:'subclass'});
  const prismatic=isPrismaticBuild(build),superItem=build.subclassBuild?.super,supers=resolvedOptions(build,'super'),superNode=byId('buildSuperFeatureCluster');renderSuperFormation({host:superNode,nameNode:byId('buildSuperName'),activeSuper:superItem,superOptions:supers,subclass:build.subclass||build.subclassName||'',subclassCatalog:subclassOptions,characterClass:build.characterClass||'hunter',selectKind:'super'});
  const transcendenceSection=byId('transcendenceSection'),transcendenceNode=byId('transcendenceSummary');transcendenceSection.hidden=!prismatic;if(prismatic){const slots=resolvedTranscendenceSlots(build),choices=transcendenceChoices(build);transcendenceNode.innerHTML=Array.from({length:2},(_,slotPosition)=>{const slot=slots[slotPosition],options=Array.isArray(slot?.options)?slot.options:[],equipped=slot?.equipped,cards=options.map(item=>{const index=choices.findIndex(value=>itemKey(value)===itemKey(item)&&Number(value.transcendenceSlotPosition)===slotPosition);return selectorCard(item,{kind:'transcendence',index,selected:itemKey(item)===itemKey(equipped)});});return '<section class="transcendence-slot"><h4>SLOT '+(slotPosition+1)+'</h4><div class="transcendence-options">'+(cards.length?cards.join(''):unavailableCard('Verified slot unavailable'))+'</div></section>';}).join('');}else{transcendenceNode.innerHTML='';}
  const abilities=Array.isArray(build.subclassBuild?.abilities)?build.subclassBuild.abilities:[],aspects=Array.isArray(build.subclassBuild?.aspects)?build.subclassBuild.aspects:[],fragments=Array.isArray(build.subclassBuild?.fragments)?build.subclassBuild.fragments:[];byId('abilityRail').innerHTML=Array.from({length:4},(_,i)=>tile(abilities[i])).join('');byId('aspectRail').innerHTML=Array.from({length:2},(_,i)=>tile(aspects[i])).join('');byId('fragmentRail').innerHTML=Array.from({length:5},(_,i)=>tile(fragments[i])).join('');
  byId('abilityOptions').innerHTML=abilityGroups(build,abilities);
  for(const [kind,nodeId] of [['aspects','aspectOptions'],['fragments','fragmentOptions']]){const equipped=kind==='aspects'?aspects:fragments,options=resolvedOptions(build,kind).slice(0,kind==='fragments'?14:40);byId(nodeId).innerHTML=options.length?options.map((item,index)=>selectorCard(item,{kind,index,selected:equipped.some(value=>itemKey(value)===itemKey(item))})).join(''):unavailableCard('Compatible '+kind+' unavailable');}
  }catch(error){
    activeLoadError=error?.message||'The recovered subclass presentation could not be completed.';
    console.error('Build Forge retained the protected transfer after recovered subclass rendering failed.',error);
    byId('buildStateDetail').textContent='The transferred build remains protected while the remaining verified equipment evidence is displayed.';
  }
  emitLoad('sockets',LOAD_STAGES.SOCKETS,'Resolving equipped sockets and selections…');
  const artifact=build.artifact,artifactState=String(artifact?.state||'state-unavailable'),artifactUnavailable=!artifact||artifactState==='state-unavailable',allArtifactPerks=Array.isArray(artifact?.perks)?artifact.perks:[],activePerks=(Array.isArray(artifact?.activePerks)?artifact.activePerks:[]).filter(perk=>perk?.isActive!==false),artifactConfiguration=build.artifactConfiguration||artifact?.artifactConfiguration,recommendation=build.artifactRecommendation,configuredHashes=Array.isArray(artifactConfiguration?.selectedPerkHashes)?artifactConfiguration.selectedPerkHashes:null,displayPerks=configuredHashes?configuredHashes.map(hash=>allArtifactPerks.find(perk=>itemKey(perk)===String(hash))).filter(Boolean):activePerks,recommendationRows=artifactRecommendationMap(recommendation);emitLoad('artifact',LOAD_STAGES.ARTIFACT,'Resolving verified Artifact evidence…');const artIcon=byId('buildArtIcon'),artifactIcon=artifactUnavailable?'':abs(iconOf(artifact));byId('buildArtName').textContent=artifactUnavailable?'STATE UNAVAILABLE':String(artifact?.name||'ARTIFACT').toUpperCase();if(artIcon){artIcon.hidden=!artifactIcon;if(artifactIcon)artIcon.src=artifactIcon;else artIcon.removeAttribute('src');artIcon.alt=artifact?.name||'Artifact';artIcon.onerror=()=>{artIcon.hidden=true;};}const artifactItems=resolvedOptions(build,'artifact'),artifactItemCards=artifactItems.map((item,index)=>selectorCard(item,{kind:'artifact',index,selected:itemKey(item)===itemKey(artifact),recommended:recommendation?.selectionStatus==='ready'&&String(recommendation.artifactHash)===itemKey(item)}));byId('artifactItems').innerHTML=artifactItemCards.length?artifactItemCards.join(''):unavailableCard('Verified Artifact catalogue unavailable');const visiblePerks=displayPerks.slice(0,7),activePerkCards=visiblePerks.map(perk=>{const index=allArtifactPerks.findIndex(item=>itemKey(item)===itemKey(perk)),key=String(perk?.hash),automatic=recommendation?.selectionStatus==='ready'&&!recommendation?.userOverride;return artifactPerkCard(perk,index,{compact:true,selected:true,recommended:automatic&&(recommendation?.selectedPerkHashes||[]).map(String).includes(key),recommendation:recommendationRows.get(key)});}),artifactRail=byId('artifactRail'),hiddenPerkCount=Math.max(0,displayPerks.length-visiblePerks.length);artifactRail.dataset.artifactState=artifactUnavailable?'state-unavailable':(recommendation?.selectionStatus==='ready'&&!recommendation?.userOverride?'recommended':(activePerkCards.length?'staged':'none-active'));artifactRail.innerHTML=activePerkCards.length?activePerkCards.concat(hiddenPerkCount?['<span class="artifact-more-count">+'+hiddenPerkCount+' MORE</span>']:[],Array.from({length:Math.max(0,7-visiblePerks.length-hiddenPerkCount)},()=>'<span class="rail-empty-slot" aria-hidden="true"></span>')).join(''):`<span class="art-empty">${artifactUnavailable?'ARTIFACT STATE UNAVAILABLE':'NO ARTIFACT PERKS STAGED'}</span>`;byId('artifactRecommendation').innerHTML=artifactRecommendationMarkup(build);byId('artifactOptions').innerHTML=artifactMatrix(artifact,artifactConfiguration,recommendation);
  const automaticArtifact=recommendation?.selectionStatus==='ready'&&!recommendation?.userOverride,fullArtifactTarget=automaticArtifact&&recommendation?.planMode==='full-build-target';byId('artifactStatus').textContent=artifactUnavailable?'ARTIFACT STATE UNAVAILABLE':(automaticArtifact?(fullArtifactTarget?'PARADOX FULL ARTIFACT PLAN STAGED':'PARADOX ARTIFACT 2.0 FIT STAGED'):(activePerks.length?'LIVE ARTIFACT RESOLVED':'NO ARTIFACT FIT STAGED'));byId('artifactStatusDetail').textContent=artifactUnavailable?'Verified Artifact socket data is unavailable.':automaticArtifact?(fullArtifactTarget?`${artifact.name||'Artifact'} · ${recommendation.selectionLimit} legal target picks staged from the verified perk tree. Current unlocks and equipped perks remain unchanged.`:`${artifact.name||'Artifact'} · best of ${recommendation.artifactCandidateCount||1} verified Artifact option(s) · ${recommendation.selectionLimit} socket-bucket picks staged for this Working Build. Current unlocks and equipped perks remain unchanged.`):`${artifact.name||'Artifact'} · ${activePerks.length} active perk(s) captured into this build snapshot.`;
  renderBuildGear(build);renderLiveAnalysis(build.paradoxAnalysis);renderForgeDecision(build);
  document.dispatchEvent(new CustomEvent('astrix:guardian-loadout-context',{detail:build}));
  const advice=build.weaponRollAdvice||build.paradoxAnalysis?.weaponRollAdvice,apply=byId('applyBuild'),plan=createLiveTransferPlan({build,advice,capabilities:build.liveTransferCapabilities||{}}),canApply=Boolean(build.recommendationGeneratedAt&&plan.ready);if(apply){apply.disabled=!canApply;apply.title=canApply?'Review and confirm the complete equip-first transfer sequence.':'Build My Guardian stays locked until every authenticated equipment, socket, Artifact and verification phase is available.';}renderRecommendationControls(build);renderTestConfiguration();refreshRangeCapture();
  completeBuildRender(build);
}

function render(){
  try{return renderBuildSurface();}
  catch(error){
    console.error('Build Forge recovered from a synchronous render failure after protecting the transferred build.',error);
    activeLoadError=error?.message||'A Build Forge presentation stage could not be rendered.';
    let build=null;
    try{const state=readState();build=state?.workingBuild||state?.originalBuild||null;}catch{}
    const detail=byId('buildStateDetail');
    if(detail)detail.textContent='The transferred build remains protected while the available Build Forge evidence is displayed.';
    emitLoad('recovery',LOAD_STAGES.ARTIFACT,'Completing Build Forge with protected evidence…','loading',activeLoadError);
    completeBuildRender(build);
    return null;
  }
}

function restoreOriginal(){const state=readState();if(!state?.originalBuild)return;const restored=restoreWorkingBuild(state);writeState(restored);closeRecommendedBuild();render();}
async function applyBuild(){const build=currentBuild(),advice=build?.weaponRollAdvice||build?.paradoxAnalysis?.weaponRollAdvice,preflight=createLiveTransferPreflight(build||{}),plan=createLiveTransferPlan({build:build||{},advice,capabilities:build?.liveTransferCapabilities||{}});try{if(!build?.recommendationGeneratedAt)throw new Error('Generate and review a verified Working Build before any live action.');if(!preflight.ready)throw new Error(preflight.violations[0]||'The exact Working Build failed live-transfer preflight.');if(!plan.ready)throw new Error(plan.blockers[0]||'The complete equip-first live-transfer route is not enabled.');throw new Error('The complete authenticated live-transfer executor is not enabled. No live Guardian changes were made.');}catch(error){setRangeStatus(error?.message||'Unable to apply the staged build.','bad');showRangeOutput(plan);}}
function setRangeStatus(message,state=''){const node=byId('rangeCaptureStatus');if(!node)return;node.className=`range-capture-status${state?` is-${state}`:''}`;node.textContent=message;}
function showRangeOutput(value){const node=byId('rangeCaptureOutput');if(!node)return;node.hidden=false;node.textContent=JSON.stringify(value,null,2);}
function renderParadoxTestReview(capture=readCapture()){
  const host=byId('paradoxTestReview'),title=byId('paradoxTestReviewTitle'),summary=byId('paradoxTestReviewSummary'),metricsHost=byId('paradoxTestReviewMetrics');if(!host||!title||!summary||!metricsHost)return;
  if(capture?.status!=='collected'){host.hidden=true;metricsHost.innerHTML='';return;}
  host.hidden=false;const candidates=Array.isArray(capture.candidates)?capture.candidates:[],selectedId=String(capture.candidateSelection?.selectedInstanceId||''),selected=candidates.find(row=>String(row?.activity?.instanceId||'')===selectedId)||null,requiresConfirmation=capture.candidateSelection?.requiresUserConfirmation===true,verified=selected?.evidence?.classification==='verified-activity-pgcr-evidence',claims=selected?.pgcr?.claimMetrics||{};
  if(requiresConfirmation||!selected){title.textContent='ACTIVITY CONFIRMATION REQUIRED';summary.textContent=`${candidates.length} completed candidate${candidates.length===1?'':'s'} found. Confirm the exact activity before Paradox reviews performance.`;metricsHost.innerHTML=`<span><small>CANDIDATES</small><b>${candidates.length}</b></span>`;return;}
  title.textContent=verified?'VERIFIED RESULT REVIEWED':'RESULT EVIDENCE LIMITED';summary.textContent=verified?'Paradox reviewed the confirmed Bungie activity and PGCR metrics. Causal perk activation, DPS and uptime remain inference until direct telemetry exists.':'The completed activity was confirmed, but complete activity-hash and PGCR proof was not available; no performance claim is made.';
  const labels={kills:'KILLS',deaths:'DEATHS',assists:'ASSISTS',efficiency:'EFFICIENCY',score:'SCORE',timePlayedSeconds:'TIME PLAYED'};const metricRows=Object.keys(labels).filter(key=>Object.hasOwn(claims,key)).map(key=>`<span><small>${labels[key]}</small><b>${esc(claims[key])}${key==='timePlayedSeconds'?'s':''}</b></span>`).join('');metricsHost.innerHTML=metricRows||`<span><small>PGCR EVIDENCE</small><b>${verified?'VERIFIED':'LIMITED'}</b></span>`;
}
function renderCandidateConfirmation(capture){const node=byId('candidateConfirmation');if(!node)return;const selection=capture?.candidateSelection,rows=Array.isArray(capture?.candidates)?capture.candidates:[];if(!selection?.requiresUserConfirmation||!rows.length){node.hidden=true;node.innerHTML='';return;}node.hidden=false;node.innerHTML='<strong>CONFIRM COMPLETED ACTIVITY</strong><p>Confirm the exact post-arm activity before Paradox reviews its result. Build Forge will not guess.</p><div>'+rows.map(row=>{const activity=row.activity||{},pgcr=row.pgcr||{},name=capture.expectedActivity?.name||'Completed Bungie activity';return `<button type="button" data-confirm-instance="${esc(activity.instanceId)}"><b>${esc(name)}</b><span>${esc(activity.period||pgcr.period||'Time unavailable')} · ${esc(activity.instanceId)}</span></button>`;}).join('')+'</div>';}
function downloadRangeEvidence(){const capture=readCapture();if(!capture)return;const evidence={...capture,evidenceArchive:readCaptureArchive()};const blob=new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${capture.testId||'BF-TEST-EVIDENCE'}.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}
function refreshRangeCapture(){const capture=readCapture();const build=currentBuild(),characterId=String(build?.characterId||'').trim(),matches=captureMatchesCharacter(capture,characterId);const pull=byId('pullRangeResults');const arm=byId('armRangeTest');const download=byId('downloadRangeEvidence');renderCandidateConfirmation(capture);renderParadoxTestReview(capture);if(arm)arm.disabled=!characterId;if(download)download.disabled=capture?.status!=='collected';if(capture?.status==='armed'){arm?.classList.toggle('is-armed',matches);if(pull)pull.disabled=!matches;if(!matches)setRangeStatus(`CAPTURE GUARDIAN MISMATCH · saved character ${capture.characterId||'unknown'} · current character ${characterId||'unknown'}. Return to the captured Guardian before pulling results.`,'bad');else setRangeStatus(`ARMED ${String(capture.testDomain||'pve').toUpperCase()} BUILD TEST · ${capture.testId} · character ${capture.characterId}`,'warn');}else if(capture?.status==='collected'){arm?.classList.remove('is-armed');if(pull)pull.disabled=!matches;if(!matches)setRangeStatus(`RESULTS PRESERVED FOR DIFFERENT GUARDIAN · ${capture.testId} · saved character ${capture.characterId||'unknown'}. Raw evidence remains available to download.`,'bad');else setRangeStatus(`RESULTS COLLECTED · ${capture.testId} · ${capture.candidates?.length||0} completed candidate activity instance(s)`,'good');}else{arm?.classList.remove('is-armed');if(pull)pull.disabled=true;setRangeStatus('Choose PvE or PvP, then arm the exact Working Build before playing.');}}
async function armRange(){const build=currentBuild();if(!build?.characterId){setRangeStatus('No Guardian characterId is present in this Build Forge snapshot.','bad');return;}const button=byId('armRangeTest');try{if(button)button.disabled=true;setRangeStatus('Taking the pre-test Activity History baseline…','warn');const capture=await armBuildTest({characterId:build.characterId,buildSnapshot:build,testDomain,calibrationType:testDomain==='pve'&&byId('shootingRangeCalibration')?.checked?'shooting-range':null,expectedActivity:selectedExpectedActivity()});refreshRangeCapture();showRangeOutput(capture);if(capture.baselineError)setRangeStatus(`ARMED, but Activity History baseline failed: ${capture.baselineError.message}`,'warn');}catch(error){setRangeStatus(error?.message||'Unable to arm Build Test.','bad');showRangeOutput({error:error?.message||String(error),code:error?.code||null,status:error?.status||null,url:error?.url||null});}finally{if(button)button.disabled=!String(currentBuild()?.characterId||'').trim();}}
async function pullRange(){const button=byId('pullRangeResults'),build=currentBuild(),capture=readCapture();if(!captureMatchesCharacter(capture,build?.characterId)){setRangeStatus(`Capture blocked: saved character ${capture?.characterId||'unknown'} does not match current Build Forge Guardian ${build?.characterId||'unknown'}.`,'bad');showRangeOutput({error:'Build Test Guardian mismatch.',code:'capture-character-mismatch',captureCharacterId:capture?.characterId||null,currentCharacterId:build?.characterId||null});return;}try{if(button)button.disabled=true;setRangeStatus('Pulling completed post-arm activities and candidate PGCRs…','warn');const result=await collectBuildTestResults({expectedCharacterId:build.characterId});refreshRangeCapture();showRangeOutput(result);if(!result.candidates?.length)setRangeStatus('No completed post-arm Bungie activity candidate was found.','warn');else if(result.candidateSelection?.requiresUserConfirmation)setRangeStatus(`${result.candidates.length} candidates found. Confirm the correct completed activity; Build Forge will not guess.`,'warn');else if(!result.evidenceSummary?.verifiedActivityPgcrCount)setRangeStatus('Candidates pulled, but none has complete activity-hash + PGCR proof.','warn');else setRangeStatus(`${result.evidenceSummary.verifiedActivityPgcrCount} verified activity + PGCR record(s) pulled. Causal perk and uptime claims remain inference.`,'good');}catch(error){setRangeStatus(error?.message||'Unable to pull Build Test results.','bad');showRangeOutput({error:error?.message||String(error),code:error?.code||null,status:error?.status||null,url:error?.url||null,captureCharacterId:error?.captureCharacterId||null,currentCharacterId:error?.currentCharacterId||null});}finally{if(button)button.disabled=!captureMatchesCharacter(readCapture(),currentBuild()?.characterId);}}
document.addEventListener('click',event=>{const recommendationElement=event.target.closest('[data-recommendation-element]');if(recommendationElement&&!recommendationElement.disabled){selectedRecommendationElement=recommendationElement.dataset.recommendationElement||'';renderRecommendationControls(currentBuild()||{});return;}const objective=event.target.closest('[data-build-objective]');if(objective&&!objective.disabled){selectedRecommendationObjective=objective.dataset.buildObjective||'balanced';renderRecommendationControls(currentBuild()||{});return;}const artifactRecommend=event.target.closest('[data-artifact-recommend]');if(artifactRecommend){artifactRecommend.disabled=true;void refreshForgeArtifactRecommendation({force:true});return;}const candidate=event.target.closest('[data-confirm-instance]');if(candidate){try{const confirmed=confirmCandidateActivity(candidate.dataset.confirmInstance,{expectedCharacterId:currentBuild()?.characterId});refreshRangeCapture();showRangeOutput(confirmed);setRangeStatus(`COMPLETED ACTIVITY CONFIRMED · ${candidate.dataset.confirmInstance}`,'good');}catch(error){setRangeStatus(error?.message||'Unable to confirm this activity.','bad');}return;}const toggle=event.target.closest('[data-toggle-panel]');if(toggle){const panel=byId(toggle.dataset.togglePanel),expanded=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!expanded));if(panel)panel.hidden=expanded;return;}const option=event.target.closest('[data-select-kind]');if(option){const kind=option.dataset.selectKind;stageSelection(kind,Number(option.dataset.selectIndex));if(kind!=='artifactPerks')queueMicrotask(()=>void refreshForgeArtifactRecommendation());}});
document.addEventListener('astrix:guardian-selection-changed',event=>switchBuildCharacter(event.detail||{}));
document.addEventListener('astrix:guardian-loadout-context',event=>recoverMissingBuild(event.detail||{}));
document.addEventListener('astrix:loadout-loading',event=>{const slot=Number(event.detail?.index);byId('sourcePill').textContent=Number.isInteger(slot)?`BUILD SOURCE · LOADING BUNGIE SLOT ${slot+1}`:'BUILD SOURCE · LOADING BUNGIE SLOT';});
document.addEventListener('astrix:loadout-error',()=>{byId('sourcePill').textContent='BUILD SOURCE · LOADOUT ERROR';});
document.querySelectorAll('[data-test-domain]').forEach(button=>button.addEventListener('click',()=>{testDomain=button.dataset.testDomain==='pvp'?'pvp':'pve';renderTestConfiguration();}));
byId('expectedDestination')?.addEventListener('change',event=>globalThis.AstrixDestinations?.set?.(event.target.value));
byId('backToGuardian')?.addEventListener('click',()=>{markGuardianFastReturn();location.href='../';});
byId('armRangeTest')?.addEventListener('click',armRange);
byId('pullRangeResults')?.addEventListener('click',pullRange);
byId('downloadRangeEvidence')?.addEventListener('click',downloadRangeEvidence);
byId('applyBuild')?.addEventListener('click',applyBuild);
byId('restoreOriginal')?.addEventListener('click',restoreOriginal);
byId('generateMaxLoadout')?.addEventListener('click',generateMaxLoadout);
byId('closeRecommendedBuild')?.addEventListener('click',closeRecommendedBuild);
byId('returnToForge')?.addEventListener('click',closeRecommendedBuild);
byId('continueToBuildTest')?.addEventListener('click',continueToBuildTest);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!byId('recommendedBuildReveal')?.hidden)closeRecommendedBuild();});
async function initialiseBuildForge(){
  try{
    const atomicTransfer=await restoreAtomicForgeTransfer();
    const initialVaultState=atomicTransfer||readState();
    if(initialVaultState){const nextVaultState=atomicTransfer||applyPendingVaultSelection(initialVaultState),artifactResult=applyForgeArtifactRecommendation(nextVaultState);if(artifactResult.state!==initialVaultState)writeState(artifactResult.state);}
  }catch(error){
    console.error('Build Forge could not complete the protected Forge Loader handoff. Rendering the existing Working Build instead.',error);
  }finally{
    render();
    queueMicrotask(()=>void refreshForgeArtifactRecommendation());
  }
}
void initialiseBuildForge();
