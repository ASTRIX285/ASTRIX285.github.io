const VAULT_SELECTION_SCHEMA=1;
const VAULT_SELECTION_KIND='astrix-vault-armour-selection';
const VAULT_SELECTION_KEY='astrix:vault-armour-selection:v1';
const VAULT_SELECTION_TTL_MS=30*60*1000;
const ARMOUR_SLOT_COUNT=5;

const clone=value=>{
  try{return structuredClone(value);}
  catch{return JSON.parse(JSON.stringify(value??null));}
};
const text=value=>String(value??'').trim();
const itemIdentity=item=>text(item?.itemInstanceId||item?.instanceId||item?.hash||item?.itemHash||item?.bungieHash);

function normaliseBinding(binding={}){
  return {
    characterId:text(binding.characterId),
    membershipId:text(binding.membershipId),
    membershipType:text(binding.membershipType)
  };
}

function normaliseSlots(slots=[]){
  const unique=new Map();
  for(const row of Array.isArray(slots)?slots:[]){
    const slot=Number(row?.slot);
    const item=clone(row?.item||null);
    if(!Number.isInteger(slot)||slot<0||slot>=ARMOUR_SLOT_COUNT||!itemIdentity(item))continue;
    unique.set(slot,{slot,item});
  }
  return [...unique.values()].sort((left,right)=>left.slot-right.slot);
}

function createVaultArmourSelection({binding={},slots=[],sourcePage='vault'}={}){
  const createdAt=Date.now();
  return {
    schemaVersion:VAULT_SELECTION_SCHEMA,
    kind:VAULT_SELECTION_KIND,
    createdAt,
    expiresAt:createdAt+VAULT_SELECTION_TTL_MS,
    source:'bungie-live-vault',
    sourcePage:text(sourcePage)||'vault',
    target:'build-forge',
    binding:normaliseBinding(binding),
    slots:normaliseSlots(slots)
  };
}

function validateVaultArmourSelection(value,{expectedBinding={}}={}){
  if(!value||value.schemaVersion!==VAULT_SELECTION_SCHEMA||value.kind!==VAULT_SELECTION_KIND)return null;
  if(Number(value.expiresAt)<=Date.now())return null;
  const binding=normaliseBinding(value.binding);
  const expected=normaliseBinding(expectedBinding);
  if(!binding.characterId||!binding.membershipId||!binding.membershipType)return null;
  if(expected.characterId&&binding.characterId!==expected.characterId)return null;
  if(expected.membershipId&&binding.membershipId!==expected.membershipId)return null;
  if(expected.membershipType&&binding.membershipType!==expected.membershipType)return null;
  const slots=normaliseSlots(value.slots);
  if(!slots.length)return null;
  return {...clone(value),binding,slots};
}

function writeVaultArmourSelection(selection,storage=globalThis.sessionStorage){
  const verified=validateVaultArmourSelection(selection);
  if(!verified||!storage)return false;
  try{storage.setItem(VAULT_SELECTION_KEY,JSON.stringify(verified));return true;}
  catch{return false;}
}

function readVaultArmourSelection({expectedBinding={},storage=globalThis.sessionStorage}={}){
  if(!storage)return null;
  try{
    const raw=JSON.parse(storage.getItem(VAULT_SELECTION_KEY)||'null');
    const verified=validateVaultArmourSelection(raw,{expectedBinding});
    if(raw&&!verified)storage.removeItem(VAULT_SELECTION_KEY);
    return verified;
  }catch{
    try{storage.removeItem(VAULT_SELECTION_KEY);}catch{}
    return null;
  }
}

function clearVaultArmourSelection(storage=globalThis.sessionStorage){
  try{storage?.removeItem(VAULT_SELECTION_KEY);return true;}
  catch{return false;}
}

function armourEvidence(items=[]){
  const rows=[];
  const add=(source,semanticRole)=>{
    if(!source)return;
    rows.push({
      sourceKind:'armour',
      sourceHash:Number(source.hash)||null,
      sourceName:text(source.name||'Armour effect'),
      semanticRole,
      description:text(source.description),
      verified:Boolean(source.definition&&Object.keys(source.definition).length),
      active:source.active!==false&&source.isEnabled!==false
    });
  };
  for(const item of Array.isArray(items)?items:[]){
    const semantic=item?.armourSemantics||{};
    add(semantic.exoticPerk,'exotic-perk');
    add(semantic.archetype,'archetype');
    add(semantic.set?.twoPiece,'set-bonus-2');
    add(semantic.set?.fourPiece,'set-bonus-4');
    for(const mod of semantic.generalMods||[])add(mod,'general-mod');
    for(const mod of semantic.slotMods||[])add(mod,'slot-mod');
  }
  return rows.filter(row=>row.verified&&row.active);
}

