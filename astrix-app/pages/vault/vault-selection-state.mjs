const VAULT_SELECTION_SCHEMA=1;
const VAULT_SELECTION_KIND='astrix-vault-armour-selection';
const VAULT_SELECTION_KEY='astrix:vault-armour-selection:v1';
const VAULT_SELECTION_TTL_MS=30*60*1000;
const ARMOUR_SLOT_COUNT=5;
const ARMOUR_STAT_CAP=200;

const clone=value=>{
  try{return structuredClone(value);}
  catch{return JSON.parse(JSON.stringify(value??null));}
};
const text=value=>String(value??'').trim();
const itemIdentity=item=>text(item?.itemInstanceId||item?.instanceId||item?.hash||item?.itemHash||item?.bungieHash);
const positiveInteger=value=>{const number=Number(value);return Number.isInteger(number)&&number>0?number:null;};
const nonNegative=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
const compactDisplayProperties=value=>({name:text(value?.name),description:text(value?.description),icon:text(value?.icon),highResIcon:text(value?.highResIcon)});
const compactPlugRules=value=>Array.isArray(value)?value.map(row=>({failureMessage:text(row?.failureMessage)})).filter(row=>row.failureMessage):[];
const compactTooltipNotifications=value=>Array.isArray(value)?value.map(row=>({displayString:text(row?.displayString??row?.displayText),displayStyle:text(row?.displayStyle)})).filter(row=>row.displayString):[];

function compactDefinition(value={}){
  const insertionRules=compactPlugRules(value?.plug?.insertionRules),enabledRules=compactPlugRules(value?.plug?.enabledRules),tooltipNotifications=compactTooltipNotifications(value?.tooltipNotifications),plug=value?.plug?{plugCategoryIdentifier:text(value.plug.plugCategoryIdentifier),energyCost:value.plug.energyCost??null}:null;
  if(plug&&insertionRules.length)plug.insertionRules=insertionRules;if(plug&&enabledRules.length)plug.enabledRules=enabledRules;
  const compact={
    hash:positiveInteger(value?.hash),
    displayProperties:compactDisplayProperties(value?.displayProperties),
    itemType:Number.isFinite(Number(value?.itemType))?Number(value.itemType):null,
    itemTypeDisplayName:text(value?.itemTypeDisplayName),
    traitIds:Array.isArray(value?.traitIds)?value.traitIds.map(text).filter(Boolean):[],
    inventory:value?.inventory?{tierType:Number(value.inventory.tierType)||0,tierTypeName:text(value.inventory.tierTypeName),tierTypeHash:positiveInteger(value.inventory.tierTypeHash),bucketTypeHash:positiveInteger(value.inventory.bucketTypeHash)}:null,
    plug,
    investmentStats:Array.isArray(value?.investmentStats)?value.investmentStats.map(row=>({statTypeHash:positiveInteger(row?.statTypeHash),value:Number(row?.value)||0,isConditionallyActive:Boolean(row?.isConditionallyActive)})):[],
    iconWatermark:text(value?.iconWatermark),
    quality:value?.quality?{displayVersionWatermarkIcons:Array.isArray(value.quality.displayVersionWatermarkIcons)?value.quality.displayVersionWatermarkIcons.map(text).filter(Boolean):[]}:null,
    equipableItemSetHash:positiveInteger(value?.equipableItemSetHash),
    equippingBlock:value?.equippingBlock?{equipableItemSetHash:positiveInteger(value.equippingBlock.equipableItemSetHash)}:null
  };if(tooltipNotifications.length)compact.tooltipNotifications=tooltipNotifications;return compact;
}

function compactSelectionValue(value,key=''){
  if(value===null||value===undefined||typeof value!=='object')return value;
  if(['definition','socketCategoryDefinition'].includes(key))return compactDefinition(value);
  if(Array.isArray(value))return value.map(row=>compactSelectionValue(row));
  const output={};
  for(const [childKey,childValue] of Object.entries(value)){
    if(['itemRenderData','gearAssets','renderData','loadouts','resolvedSandboxPerks','socketOptions'].includes(childKey))continue;
    output[childKey]=compactSelectionValue(childValue,childKey);
  }
  return output;
}

