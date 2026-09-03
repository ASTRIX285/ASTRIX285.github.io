import {AUTH_ORIGIN,authStartUrl,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
import {guardianManifest} from '../guardian-workspace-v2/guardian-manifest-service.mjs';
import {cacheBungieProfile,markGuardianFastReturn,readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs';
import {ARMOUR_BUCKETS,createVaultCatalogue,itemKey,prepareArmourSelection} from '../vault/vault-inventory.mjs';
import {ARMOUR_STAT_KEYS,ARMOUR_STAT_LABELS,armourStatVector,armourTargetMaximums,matchArmourBuilds} from '../vault/vault-armour-matcher.mjs';
import {createVaultArmourSelection,writeVaultArmourSelection} from '../vault/vault-selection-state.mjs';
import {compatibleWithClass,exoticCatalogueGroups,setBonusOptions,toggleSetSelection} from './forge-loader-model.mjs';

const CLASS_NAMES=['titan','hunter','warlock'];
const SELECTED_CHARACTER_KEY='astrix:selected-character-id';
const byId=id=>document.getElementById(id);
const text=value=>String(value??'').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params=new URLSearchParams(location.search);

let session=null;
let payload=null;
let catalogue={armour:[],postmasterByCharacter:{}};
let activeCharacterId=text(params.get('characterId'));
let activeCharacterClass='';
let selectedExoticHash=null;
let setSelections=[];
let matchedBuilds=[];
let selectedCandidateIndex=-1;
let expandedCandidateIndex=-1;
let targetMaximums=Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,0]));
const selectedSlots=new Map();

function loaderProgress(percent,label){globalThis.AstrixLoader?.set?.(percent);globalThis.AstrixLoader?.status?.(label);}
function characters(){return Object.values(payload?.profile?.characters?.data||{});}
function selectedCharacter(){return characters().find(character=>text(character.characterId)===activeCharacterId)||null;}
function mostRecentCharacter(){return characters().sort((left,right)=>text(right?.dateLastPlayed).localeCompare(text(left?.dateLastPlayed)))[0]||null;}
function characterClass(character){return CLASS_NAMES[Number(character?.classType)]||'';}
function classLabel(value=activeCharacterClass){return value?value[0].toUpperCase()+value.slice(1):'Guardian';}
function rememberActiveCharacter(){try{sessionStorage.setItem(SELECTED_CHARACTER_KEY,activeCharacterId);}catch{}}

function resolveActiveCharacter(requestedId=''){
  let stored='';try{stored=text(sessionStorage.getItem(SELECTED_CHARACTER_KEY));}catch{}
  const requested=text(requestedId||activeCharacterId||stored);
  const character=characters().find(row=>text(row.characterId)===requested)||mostRecentCharacter();
  activeCharacterId=text(character?.characterId);
  activeCharacterClass=characterClass(character);
  if(activeCharacterId)rememberActiveCharacter();
  return character;
}

function membershipBinding(){
  const membership=session?.activeDestinyMembership||{};
  return {characterId:activeCharacterId,membershipId:text(membership.membershipId||session?.primaryMembershipId||session?.bungieMembershipId),membershipType:text(membership.membershipType)};
}

async function fetchProfile(){
  const url=new URL('/bungie/profile',AUTH_ORIGIN);url.searchParams.set('scope','character');
  await guardianManifest.ready();
  if(guardianManifest.status().mode==='indexeddb')url.searchParams.set('definitions','client-manifest');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
    const response=await fetch(url,{credentials:'include',headers:{Accept:'application/json'},signal:controller.signal});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result?.error||`Bungie inventory request failed (${response.status}).`);
    return result;
  }catch(error){if(error?.name==='AbortError')throw new Error('Bungie inventory request timed out. Refresh or reconnect Bungie.');throw error;}
  finally{clearTimeout(timer);}
}

async function loadVerifiedPayload(){
  loaderProgress(18,'Checking verified Guardian armour…');
  const cached=await readCachedBungieProfile(session);
  const shared=globalThis.ASTRIX_HERO_PROFILE_PAYLOAD||await globalThis.ASTRIX_HERO_PROFILE_PROMISE;
  const next=shared?.profile?shared:cached?.profile?cached:await fetchProfile();
  if(!next?.profile)throw new Error('Bungie returned no verified profile inventory.');
  loaderProgress(46,'Resolving Bungie armour definitions…');
  await guardianManifest.hydratePayload(next);
  await cacheBungieProfile(session,next);
  return next;
}

