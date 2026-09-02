import {AUTH_ORIGIN,authStartUrl,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';
import {guardianManifest} from '../guardian-workspace-v2/guardian-manifest-service.mjs';
import {cacheBungieProfile,markGuardianFastReturn,readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs';
import {ARMOUR_BUCKETS,createVaultCatalogue,filterVaultArmour,itemKey,prepareArmourSelection} from './vault-inventory.mjs';
import {createVaultArmourSelection,writeVaultArmourSelection} from './vault-selection-state.mjs';

const PAGE_SIZE=48;
const SELECTED_CHARACTER_KEY='astrix:selected-character-id';
const CLASS_NAMES=['titan','hunter','warlock'];
const byId=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const text=value=>String(value??'').trim();
const params=new URLSearchParams(location.search);

let session=null;
let payload=null;
let catalogue={armour:[],totals:{all:0,armour:0,other:0,ownedArmour:0,unresolvedDefinitions:0},postmasterByCharacter:{}};
let activeCharacterId=text(params.get('characterId'));
let activeCharacterClass='';
let visibleLimit=PAGE_SIZE;
const selectedSlots=new Map();

function membershipBinding(){
  const membership=session?.activeDestinyMembership||{};
  return {
    characterId:activeCharacterId,
    membershipId:text(membership.membershipId||session?.primaryMembershipId||session?.bungieMembershipId),
    membershipType:text(membership.membershipType)
  };
}

function setStatus(message,state=''){
  const node=byId('vaultRuntimeStatus');
  if(node){node.textContent=message;node.className=`vault-runtime-status${state?` is-${state}`:''}`;}
}

function loaderProgress(percent,label){
  globalThis.AstrixLoader?.set?.(percent);
  globalThis.AstrixLoader?.status?.(label);
}

function characters(){return Object.values(payload?.profile?.characters?.data||{});}

function selectedCharacter(){return characters().find(character=>text(character.characterId)===activeCharacterId)||null;}

function mostRecentCharacter(){
  return characters().sort((left,right)=>text(right?.dateLastPlayed).localeCompare(text(left?.dateLastPlayed)))[0]||null;
}

function characterClass(character){return CLASS_NAMES[Number(character?.classType)]||'';}

function rememberActiveCharacter(characterId){
  try{sessionStorage.setItem(SELECTED_CHARACTER_KEY,text(characterId));}catch{}
}

function resolveActiveCharacter(requestedId=''){
  const rows=characters();
  let stored='';
  try{stored=text(sessionStorage.getItem(SELECTED_CHARACTER_KEY));}catch{}
  const requested=text(requestedId||activeCharacterId||stored);
  const character=rows.find(row=>text(row.characterId)===requested)||mostRecentCharacter();
  activeCharacterId=text(character?.characterId);
  activeCharacterClass=characterClass(character);
  if(activeCharacterId)rememberActiveCharacter(activeCharacterId);
  const classFilter=byId('vaultClassFilter');
  if(classFilter&&activeCharacterClass)classFilter.value=activeCharacterClass;
  return character;
}

async function fetchProfile(){
  const url=new URL('/bungie/profile',AUTH_ORIGIN);
  url.searchParams.set('scope','character');
  await guardianManifest.ready();
  if(guardianManifest.status().mode==='indexeddb')url.searchParams.set('definitions','client-manifest');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),60000);
  try{
    const response=await fetch(url,{credentials:'include',headers:{Accept:'application/json'},signal:controller.signal});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result?.error||`Bungie inventory request failed (${response.status}).`);
    return result;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Bungie inventory request timed out. Refresh or reconnect Bungie.');
    throw error;
  }finally{clearTimeout(timer);}
}

async function loadVerifiedPayload(){
  loaderProgress(18,'Checking verified Guardian inventory…');
  const cached=await readCachedBungieProfile(session);
  const shared=globalThis.ASTRIX_HERO_PROFILE_PAYLOAD||await globalThis.ASTRIX_HERO_PROFILE_PROMISE;
  const next=shared?.profile?shared:cached?.profile?cached:await fetchProfile();
  if(!next?.profile)throw new Error('Bungie returned no verified profile inventory.');
  loaderProgress(46,'Resolving Bungie manifest definitions…');
  await guardianManifest.hydratePayload(next);
  await cacheBungieProfile(session,next);
  return next;
}

function updateTotals(){
  byId('vaultTotalCount').textContent=String(catalogue.totals.all);
  byId('vaultArmourCount').textContent=String(catalogue.totals.armour);
  byId('vaultEquipmentCount').textContent=String(catalogue.totals.other);
  byId('vaultOwnedArmourCount').textContent=String(catalogue.totals.ownedArmour);
}