const compactArmourSelectionItem=item=>compactSelectionValue(item||{});
function storageCandidates(storage){
  if(Array.isArray(storage))return [...new Set(storage.filter(Boolean))];
  if(storage)return [storage];
  const stores=[];
  try{if(globalThis.sessionStorage)stores.push(globalThis.sessionStorage);}catch{}
  try{if(globalThis.localStorage)stores.push(globalThis.localStorage);}catch{}
  return [...new Set(stores)];
}

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
    const item=compactArmourSelectionItem(row?.item||null);
    if(!Number.isInteger(slot)||slot<0||slot>=ARMOUR_SLOT_COUNT||!itemIdentity(item))continue;
    unique.set(slot,{slot,item});
  }
  return [...unique.values()].sort((left,right)=>left.slot-right.slot);
}

function normaliseTrait(value){
  if(!value)return null;
  const trait={hash:positiveInteger(value.hash),name:text(value.name),description:text(value.description),icon:text(value.icon)};
  return trait.hash||trait.name||trait.description?trait:null;
}

function normaliseStatVector(value={}){
  return Object.fromEntries(['health','melee','grenade','super','class','weapon'].map(key=>[key,Math.min(ARMOUR_STAT_CAP,nonNegative(value?.[key]))]));
}

function normaliseStatPriorities(value={}){
  const used=new Set();
  return Object.fromEntries(['health','melee','grenade','super','class','weapon'].map(key=>{
    const rank=Math.round(nonNegative(value?.[key]));
    if(rank<1||rank>6||used.has(rank))return [key,0];
    used.add(rank);return [key,rank];
  }));
}

function normaliseForgeLoaderDecision(value){
  if(!value||Number(value.schemaVersion)!==1)return null;
  const anchor=value.buildAnchor||{},instanceId=text(anchor.selectedItemInstanceId),selectedItemHash=positiveInteger(anchor.selectedItemHash);
  if(!instanceId||!selectedItemHash)return null;
  const targets=normaliseStatVector(value.statDirective?.targets),achieved=normaliseStatVector(value.statDirective?.achieved);
  const setProtocol=(Array.isArray(value.setProtocol)?value.setProtocol:[]).map(row=>({setHash:positiveInteger(row?.setHash),count:Number(row?.count),setName:text(row?.setName),trait:normaliseTrait(row?.trait)})).filter(row=>row.setHash&&(row.count===2||row.count===4));
  const position=Math.max(1,Math.round(nonNegative(value.ranking?.position)||1));
  const totalCombinations=Math.max(position,Math.round(nonNegative(value.ranking?.totalCombinations)||position));
  return {
    schemaVersion:1,
    buildAnchor:{identityKey:text(anchor.identityKey),name:text(anchor.name),itemHashes:[...new Set((Array.isArray(anchor.itemHashes)?anchor.itemHashes:[]).map(positiveInteger).filter(Boolean))],selectedItemHash,selectedItemInstanceId:instanceId,perk:normaliseTrait(anchor.perk)},
    statDirective:{targets,priorities:normaliseStatPriorities(value.statDirective?.priorities),achieved,allTargetsMet:Boolean(value.statDirective?.allTargetsMet),shortfall:nonNegative(value.statDirective?.shortfall),rawTotal:nonNegative(value.statDirective?.rawTotal),modsApplied:false},
    setProtocol,
    ranking:{position,totalCombinations,maximized:position===1&&Boolean(value.ranking?.maximized)}
  };
}