function armourItems(){return catalogue.armour.filter(item=>compatibleWithClass(item,activeCharacterClass));}
function inventoryDefinitions(){return guardianManifest.tables.get('DestinyInventoryItemDefinition')||payload?.definitions||{};}
function exoticGroups(){return exoticCatalogueGroups(catalogue.armour,inventoryDefinitions(),activeCharacterClass,ARMOUR_BUCKETS);}
function selectedExotic(){return exoticGroups().find(group=>group.owned&&group.hash===Number(selectedExoticHash))||null;}
function solverOptions(){const exotic=selectedExotic();return exotic?{fixedExoticHash:exotic.hash,fixedExoticSlot:exotic.slotIndex,setSelections}:{};}
function targetValues(){return Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,Number(document.querySelector(`[data-target-stat="${key}"] input`)?.value||0)]));}
function activeTargetCount(){const targets=targetValues();return ARMOUR_STAT_KEYS.filter(key=>targets[key]>0).length;}

function renderHero(){
  const character=selectedCharacter(),host=byId('forgeHeroCard'),label=classLabel();
  byId('forgeGuardianTitle').textContent=character?`${label} selected`:'Guardian';
  byId('forgeGuardianClass').textContent=character?`${label.toUpperCase()} · POWER ${Number(character.light||0)||'—'}`:'UNAVAILABLE';
  byId('forgeHeaderState').textContent=character?`${label.toUpperCase()} FORGE`:'BUNGIE ARMOUR';
  if(!host)return;
  const emblem=character?.emblemBackgroundPath||character?.emblemPath||'';
  host.style.backgroundImage=emblem?`url("${esc(new URL(emblem,'https://www.bungie.net').toString())}")`:'';
  host.innerHTML=character?`<strong>${esc(label.toUpperCase())}</strong><span>Active Guardian · exact owned armour only</span><b>✦ ${esc(character.light??'—')}</b>`:'<span>Verified Guardian unavailable.</span>';
}

function renderExotics(){
  const groups=exoticGroups(),host=byId('forgeExoticSlots');
  const ownedCount=groups.filter(group=>group.owned).length;
  byId('forgeExoticStatus').textContent=`${ownedCount} OWNED · ${groups.length} TOTAL`;
  host.innerHTML=ARMOUR_BUCKETS.map((slot,index)=>{
    const rows=groups.filter(group=>group.slotIndex===index);
    return `<section class="forge-exotic-slot"><h3>${esc(slot.label.toUpperCase())}</h3><div class="forge-exotic-grid">${rows.length?rows.map(group=>{
      const selected=group.owned&&group.hash===Number(selectedExoticHash);
      const ownership=group.owned?`${group.instances.length} owned ${group.instances.length===1?'copy':'copies'}`:'not owned';
      return `<button type="button" class="forge-exotic${selected?' is-selected':''}${group.owned?'':' is-unowned'}" ${group.owned?`data-exotic-hash="${group.hash}"`:''} data-inspect-exotic="${group.hash}" aria-pressed="${selected}" aria-label="${group.owned?'Select':'Inspect'} ${esc(group.name)}, ${ownership}" ${group.owned?'':'disabled'}><img src="${esc(group.icon)}" alt="" loading="lazy" decoding="async"><span>${group.owned?`×${group.instances.length}`:'LOCKED'}</span></button>`;
    }).join(''):'<div class="forge-empty">No verified Exotic definitions</div>'}</div></section>`;
  }).join('');
}

function bonusReason(row,count,choice){
  if(choice.checked)return `${count} PIECE SELECTED`;
  if(!choice.effect)return `${count} PIECE PERK UNAVAILABLE`;
  if(setSelections.some(selection=>selection.count===4))return 'FOUR-PIECE LOAD ACTIVE';
  if(count===4&&setSelections.some(selection=>selection.count===2))return 'LOCKED BY TWO-PIECE LOAD';
  if(count===2&&setSelections.filter(selection=>selection.count===2).length>=2)return 'TWO BONUS LIMIT REACHED';
  if(choice.disabled)return `${row.usableSlots} COMPATIBLE SLOT${row.usableSlots===1?'':'S'}`;
  return choice.effect.description||`${count}-piece verified set bonus`;
}

