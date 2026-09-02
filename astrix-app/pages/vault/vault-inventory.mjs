import {resolveArmourSet} from '../guardian-workspace-v2/guardian-armour-set-resolver.mjs';
import {normaliseArmourSemantics} from '../guardian-workspace-v2/guardian-semantic-resolver.mjs?v=20260829-weapon-perk-hash-1';

const BUNGIE_ORIGIN='https://www.bungie.net';
const VAULT_BUCKET=138197802;
const POSTMASTER_BUCKET=215593132;
const ARMOUR_ITEM_TYPE=2;
const CLASS_NAMES=['titan','hunter','warlock'];
const ARMOUR_BUCKETS=Object.freeze([
  Object.freeze({hash:3448274439,key:'helmet',label:'Helmet'}),
  Object.freeze({hash:3551918588,key:'gauntlets',label:'Gauntlets'}),
  Object.freeze({hash:14239492,key:'chest',label:'Chest'}),
  Object.freeze({hash:20886954,key:'legs',label:'Legs'}),
  Object.freeze({hash:1585787867,key:'class-item',label:'Class Item'})
]);
const ARMOUR_SLOT_BY_HASH=new Map(ARMOUR_BUCKETS.map((row,index)=>[row.hash,{...row,index}]));
const SOURCE_PRIORITY={profile:0,vault:1,postmaster:2,carried:3,equipped:4};

const clone=value=>{
  try{return structuredClone(value);}
  catch{return JSON.parse(JSON.stringify(value??null));}
};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const absoluteIcon=path=>path?new URL(path,BUNGIE_ORIGIN).toString():'';
const definitionFor=(payload,hash)=>payload?.definitions?.[String(hash)]||null;
const itemKey=item=>String(item?.itemInstanceId||`${item?.itemHash||'unknown'}:${item?.source?.kind||'unknown'}:${item?.source?.characterId||''}`);

function displayIdentity(payload,hash){
  const definition=definitionFor(payload,hash)||{};
  const display=definition.displayProperties||{};
  return {
    hash:Number(hash),
    bungieHash:Number(hash),
    name:String(display.name||`Unresolved Destiny item ${hash}`),
    description:String(display.description||''),
    icon:absoluteIcon(display.icon),
    tier:String(definition.inventory?.tierTypeName||''),
    tierType:finite(definition.inventory?.tierType),
    itemTypeDisplayName:String(definition.itemTypeDisplayName||''),
    definition
  };
}

function socketCategory(payload,itemDefinition,socketIndex){
  const category=(itemDefinition?.sockets?.socketCategories||[]).find(row=>(row?.socketIndexes||[]).map(Number).includes(socketIndex))||null;
  const hash=finite(category?.socketCategoryHash);
  return {hash,definition:hash===null?null:payload?.socketCategoryDefinitions?.[String(hash)]||null};
}

function socketPlugs(payload,rawItem){
  if(!rawItem?.itemInstanceId)return [];
  const states=payload?.profile?.itemComponents?.sockets?.data?.[rawItem.itemInstanceId]?.sockets||[];
  const itemDefinition=definitionFor(payload,rawItem.itemHash)||{};
  return states.map((state,socketIndex)=>{
    const hash=finite(state?.plugHash);
    if(hash===null)return null;
    const identity=displayIdentity(payload,hash);
    const category=socketCategory(payload,itemDefinition,socketIndex);
    return {
      ...identity,
      socketIndex,
      socketCategoryHash:category.hash,
      socketCategoryDefinition:category.definition,
      isEnabled:state?.isEnabled!==false,
      isVisible:state?.isVisible!==false
    };
  }).filter(Boolean);
}