function itemCompatible(item){return !activeCharacterClass||item?.characterClass==='any'||item?.characterClass===activeCharacterClass;}

function selectedKeySet(){return new Set([...selectedSlots.values()].map(itemKey));}

function selectionSlotMarkup(slot,index){
  const item=selectedSlots.get(index);
  return `<div class="vault-selection-slot" data-selection-slot="${index}">${item?.icon?`<img src="${esc(item.icon)}" alt="">`:'<span class="vault-slot-empty" aria-hidden="true">◇</span>'}<span><b>${esc(item?.name||slot.label)}</b><small>${esc(item?`${item.source?.label||'Owned'} · ${item.totalStats} total`:'No item staged')}</small></span></div>`;
}

function renderSelection(){
  byId('vaultSelectionSlots').innerHTML=ARMOUR_BUCKETS.map(selectionSlotMarkup).join('');
  const count=selectedSlots.size;
  byId('vaultSelectionStatus').textContent=count?`${count} of ${ARMOUR_BUCKETS.length} armour slots staged for ${activeCharacterClass||'selected Guardian'}`:'No armour selected';
  byId('vaultClearSelection').disabled=!count;
  byId('vaultEvaluate').disabled=!count||!activeCharacterId;
}

function filters(){
  return {
    search:byId('vaultSearch')?.value||'',
    characterClass:byId('vaultClassFilter')?.value||'all',
    slot:byId('vaultSlotFilter')?.value||'all',
    source:byId('vaultSourceFilter')?.value||'all'
  };
}

function itemMarkup(item,selectedKeys){
  const selected=selectedKeys.has(itemKey(item));
  const compatible=itemCompatible(item);
  const setName=item.setBonus?.identity?.name||'';
  const className=['vault-item',selected?'is-selected':'',item.isExotic?'is-exotic':'',compatible?'':'is-incompatible'].filter(Boolean).join(' ');
  return `<button type="button" class="${className}" data-vault-item="${esc(itemKey(item))}" data-armour-slot="${item.slotIndex}" aria-pressed="${selected}" ${compatible?'':`disabled aria-label="${esc(item.name)} is not compatible with the selected ${activeCharacterClass||'Guardian'}"`}>
    <span class="vault-item-art">${item.icon?`<img src="${esc(item.icon)}" alt="" loading="lazy" decoding="async">`:''}${item.power!==null?`<span class="vault-item-power">✦ ${esc(item.power)}</span>`:''}<span class="vault-item-source">${esc(String(item.source?.label||'Owned').toUpperCase())}</span><span class="vault-item-total">Σ ${item.totalStats}</span></span>
    <span class="vault-item-copy"><b>${esc(item.name)}</b><small>${esc(`${item.slotLabel} · ${item.characterClass==='any'?'Any class':item.characterClass}`)}</small>${setName?`<small class="vault-item-set">${esc(setName)}</small>`:''}</span>
  </button>`;
}

function renderInventory(){
  const rows=filterVaultArmour(catalogue.armour,filters());
  const visible=rows.slice(0,visibleLimit);
  const selectedKeys=selectedKeySet();
  byId('vaultResultCount').textContent=`${rows.length} VERIFIED ITEM${rows.length===1?'':'S'}`;
  byId('vaultItemGrid').innerHTML=visible.length?visible.map(item=>itemMarkup(item,selectedKeys)).join(''):'<div class="vault-empty">No verified armour matches these filters.</div>';
  const loadMore=byId('vaultLoadMore');
  loadMore.hidden=visible.length>=rows.length;
  if(!loadMore.hidden)loadMore.textContent=`LOAD ${Math.min(PAGE_SIZE,rows.length-visible.length)} MORE ARMOUR`;
}

function postmasterStatus(){
  const count=Number(catalogue.postmasterByCharacter?.[activeCharacterId]||0);
  if(count)return ` · Postmaster reports ${count} item${count===1?'':'s'}`;
  return '';
}

function renderContext(){
  const source=text(params.get('from'));
  const character=selectedCharacter();
  const classLabel=activeCharacterClass?activeCharacterClass[0].toUpperCase()+activeCharacterClass.slice(1):'Guardian';
  byId('vaultReturnContext').textContent=source==='build'
    ?`Select armour for the ${classLabel} Working Build. Build Forge will preserve its immutable Original snapshot.`
    :`Choose up to one verified item per armour slot for ${classLabel}. The selection will become a separate Working Build; live equipment will not change.`;
  byId('vaultHeaderState').textContent=character?`${classLabel.toUpperCase()} INVENTORY`:'BUNGIE INVENTORY';
}

function renderAll(){renderContext();renderSelection();renderInventory();}