function renderSetBonuses(){
  const exotic=selectedExotic(),host=byId('forgeSetList');
  if(!exotic){byId('forgeSetStatus').textContent='SELECT EXOTIC';host.innerHTML='<div class="forge-empty">Select an Exotic to calculate compatible set bonuses.</div>';return;}
  const options=setBonusOptions(armourItems(),exotic,setSelections);
  const selectedLabel=setSelections.length?setSelections.map(row=>`${row.count}P`).join(' + '):'OPTIONAL';
  byId('forgeSetStatus').textContent=`${options.length} VERIFIED SET${options.length===1?'':'S'} · ${selectedLabel}`;
  host.innerHTML=options.length?options.map(row=>`<article class="forge-set"><div class="forge-set-head">${row.icon?`<img src="${esc(row.icon)}" alt="">`:'<span></span>'}<span><strong>${esc(row.name)}</strong><small>${esc(row.description||'Verified Bungie armour set')}</small></span><small class="forge-set-count">${row.usableSlots} USABLE SLOTS</small></div><div class="forge-set-choices">${[2,4].map(count=>{const choice=count===2?row.two:row.four;return `<label class="forge-set-choice${choice.disabled?' is-disabled':''}"><input type="checkbox" data-set-hash="${row.hash}" data-set-count="${count}" ${choice.checked?'checked':''} ${choice.disabled?'disabled':''}><span><b>${count} PIECE</b><small>${esc(bonusReason(row,count,choice))}</small></span></label>`;}).join('')}</div></article>`).join(''):'<div class="forge-empty">No verified 2-piece or 4-piece armour-set combinations are available around this Exotic.</div>';
}

function updateTargetLabel(label){
  const key=label?.dataset?.targetStat,input=label?.querySelector('input'),output=label?.querySelector('output');
  if(key&&input&&output)output.textContent=`${input.value} / ${targetMaximums[key]||'—'}`;
}

function configureStats({reset=false}={}){
  const exotic=selectedExotic();
  targetMaximums=exotic?armourTargetMaximums(armourItems(),solverOptions()):Object.fromEntries(ARMOUR_STAT_KEYS.map(key=>[key,0]));
  for(const label of document.querySelectorAll('[data-target-stat]')){
    const key=label.dataset.targetStat,input=label.querySelector('input'),maxButton=label.querySelector('[data-max-stat]');
    const maximum=Number(targetMaximums[key]||0);
    input.max=String(maximum);input.disabled=!exotic||maximum<=0;input.value=String(reset?0:Math.min(maximum,Number(input.value||0)));maxButton.disabled=input.disabled;updateTargetLabel(label);
  }
  const count=activeTargetCount(),available=Boolean(exotic)&&ARMOUR_STAT_KEYS.some(key=>targetMaximums[key]>0);
  byId('forgeFindBuilds').disabled=!available||count===0;byId('forgeResetTargets').disabled=!available||count===0;
  byId('forgeStatStatus').textContent=!exotic?'SELECT EXOTIC':available?`${count} ACTIVE TARGET${count===1?'':'S'}`:'NO COMPLETE LOAD';
}

function stagedMarkup(slot,index){
  const item=selectedSlots.get(index);
  return `<div class="forge-staged-slot">${item?.icon?`<img src="${esc(item.icon)}" alt="">`:'<span class="forge-stage-empty">◇</span>'}<span><b>${esc(item?.name||slot.label)}</b><small>${esc(item?`${item.totalStats} total · ${item.source?.label||'Owned'}`:'No item staged')}</small></span></div>`;
}

function renderStaged(){
  byId('forgeStagedSlots').innerHTML=ARMOUR_BUCKETS.map(stagedMarkup).join('');
  byId('forgeStagedStatus').textContent=selectedSlots.size===5?'COMPLETE VERIFIED LOAD':`${selectedSlots.size} OF 5 STAGED`;
  byId('forgeEvaluate').disabled=selectedSlots.size!==5||!activeCharacterId;
}

function candidateSetProtocol(candidate){
  if(!setSelections.length)return 'OPEN SET PROTOCOL';
  return setSelections.map(selection=>{
    const match=candidate.items.find(item=>Number(item?.setBonus?.hash??item?.armourSemantics?.set?.hash)===Number(selection.setHash));
    return `${selection.count}P ${match?.setBonus?.identity?.name||match?.armourSemantics?.set?.identity?.name||`SET ${selection.setHash}`}`;
  }).join(' + ');
}