function sourceRows(profile={}){
  const rows=[];
  for(const item of profile?.profileInventory?.data?.items||[]){
    rows.push({item,source:{kind:Number(item?.bucketHash)===VAULT_BUCKET?'vault':'profile',characterId:null,label:Number(item?.bucketHash)===VAULT_BUCKET?'Vault':'Shared inventory'}});
  }
  for(const [characterId,inventory] of Object.entries(profile?.characterInventories?.data||{})){
    for(const item of inventory?.items||[]){
      const postmaster=Number(item?.bucketHash)===POSTMASTER_BUCKET;
      rows.push({item,source:{kind:postmaster?'postmaster':'carried',characterId:String(characterId),label:postmaster?'Postmaster':'Carried'}});
    }
  }
  for(const [characterId,equipment] of Object.entries(profile?.characterEquipment?.data||{})){
    for(const item of equipment?.items||[])rows.push({item,source:{kind:'equipped',characterId:String(characterId),label:'Equipped'}});
  }
  return rows;
}

function deduplicateRows(rows=[]){
  const unique=new Map();
  for(const row of rows){
    const key=String(row?.item?.itemInstanceId||'');
    if(!key){unique.set(`uninstanced:${unique.size}`,row);continue;}
    const prior=unique.get(key);
    if(!prior||SOURCE_PRIORITY[row.source.kind]>SOURCE_PRIORITY[prior.source.kind])unique.set(key,row);
  }
  return [...unique.values()];
}

function armourStats(payload,rawItem){
  const component=payload?.profile?.itemComponents?.stats?.data?.[rawItem?.itemInstanceId]?.stats||{};
  return Object.entries(component).map(([hash,row])=>{
    const definition=payload?.statDefinitions?.[String(hash)]||null;
    return {
      hash:Number(hash),
      name:String(definition?.displayProperties?.name||`Destiny stat ${hash}`),
      icon:absoluteIcon(definition?.displayProperties?.icon),
      value:Number(row?.value||0)
    };
  }).filter(row=>Number.isFinite(row.value)).sort((left,right)=>right.value-left.value);
}

function normaliseArmourItem(payload,row){
  const rawItem=row?.item||{};
  const definition=definitionFor(payload,rawItem.itemHash);
  if(!definition||Number(definition.itemType)!==ARMOUR_ITEM_TYPE)return null;
  const equipmentBucket=finite(definition.inventory?.bucketTypeHash);
  const slot=ARMOUR_SLOT_BY_HASH.get(equipmentBucket);
  if(!slot)return null;
  const identity=displayIdentity(payload,rawItem.itemHash);
  const instance=payload?.profile?.itemComponents?.instances?.data?.[rawItem.itemInstanceId]||null;
  const statsComponent=payload?.profile?.itemComponents?.stats?.data?.[rawItem.itemInstanceId]||null;
  const plugs=socketPlugs(payload,rawItem);
  const armourSemantics=normaliseArmourSemantics({plugs,instance,stats:statsComponent});
  const stats=armourStats(payload,rawItem);
  const masterworkSlot=armourSemantics.masterwork?{...armourSemantics.masterwork,semanticRole:'masterwork',energyCost:armourSemantics.tier}:null;
  const functionalMods=[...armourSemantics.generalMods,...armourSemantics.slotMods];
  const base={
    ...identity,
    itemHash:Number(rawItem.itemHash),
    itemInstanceId:String(rawItem.itemInstanceId||''),
    bucketHash:equipmentBucket,
    storageBucketHash:finite(rawItem.bucketHash),
    slotIndex:slot.index,
    slotKey:slot.key,
    slotLabel:slot.label,
    classType:finite(definition.classType),
    characterClass:CLASS_NAMES[Number(definition.classType)]||'any',
    source:clone(row.source),
    power:finite(instance?.primaryStat?.value),
    itemLevel:finite(instance?.itemLevel),
    gearTier:finite(instance?.gearTier),
    quality:finite(instance?.quality),
    state:Number(rawItem.state||0),
    stats,
    totalStats:stats.reduce((sum,stat)=>sum+stat.value,0),
    socketCoverage:{
      plugs,
      requested:plugs.map(plug=>Number(plug.hash)).filter(Number.isFinite),
      resolved:plugs.filter(plug=>plug.definition&&Object.keys(plug.definition).length).map(plug=>Number(plug.hash)),
      unresolved:plugs.filter(plug=>!plug.definition||!Object.keys(plug.definition).length).map(plug=>Number(plug.hash)),
      complete:plugs.every(plug=>plug.definition&&Object.keys(plug.definition).length)
    },
    socketsAvailable:Boolean(rawItem.itemInstanceId&&payload?.profile?.itemComponents?.sockets?.data?.[rawItem.itemInstanceId]),
    armourSemantics,
    armourTier:armourSemantics.tier,
    masterwork:armourSemantics.masterwork,
    energy:armourSemantics.energy,
    archetype:armourSemantics.archetype,
    exoticPerk:armourSemantics.exoticPerk,
    generalMods:armourSemantics.generalMods,
    slotMods:armourSemantics.slotMods,
    mods:functionalMods.length?[masterworkSlot,...armourSemantics.generalMods.slice(0,2),...armourSemantics.slotMods.slice(0,3)]:[],
    intrinsicTrait:armourSemantics.exoticPerk,
    isExotic:String(identity.tier).toLowerCase()==='exotic'
  };
  const set=resolveArmourSet(payload,base,[]);
  if(set){base.armourSemantics.set=set;base.setBonus=set;}
  return base;
}