function armourCoverage(items=[]){
  const requested=[];
  const resolved=[];
  const unresolved=[];
  const semanticUnknown=[];
  for(const item of Array.isArray(items)?items.filter(Boolean):[]){
    requested.push(...(item.socketCoverage?.requested||[]));
    resolved.push(...(item.socketCoverage?.resolved||[]));
    unresolved.push(...(item.socketCoverage?.unresolved||[]));
    semanticUnknown.push(...(item.armourSemantics?.unknownPlugs||[]).map(plug=>Number(plug.hash)).filter(Number.isFinite));
    if(item.armourSemantics?.set?.unresolved&&Number.isInteger(Number(item.armourSemantics.set.hash)))semanticUnknown.push(Number(item.armourSemantics.set.hash));
  }
  const unique=values=>[...new Set(values.map(Number).filter(Number.isFinite))];
  return {requested:unique(requested),resolved:unique(resolved),unresolved:unique(unresolved),semanticUnknown:unique(semanticUnknown),complete:unresolved.length===0&&semanticUnknown.length===0};
}

function setHash(item){
  const hash=Number(item?.definition?.equipableItemSetHash??item?.definition?.equippingBlock?.equipableItemSetHash??item?.setBonus?.hash??item?.armourSemantics?.set?.hash);
  return Number.isInteger(hash)&&hash>0?hash:null;
}

function recalculateArmourSets(items=[]){
  const armour=Array.isArray(items)?items:[];
  for(const item of armour.filter(Boolean)){
    const hash=setHash(item);
    const prior=item.armourSemantics?.set||item.setBonus||null;
    if(!hash||!prior||prior.unresolved)continue;
    const equippedCount=armour.filter(candidate=>setHash(candidate)===hash).length;
    const effects=(prior.effects||[]).map(effect=>({...effect,active:equippedCount>=Number(effect.requiredSetCount||0)}));
    const set={...prior,equippedCount,effects,twoPiece:effects.find(effect=>Number(effect.requiredSetCount)===2)||null,fourPiece:effects.find(effect=>Number(effect.requiredSetCount)===4)||null};
    item.armourSemantics={...(item.armourSemantics||{}),set};
    item.setBonus=set;
  }
  return armour;
}

function applyVaultArmourSelection(state,selection){
  const expectedBinding={
    characterId:state?.workingBuild?.characterId||state?.originalBuild?.characterId,
    membershipId:state?.workingBuild?.membershipId||state?.originalBuild?.membershipId,
    membershipType:state?.workingBuild?.membershipType||state?.originalBuild?.membershipType
  };
  const verified=validateVaultArmourSelection(selection,{expectedBinding});
  if(!verified||!state?.originalBuild||!state?.workingBuild)return {state,applied:false,selection:null};
  const next=clone(state);
  const armour=Array.isArray(next.workingBuild.armour)?[...next.workingBuild.armour]:[];
  while(armour.length<ARMOUR_SLOT_COUNT)armour.push(null);
  for(const row of verified.slots)armour[row.slot]=clone(row.item);
  next.workingBuild.armour=recalculateArmourSets(armour.slice(0,ARMOUR_SLOT_COUNT));
  next.workingBuild.paradoxEvidence={...(next.workingBuild.paradoxEvidence||{}),armour:armourEvidence(next.workingBuild.armour)};
  next.workingBuild.hashCoverage={...(next.workingBuild.hashCoverage||{}),armour:armourCoverage(next.workingBuild.armour)};
  next.workingBuild.weaponRollAdvice=null;
  next.workingBuild.vaultArmourSelection={
    source:verified.source,
    createdAt:new Date(verified.createdAt).toISOString(),
    itemInstanceIds:verified.slots.map(row=>itemIdentity(row.item)),
    slots:verified.slots.map(row=>row.slot)
  };
  next.recommendation=null;
  next.validationRecords=[];
  return {state:next,applied:true,selection:verified};
}

export {
  ARMOUR_SLOT_COUNT,
  VAULT_SELECTION_KEY,
  VAULT_SELECTION_KIND,
  VAULT_SELECTION_SCHEMA,
  applyVaultArmourSelection,
  clearVaultArmourSelection,
  createVaultArmourSelection,
  readVaultArmourSelection,
  validateVaultArmourSelection,
  writeVaultArmourSelection
};