function candidateStatMarkup(candidate,{itemRow=false}={}){
  const stats=itemRow?armourStatVector(candidate):candidate.stats;
  const targets=itemRow?{}:targetValues();
  return ARMOUR_STAT_KEYS.map(key=>{
    const value=Number(stats[key]||0),target=Number(targets[key]||0);
    const state=target>0?(value>=target?' is-met':' is-short'):'';
    return `<span class="forge-matrix-stat${state}"><small>${esc(ARMOUR_STAT_LABELS[key].toUpperCase())}</small><b>${value}</b>${itemRow?'':`<em>${target>0?`TARGET ${target}`:'OPEN'}</em>`}</span>`;
  }).join('');
}

function candidateItemMeta(item){
  const details=[item.source?.label||'Owned'];
  if(item.power!==null&&item.power!==undefined)details.push(`Power ${item.power}`);
  if(Number.isFinite(Number(item.energy?.capacity)))details.push(`Energy ${Number(item.energy.capacity)}`);
  if((Number(item.state||0)&4)!==0)details.push('Masterworked');
  const modCount=[...(item.generalMods||[]),...(item.slotMods||[])].length;
  if(modCount)details.push(`${modCount} equipped mod${modCount===1?'':'s'}`);
  return details.join(' · ');
}

function candidateItemMarkup(item){
  return `<div class="forge-breakdown-item"><button type="button" class="forge-breakdown-identity" data-inspect-item="${esc(itemKey(item))}" aria-label="Inspect ${esc(item.name)}"><img src="${esc(item.icon)}" alt=""><span><b>${esc(item.name)}</b><small>${esc(item.slotLabel)} · ${esc(candidateItemMeta(item))}</small></span></button><div class="forge-breakdown-stats" aria-label="${esc(item.name)} armour stats">${candidateStatMarkup(item,{itemRow:true})}</div><span class="forge-breakdown-total"><small>TOTAL</small><b>${Number(item.totalStats||0)}</b></span></div>`;
}

function candidateMarkup(candidate,index){
  const outcome=candidate.score.met?'ALL TARGETS MET':`${candidate.score.shortfall} POINT${candidate.score.shortfall===1?'':'S'} SHORT`;
  const expanded=expandedCandidateIndex===index,selected=selectedCandidateIndex===index;
  const exotic=candidate.items.find(item=>item.isExotic)||candidate.items[0];
  return `<article class="forge-candidate${candidate.score.met?' is-target-met':''}${selected?' is-selected':''}"><div class="forge-matrix-row"><button type="button" class="forge-matrix-expand" data-candidate-expand="${index}" aria-expanded="${expanded}" aria-controls="forgeLoadBreakdown${index}"><span><b>LOAD ${String(index+1).padStart(2,'0')}</b><small>${esc(outcome)}</small></span><i aria-hidden="true">⌄</i></button><span class="forge-matrix-exotic">${exotic?.icon?`<img src="${esc(exotic.icon)}" alt="">`:''}<small>EXOTIC</small></span><div class="forge-matrix-stats" aria-label="Calculated armour stats">${candidateStatMarkup(candidate)}</div><span class="forge-matrix-total"><small>TOTAL</small><b>${candidate.score.total}</b></span><span class="forge-matrix-protocol"><small>SET PROTOCOL</small><b>${esc(candidateSetProtocol(candidate))}</b></span><button type="button" class="forge-candidate-select" data-candidate-index="${index}">${selected?'STAGED':'STAGE LOAD'}</button></div><div class="forge-load-breakdown" id="forgeLoadBreakdown${index}" ${expanded?'':'hidden'}><div class="forge-breakdown-heading"><div><span>LOAD BREAKDOWN</span><strong>Five exact Bungie armour instances</strong></div><span>${esc(outcome)}</span></div><div class="forge-breakdown-items">${candidate.items.map(candidateItemMarkup).join('')}</div><div class="forge-breakdown-summary"><div><small>VERIFIED ARMOUR TOTAL</small><strong>${candidate.score.total}</strong></div><div><small>ACTIVE SET PROTOCOL</small><strong>${esc(candidateSetProtocol(candidate))}</strong></div><div class="forge-breakdown-actions"><button type="button" class="forge-candidate-select" data-candidate-index="${index}">${selected?'STAGED':'STAGE LOAD'}</button><button type="button" class="forge-candidate-evaluate" data-candidate-evaluate="${index}">EVALUATE IN BUILD FORGE</button></div></div></div></article>`;
}