function createVaultCatalogue(payload={}){
  const profile=payload?.profile||{};
  const rawRows=deduplicateRows(sourceRows(profile));
  const armour=rawRows.map(row=>normaliseArmourItem(payload,row)).filter(Boolean);
  const stored=profile?.profileInventory?.data?.items||[];
  const vaultStored=stored.filter(item=>Number(item?.bucketHash)===VAULT_BUCKET);
  const vaultArmour=vaultStored.filter(item=>Number(definitionFor(payload,item?.itemHash)?.itemType)===ARMOUR_ITEM_TYPE).length;
  const postmasterByCharacter=Object.fromEntries(Object.entries(profile?.characterInventories?.data||{}).map(([characterId,row])=>[
    String(characterId),(row?.items||[]).filter(item=>Number(item?.bucketHash)===POSTMASTER_BUCKET).length
  ]));
  return {
    armour,
    totals:{
      all:vaultStored.length,
      armour:vaultArmour,
      other:Math.max(0,vaultStored.length-vaultArmour),
      ownedArmour:armour.length,
      unresolvedDefinitions:rawRows.filter(row=>!definitionFor(payload,row?.item?.itemHash)).length
    },
    postmasterByCharacter
  };
}

function prepareArmourSelection(payload,items=[]){
  const selected=(Array.isArray(items)?items:[]).filter(Boolean).map(clone);
  return selected.map(item=>{
    const set=resolveArmourSet(payload,item,selected);
    if(!set)return item;
    return {...item,armourSemantics:{...(item.armourSemantics||{}),set},setBonus:set};
  });
}

function filterVaultArmour(items=[],filters={}){
  const search=String(filters.search||'').trim().toLowerCase();
  return (Array.isArray(items)?items:[]).filter(item=>{
    if(filters.characterClass&&filters.characterClass!=='all'&&item.characterClass!=='any'&&item.characterClass!==filters.characterClass)return false;
    if(filters.slot&&filters.slot!=='all'&&item.slotKey!==filters.slot)return false;
    if(filters.source&&filters.source!=='all'&&item.source?.kind!==filters.source)return false;
    if(search&&!String([item.name,item.description,item.slotLabel,item.characterClass,item.source?.label,item.archetype?.name,item.setBonus?.identity?.name].filter(Boolean).join(' ')).toLowerCase().includes(search))return false;
    return true;
  }).sort((left,right)=>{
    if(left.slotIndex!==right.slotIndex)return left.slotIndex-right.slotIndex;
    if(Boolean(left.isExotic)!==Boolean(right.isExotic))return left.isExotic?-1:1;
    if(right.totalStats!==left.totalStats)return right.totalStats-left.totalStats;
    return left.name.localeCompare(right.name);
  });
}

export {
  ARMOUR_BUCKETS,
  ARMOUR_ITEM_TYPE,
  CLASS_NAMES,
  POSTMASTER_BUCKET,
  VAULT_BUCKET,
  createVaultCatalogue,
  filterVaultArmour,
  itemKey,
  prepareArmourSelection
};