function createVaultArmourSelection({binding={},slots=[],sourcePage='vault',forgeLoaderDecision=null}={}){
  const createdAt=Date.now();
  const sourcePageValue=text(sourcePage)||'vault',decision=normaliseForgeLoaderDecision(forgeLoaderDecision);
  return {
    schemaVersion:VAULT_SELECTION_SCHEMA,
    kind:VAULT_SELECTION_KIND,
    createdAt,
    expiresAt:createdAt+VAULT_SELECTION_TTL_MS,
    source:'bungie-live-vault',
    sourcePage:sourcePageValue,
    target:'build-forge',
    binding:normaliseBinding(binding),
    slots:normaliseSlots(slots),
    ...(sourcePageValue==='forge-loader'&&decision?{forgeLoaderDecision:decision}:{})
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
  const decision=value.forgeLoaderDecision?normaliseForgeLoaderDecision(value.forgeLoaderDecision):null;
  if(value.forgeLoaderDecision&&(!decision||text(value.sourcePage)!=='forge-loader'))return null;
  if(decision){
    const exoticSlots=slots.filter(row=>row.item?.isExotic===true);
    if(exoticSlots.length!==1)return null;
    const anchor=slots.find(row=>itemIdentity(row.item)===decision.buildAnchor.selectedItemInstanceId);
    const anchorHash=positiveInteger(anchor?.item?.itemHash??anchor?.item?.hash);
    if(!anchor||anchorHash!==decision.buildAnchor.selectedItemHash||anchor.item?.isExotic!==true)return null;
    if(decision.setProtocol.some(protocol=>slots.filter(row=>setHash(row.item)===protocol.setHash).length<protocol.count))return null;
  }
  return {...clone(value),binding,slots,...(decision?{forgeLoaderDecision:decision}:{})};
}

function writeVaultArmourSelection(selection,storage=null){
  const verified=validateVaultArmourSelection(selection);
  if(!verified)return false;
  const json=JSON.stringify(verified);
  for(const store of storageCandidates(storage))try{store.setItem(VAULT_SELECTION_KEY,json);return true;}catch{}
  return false;
}

function readVaultArmourSelection({expectedBinding={},storage=null}={}){
  for(const store of storageCandidates(storage)){
    try{
      const raw=JSON.parse(store.getItem(VAULT_SELECTION_KEY)||'null');
      const verified=validateVaultArmourSelection(raw,{expectedBinding});
      if(verified)return verified;
      if(raw)store.removeItem(VAULT_SELECTION_KEY);
    }catch{try{store.removeItem(VAULT_SELECTION_KEY);}catch{}}
  }
  return null;
}

function clearVaultArmourSelection(storage=null){
  let cleared=false;
  for(const store of storageCandidates(storage))try{store.removeItem(VAULT_SELECTION_KEY);cleared=true;}catch{}
  return cleared;
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
  // Original Build is already immutable here. Copy only the editable half so a
  // large transferred inventory is not duplicated twice for one armour change.
  const next={...state,workingBuild:clone(state.workingBuild)};
  const armour=Array.isArray(next.workingBuild.armour)?[...next.workingBuild.armour]:[];
  while(armour.length<ARMOUR_SLOT_COUNT)armour.push(null);
  for(const row of verified.slots)armour[row.slot]=clone(row.item);
  next.workingBuild.armour=recalculateArmourSets(armour.slice(0,ARMOUR_SLOT_COUNT));
  next.workingBuild.paradoxEvidence={...(next.workingBuild.paradoxEvidence||{}),armour:armourEvidence(next.workingBuild.armour)};
  next.workingBuild.hashCoverage={...(next.workingBuild.hashCoverage||{}),armour:armourCoverage(next.workingBuild.armour)};
  next.workingBuild.weaponRollAdvice=null;
  delete next.workingBuild.recommendationGeneratedAt;
  delete next.workingBuild.recommendationElement;
  delete next.workingBuild.recommendationStatus;
  delete next.workingBuild.forgeIntelligence;
  delete next.workingBuild.weaponSelectionRecommendation;
  delete next.workingBuild.armourModRecommendation;
  next.workingBuild.vaultArmourSelection={
    source:verified.source,
    sourcePage:verified.sourcePage,
    createdAt:new Date(verified.createdAt).toISOString(),
    itemInstanceIds:verified.slots.map(row=>itemIdentity(row.item)),
    slots:verified.slots.map(row=>row.slot)
  };
  if(verified.forgeLoaderDecision)next.workingBuild.forgeLoaderDecision=clone(verified.forgeLoaderDecision);
  else delete next.workingBuild.forgeLoaderDecision;
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
  compactArmourSelectionItem,
  createVaultArmourSelection,
  readVaultArmourSelection,
  validateVaultArmourSelection,
  writeVaultArmourSelection
};