function renderCandidates(){
  const panel=byId('forgeResults');panel.hidden=matchedBuilds.length===0;
  byId('forgeResultStatus').textContent=`${matchedBuilds.length} RESULT${matchedBuilds.length===1?'':'S'}`;
  byId('forgeCandidateBuilds').innerHTML=matchedBuilds.map(candidateMarkup).join('');
}

function stageCandidate(index){
  const candidate=matchedBuilds[Number(index)];if(!candidate)return;
  selectedCandidateIndex=Number(index);selectedSlots.clear();for(const item of candidate.items)selectedSlots.set(item.slotIndex,item);
  renderStaged();renderCandidates();
}

function toggleCandidateBreakdown(index){
  const candidate=matchedBuilds[Number(index)];if(!candidate)return;
  expandedCandidateIndex=expandedCandidateIndex===Number(index)?-1:Number(index);
  renderCandidates();
}

async function calculateBuilds(){
  const exotic=selectedExotic(),targets=targetValues();if(!exotic||!ARMOUR_STAT_KEYS.some(key=>targets[key]>0))return;
  const button=byId('forgeFindBuilds');button.disabled=true;button.textContent='CALCULATING VERIFIED LOADS…';
  byId('forgeRuntimeStatus').textContent='Applying the Exotic anchor, set protocol and requested stat constraints…';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  matchedBuilds=matchArmourBuilds(armourItems(),targets,{...solverOptions(),limit:5,beamLimit:5000});
  selectedCandidateIndex=-1;selectedSlots.clear();if(matchedBuilds.length)stageCandidate(0);else{renderStaged();renderCandidates();}
  button.textContent='CALCULATE 5 COMBINATIONS';button.disabled=false;
  byId('forgeRuntimeStatus').textContent=matchedBuilds.length?`${matchedBuilds.length} legal combination${matchedBuilds.length===1?'':'s'} calculated. Load 1 has been staged from exact owned instances.`:'No complete owned-armour combination satisfies the selected Exotic and set protocol.';
}

function resetResults(){matchedBuilds=[];selectedCandidateIndex=-1;expandedCandidateIndex=-1;selectedSlots.clear();renderStaged();renderCandidates();}

function selectExotic(hash){
  const next=exoticGroups().find(group=>group.owned&&group.hash===Number(hash));if(!next)return;
  selectedExoticHash=next.hash;setSelections=[];resetResults();renderExotics();renderSetBonuses();configureStats({reset:true});
  const exotic=selectedExotic();
  byId('forgeRuntimeStatus').textContent=exotic?`${exotic.name} anchored. ${exotic.instances.length} exact owned ${exotic.instances.length===1?'instance':'instances'} available for calculation.`:'Select an owned Exotic to initialise the Forge Loader.';
}

function toggleBonus(input){
  const exotic=selectedExotic();if(!exotic)return;
  setSelections=toggleSetSelection(armourItems(),exotic,setSelections,{setHash:Number(input.dataset.setHash),count:Number(input.dataset.setCount)},input.checked);
  resetResults();renderSetBonuses();configureStats();
  byId('forgeRuntimeStatus').textContent=setSelections.length?`Set protocol active: ${setSelections.map(row=>`${row.count}-piece`).join(' + ')}. Stat ceilings recalculated.`:'No set bonus required. Stat ceilings recalculated from all compatible armour.';
  if(activeTargetCount())void calculateBuilds();
}

function inspectItemFromTarget(target){
  const exoticHash=Number(target?.dataset?.inspectExotic);
  if(exoticHash){const group=exoticGroups().find(row=>row.hash===exoticHash);return group?{...(group.representative||group.preview),ownedInstance:group.owned}:null;}
  const key=target?.dataset?.inspectItem;
  return catalogue.armour.find(item=>itemKey(item)===String(key||''))||null;
}

function inspectStatsMarkup(item){
  if(item?.ownedInstance===false)return '<div class="forge-inspect-unowned">NOT OWNED · exact instance stats become available after acquisition.</div>';
  const stats=armourStatVector(item);
  return `<div class="forge-inspect-stats">${ARMOUR_STAT_KEYS.map(key=>{const value=Number(stats[key]||0),maximum=Math.max(1,...armourItems().map(row=>Number(armourStatVector(row)[key]||0)));return `<div class="forge-inspect-stat"><span>${esc(ARMOUR_STAT_LABELS[key])}</span><span class="forge-inspect-bar"><i style="width:${Math.min(100,value/maximum*100)}%"></i></span><b>${value}</b></div>`;}).join('')}</div>`;
}