function selectItem(key){
  const item=catalogue.armour.find(row=>itemKey(row)===key);
  if(!item||!itemCompatible(item))return;
  if(itemKey(selectedSlots.get(item.slotIndex))===itemKey(item))selectedSlots.delete(item.slotIndex);
  else selectedSlots.set(item.slotIndex,item);
  renderSelection();
  renderInventory();
}

function evaluateInBuildForge(){
  if(!selectedSlots.size||!activeCharacterId)return;
  const selected=prepareArmourSelection(payload,[...selectedSlots.values()]);
  const selection=createVaultArmourSelection({binding:membershipBinding(),slots:selected.map(item=>({slot:item.slotIndex,item})),sourcePage:text(params.get('from'))||'vault'});
  if(!writeVaultArmourSelection(selection)){
    setStatus('The staged armour could not be stored on this device. No build was changed.','error');
    return;
  }
  const url=new URL('../guardian-workspace-v2/paradox-build-space/',location.href);
  url.searchParams.set('vault','selection');
  const binding=membershipBinding();
  for(const [key,value] of Object.entries(binding))if(value)url.searchParams.set(key,value);
  markGuardianFastReturn();
  location.href=url;
}

function clearIncompatibleSelection(){
  for(const [slot,item] of selectedSlots)if(!itemCompatible(item))selectedSlots.delete(slot);
}

function installEvents(){
  byId('vaultFilters')?.addEventListener('input',()=>{visibleLimit=PAGE_SIZE;renderInventory();});
  byId('vaultItemGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-vault-item]');if(button)selectItem(button.dataset.vaultItem);});
  byId('vaultClearSelection')?.addEventListener('click',()=>{selectedSlots.clear();renderAll();});
  byId('vaultEvaluate')?.addEventListener('click',evaluateInBuildForge);
  byId('vaultLoadMore')?.addEventListener('click',()=>{visibleLimit+=PAGE_SIZE;renderInventory();});
  document.addEventListener('astrix:character-selected',event=>{
    resolveActiveCharacter(event.detail?.characterId);
    clearIncompatibleSelection();
    visibleLimit=PAGE_SIZE;
    renderAll();
    setStatus(`${activeCharacterClass.toUpperCase()} inventory active${postmasterStatus()}.`,'good');
  });
  document.addEventListener('astrix:manifest-progress',event=>loaderProgress(Math.max(24,Number(event.detail?.percent)||24),event.detail?.label||'Preparing Bungie manifest…'));
}

async function settleVisibleImages(){
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const images=[...document.querySelectorAll('#vaultItemGrid img')].slice(0,24).filter(image=>!image.complete);
  await Promise.race([
    Promise.all(images.map(image=>new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}))),
    new Promise(resolve=>setTimeout(resolve,3500))
  ]);
}

async function init(){
  installEvents();
  byId('vaultConnectButton').href=authStartUrl();
  try{
    session=await getBungieSession();
    if(session?.authenticated!==true){
      byId('vaultSignedOut').hidden=false;
      byId('vaultConnectionState').textContent='SIGNED OUT';
      byId('vaultHeaderState').textContent='CONNECT BUNGIE';
      setStatus('Connect Bungie to load verified item instances. No inventory totals are estimated.');
      globalThis.AstrixLoader?.authRequired?.(authStartUrl());
      return;
    }
    byId('vaultConnectionState').textContent='BUNGIE CONNECTED';
    payload=await loadVerifiedPayload();
    loaderProgress(78,'Building verified armour catalogue…');
    catalogue=createVaultCatalogue(payload);
    resolveActiveCharacter(activeCharacterId);
    const requestedSlot=text(params.get('slot'));
    if(ARMOUR_BUCKETS.some(slot=>slot.key===requestedSlot))byId('vaultSlotFilter').value=requestedSlot;
    updateTotals();
    renderAll();
    loaderProgress(92,'Rendering verified armour catalogue…');
    const unresolved=catalogue.totals.unresolvedDefinitions;
    setStatus(`${catalogue.totals.ownedArmour} verified armour item${catalogue.totals.ownedArmour===1?'':'s'} loaded${unresolved?` · ${unresolved} item definition${unresolved===1?'':'s'} unresolved`:''}${postmasterStatus()}.`,'good');
    await settleVisibleImages();
    globalThis.AstrixLoader?.done?.();
  }catch(error){
    console.error('[ASTRIX Vault]',error);
    byId('vaultConnectionState').textContent='INVENTORY UNAVAILABLE';
    setStatus(error?.message||'Verified Bungie inventory is unavailable.','error');
    globalThis.AstrixLoader?.status?.(error?.message||'Verified Bungie inventory is unavailable.');
    globalThis.AstrixLoader?.done?.();
  }
}

init();