function positionInspect(panel,anchor){
  const gap=12,bounds=anchor.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
  let left=bounds.right+gap;if(left+width>innerWidth-gap)left=bounds.left-width-gap;
  left=Math.max(gap,Math.min(left,innerWidth-width-gap));
  const top=Math.max(gap,Math.min(bounds.top,innerHeight-height-gap));
  panel.style.left=`${Math.round(left)}px`;panel.style.top=`${Math.round(top)}px`;panel.style.right='auto';
}

function showInspect(target){
  const item=inspectItemFromTarget(target),panel=byId('forgeItemInspect');if(!item||!panel)return;
  if(panel.parentElement!==document.documentElement)document.documentElement.append(panel);
  const owned=item.ownedInstance!==false;
  const statSummary=owned?`${item.power!==null?`✦ ${esc(item.power)} · `:''}Σ ${Number(item.totalStats||0)}`:'COLLECTION ENTRY';
  panel.innerHTML=`<div class="forge-inspect-brand">ASTRIX PARADOX · ${owned?'VERIFIED INSTANCE':'VERIFIED DEFINITION'}</div><div class="forge-inspect-tier"><h3>${esc(item.name)}</h3><p>${esc(`${item.slotLabel} · ${item.tier||'Exotic armour'}`)}</p></div><div class="forge-inspect-main">${item.icon?`<img src="${esc(item.icon)}" alt="">`:''}<div><strong>${statSummary}</strong><p>${esc(item.exoticPerk?.name||item.archetype?.name||(owned?'Verified armour':'Not owned'))}</p><p>${esc(item.exoticPerk?.description||item.description||'')}</p></div></div>${inspectStatsMarkup(item)}<div class="forge-inspect-foot"><span>${esc(owned?String(item.source?.label||'OWNED').toUpperCase():'NOT OWNED')}</span><span>${owned?'EXACT BUNGIE DATA':'BUNGIE COLLECTION DATA'}</span></div>`;
  panel.hidden=false;panel.setAttribute('aria-hidden','false');requestAnimationFrame(()=>positionInspect(panel,target));
}

function hideInspect(){const panel=byId('forgeItemInspect');if(panel){panel.hidden=true;panel.setAttribute('aria-hidden','true');}}

function evaluateInBuildForge(){
  if(selectedSlots.size!==5)return;
  const selected=prepareArmourSelection(payload,[...selectedSlots.values()]);
  const selection=createVaultArmourSelection({binding:membershipBinding(),slots:selected.map(item=>({slot:item.slotIndex,item})),sourcePage:'forge-loader'});
  if(!writeVaultArmourSelection(selection)){byId('forgeRuntimeStatus').textContent='The staged load could not be stored on this device. No build was changed.';return;}
  const url=new URL('../guardian-workspace-v2/paradox-build-space/',location.href);url.searchParams.set('vault','selection');
  for(const [key,value] of Object.entries(membershipBinding()))if(value)url.searchParams.set(key,value);
  markGuardianFastReturn();location.href=url;
}

function installEvents(){
  byId('forgeExoticSlots')?.addEventListener('click',event=>{const button=event.target.closest('[data-exotic-hash]');if(button)selectExotic(button.dataset.exoticHash);});
  byId('forgeSetList')?.addEventListener('change',event=>{const input=event.target.closest('[data-set-hash]');if(input)toggleBonus(input);});
  byId('forgeStatTargets')?.addEventListener('input',event=>{const label=event.target.closest('[data-target-stat]');if(!label)return;updateTargetLabel(label);resetResults();configureStats();byId('forgeRuntimeStatus').textContent='Stat target changed. Calculate to refresh the five legal combinations.';});
  byId('forgeStatTargets')?.addEventListener('change',event=>{if(event.target.matches('input[type="range"]')&&activeTargetCount())void calculateBuilds();});
  byId('forgeStatTargets')?.addEventListener('click',event=>{const button=event.target.closest('[data-max-stat]');if(!button)return;const label=button.closest('[data-target-stat]'),input=label?.querySelector('input');if(!input)return;input.value=input.max;updateTargetLabel(label);configureStats();void calculateBuilds();});
  byId('forgeFindBuilds')?.addEventListener('click',calculateBuilds);
  byId('forgeResetTargets')?.addEventListener('click',()=>{for(const input of document.querySelectorAll('[data-target-stat] input'))input.value='0';resetResults();configureStats();byId('forgeRuntimeStatus').textContent='Stat targets reset. Exotic and set protocol remain selected.';});
  byId('forgeCandidateBuilds')?.addEventListener('click',event=>{
    const evaluate=event.target.closest('[data-candidate-evaluate]');if(evaluate){stageCandidate(evaluate.dataset.candidateEvaluate);evaluateInBuildForge();return;}
    const stage=event.target.closest('[data-candidate-index]');if(stage){stageCandidate(stage.dataset.candidateIndex);return;}
    const expand=event.target.closest('[data-candidate-expand]');if(expand)toggleCandidateBreakdown(expand.dataset.candidateExpand);
  });
  byId('forgeEvaluate')?.addEventListener('click',evaluateInBuildForge);
  document.addEventListener('pointerover',event=>{const target=event.target.closest('[data-inspect-exotic],[data-inspect-item]');if(target)showInspect(target);});
  document.addEventListener('pointerout',event=>{const target=event.target.closest('[data-inspect-exotic],[data-inspect-item]');if(target&&!target.contains(event.relatedTarget))hideInspect();});
  document.addEventListener('focusin',event=>{const target=event.target.closest('[data-inspect-exotic],[data-inspect-item]');if(target)showInspect(target);});
  document.addEventListener('focusout',event=>{const target=event.target.closest('[data-inspect-exotic],[data-inspect-item]');if(target&&!target.contains(event.relatedTarget))hideInspect();});
  addEventListener('resize',hideInspect,{passive:true});addEventListener('scroll',hideInspect,{passive:true,capture:true});
  document.addEventListener('astrix:character-selected',event=>{resolveActiveCharacter(event.detail?.characterId);selectedExoticHash=null;setSelections=[];resetResults();renderHero();renderExotics();renderSetBonuses();configureStats({reset:true});byId('forgeRuntimeStatus').textContent=`${classLabel()} active. Select an owned Exotic.`;});
  document.addEventListener('astrix:manifest-progress',event=>loaderProgress(Math.max(24,Number(event.detail?.percent)||24),event.detail?.label||'Preparing Bungie manifest…'));
}

async function settleVisibleImages(){
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const images=[...document.querySelectorAll('#forgeExoticSlots img,#forgeHeroCard img')].slice(0,30).filter(image=>!image.complete);
  await Promise.race([Promise.all(images.map(image=>new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,3500))]);
}

async function init(){
  installEvents();byId('forgeConnectButton').href=authStartUrl();renderStaged();
  try{
    session=await getBungieSession();
    if(session?.authenticated!==true){byId('forgeSignedOut').hidden=false;byId('forgeConnectionState').textContent='SIGNED OUT';byId('forgeHeaderState').textContent='CONNECT BUNGIE';globalThis.AstrixLoader?.authRequired?.(authStartUrl());return;}
    byId('forgeConnectionState').textContent='BUNGIE CONNECTED';payload=await loadVerifiedPayload();
    loaderProgress(78,'Building verified Forge Loader inventory…');catalogue=createVaultCatalogue(payload);resolveActiveCharacter(activeCharacterId);
    renderHero();renderExotics();renderSetBonuses();configureStats({reset:true});
    const groups=exoticGroups(),ownedCount=groups.filter(group=>group.owned).length;byId('forgeRuntimeStatus').textContent=ownedCount?`${ownedCount} owned of ${groups.length} verified ${classLabel()} Exotic definition${groups.length===1?'':'s'}. Select an owned piece to begin.`:`${groups.length} verified ${classLabel()} Exotic definition${groups.length===1?'':'s'} shown; no owned instance can be selected.`;
    loaderProgress(92,'Rendering Forge Loader selector…');await settleVisibleImages();globalThis.AstrixLoader?.done?.();
  }catch(error){console.error('[ASTRIX Forge Loader]',error);byId('forgeConnectionState').textContent='ARMOUR UNAVAILABLE';byId('forgeRuntimeStatus').textContent=error?.message||'Verified Bungie armour is unavailable.';globalThis.AstrixLoader?.done?.();}
}

init();
