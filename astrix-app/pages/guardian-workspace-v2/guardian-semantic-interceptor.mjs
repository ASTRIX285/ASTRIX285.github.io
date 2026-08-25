import "./guardian-paradox-live-adapter.mjs";
import { resolveArmourSet } from "./guardian-armour-set-resolver.mjs";
import {
  normaliseArmourSemantics,
  normaliseWeaponSemantics,
  normaliseGuardianStats,
  validateArtifact
} from "./guardian-semantic-resolver.mjs";

const rawFetch=globalThis.fetch?.bind(globalThis);
let livePayload=null;
const loadoutPayloads=new Map();

function rememberPayload(url,payload){
  if(!payload||typeof payload!=="object")return;
  if(url.includes("/bungie/profile"))livePayload=payload;
  if(url.includes("/bungie/loadout")){
    const characterId=String(payload.characterId||"");
    const index=Number(payload.index);
    if(characterId&&Number.isInteger(index))loadoutPayloads.set(`${characterId}:${index}`,payload);
  }
}

if(rawFetch){
  globalThis.fetch=async (...args)=>{
    const response=await rawFetch(...args);
    try{
      const url=String(args[0]?.url||args[0]||"");
      if((url.includes("/bungie/profile")||url.includes("/bungie/loadout"))&&typeof response?.clone==="function"){
        const clone=response.clone();
        const payload=await clone.json().catch(()=>null);
        rememberPayload(url,payload);
      }
    }catch(error){
      console.warn("[ASTRIX semantics] raw payload capture failed",String(error));
    }
    return response;
  };
}

function payloadFor(detail){
  const characterId=String(detail?.characterId||"");
  const index=Number(detail?.selectedLoadoutIndex);
  if(detail?.loadoutSource==="bungie-live"&&characterId&&Number.isInteger(index)){
    return loadoutPayloads.get(`${characterId}:${index}`)||livePayload;
  }
  return livePayload;
}

function profileFor(detail,payload){
  return payload?.profile||livePayload?.profile||null;
}

function rawEquipment(detail,payload,profile){
  if(detail?.loadoutSource==="bungie-live"&&Array.isArray(payload?.selectedItems))return payload.selectedItems;
  return profile?.characterEquipment?.data?.[String(detail?.characterId||"")]?.items||[];
}

function definitionFor(payload,hash){
  return payload?.definitions?.[String(hash)]||livePayload?.definitions?.[String(hash)]||null;
}

function rawItemFor(normalised,rows,payload){
  if(!normalised)return null;
  const bucket=Number(normalised.bucketHash);
  const candidates=(rows||[]).filter(item=>{
    const def=definitionFor(payload,item.itemHash);
    return Number(def?.inventory?.bucketTypeHash)===bucket;
  });
  return candidates.find(item=>Number(item.itemHash)===Number(normalised.hash))||candidates[0]||null;
}

function enrichedPlugs(normalised,rawItem,profile){
  const plugs=normalised?.socketCoverage?.plugs||[];
  if(!rawItem?.itemInstanceId)return plugs;
  const states=profile?.itemComponents?.sockets?.data?.[rawItem.itemInstanceId]?.sockets||[];
  const occurrences=new Map();
  return plugs.map(plug=>{
    const hash=Number(plug?.hash);
    const matchingIndexes=states.map((state,index)=>Number(state?.plugHash)===hash?index:-1).filter(index=>index>=0);
    const occurrence=occurrences.get(hash)||0;
    const socketIndex=matchingIndexes[occurrence]??-1;
    occurrences.set(hash,occurrence+1);
    const state=socketIndex>=0?states[socketIndex]:null;
    return {
      ...plug,
      socketIndex:socketIndex>=0?socketIndex:null,
      isEnabled:state?state.isEnabled!==false:true,
      isVisible:state?state.isVisible!==false:true
    };
  });
}

function alternativeColumnsFor(rawItem,profile,payload){
  if(!rawItem?.itemInstanceId)return {};
  const reusable=profile?.itemComponents?.reusablePlugs?.data?.[rawItem.itemInstanceId]?.plugs||{};
  return Object.fromEntries(Object.entries(reusable).map(([socketIndex,rows])=>[
    socketIndex,
    (rows||[]).filter(row=>row?.canInsert!==false).map(row=>{
      const hash=Number(row?.plugItemHash??row?.plugHash);
      const definition=definitionFor(payload,hash);
      if(!Number.isInteger(hash)||!definition)return null;
      return {hash,bungieHash:hash,name:definition.displayProperties?.name||`Destiny perk ${hash}`,description:definition.displayProperties?.description||"",icon:definition.displayProperties?.icon||"",definition,socketIndex:Number(socketIndex),canInsert:true};
    }).filter(Boolean)
  ]).filter(([,rows])=>rows.length));
}

function instanceData(profile,rawItem){
  if(!rawItem?.itemInstanceId)return null;
  return profile?.itemComponents?.instances?.data?.[rawItem.itemInstanceId]||null;
}

function statData(profile,rawItem){
  if(!rawItem?.itemInstanceId)return null;
  return profile?.itemComponents?.stats?.data?.[rawItem.itemInstanceId]||null;
}

function armourEvidence(item){
  const semantic=item?.armourSemantics;
  if(!semantic)return [];
  const rows=[];
  const add=(source,role)=>{
    if(!source)return;
    rows.push({
      sourceKind:"armour",
      sourceHash:Number(source.hash)||null,
      sourceName:source.name||"Armour effect",
      semanticRole:role,
      description:source.description||"",
      verified:Boolean(source.definition&&Object.keys(source.definition).length),
      active:source.active!==false&&source.isEnabled!==false
    });
  };
  add(semantic.exoticPerk,"exotic-perk");
  add(semantic.archetype,"archetype");
  add(semantic.set?.twoPiece,"set-bonus-2");
  add(semantic.set?.fourPiece,"set-bonus-4");
  semantic.generalMods.forEach(mod=>add(mod,"general-mod"));
  semantic.slotMods.forEach(mod=>add(mod,"slot-mod"));
  return rows;
}

function enrichArmour(detail,payload,profile,rows){
  const equippedArmour=(detail.armour||[]).filter(Boolean);
  detail.armour=(detail.armour||[]).map(item=>{
    if(!item)return item;
    const rawItem=rawItemFor(item,rows,payload);
    const plugs=enrichedPlugs(item,rawItem,profile);
    const armourSemantics=normaliseArmourSemantics({
      plugs,
      instance:instanceData(profile,rawItem),
      stats:statData(profile,rawItem)
    });
    const exactSet=resolveArmourSet(payload,item,equippedArmour);
    if(exactSet)armourSemantics.set=exactSet;
    const masterworkSlot=armourSemantics.masterwork?{
      ...armourSemantics.masterwork,
      semanticRole:"masterwork",
      energyCost:armourSemantics.tier
    }:null;
    return {
      ...item,
      itemInstanceId:rawItem?.itemInstanceId||null,
      armourSemantics,
      armourTier:armourSemantics.tier,
      masterwork:armourSemantics.masterwork,
      energy:armourSemantics.energy,
      archetype:armourSemantics.archetype,
      exoticPerk:armourSemantics.exoticPerk,
      setBonus:armourSemantics.set,
      generalMods:armourSemantics.generalMods,
      slotMods:armourSemantics.slotMods,
      // Position 1 is permanently reserved for the verified armour upgrade
      // level. The following five positions retain Bungie's socket order.
      mods:[masterworkSlot,...armourSemantics.generalMods.slice(0,2),...armourSemantics.slotMods.slice(0,3)],
      intrinsicTrait:armourSemantics.exoticPerk||item.intrinsicTrait||null
    };
  });
}

function enrichWeapons(detail,payload,profile,rows){
  detail.weapons=(detail.weapons||[]).map(item=>{
    if(!item)return item;
    const rawItem=rawItemFor(item,rows,payload);
    const plugs=enrichedPlugs(item,rawItem,profile);
    const weaponSemantics=normaliseWeaponSemantics({
      profile,
      item:rawItem,
      plugs,
      instance:instanceData(profile,rawItem),
      stats:statData(profile,rawItem),
      alternativeColumns:alternativeColumnsFor(rawItem,profile,payload)
    });
    return {
      ...item,
      itemInstanceId:rawItem?.itemInstanceId||null,
      weaponSemantics,
      intrinsic:weaponSemantics.intrinsic,
      selectedPerks:weaponSemantics.selectedPerks,
      weaponMasterwork:weaponSemantics.masterwork,
      weaponMod:weaponSemantics.mod,
      catalyst:weaponSemantics.catalyst,
      championCapability:weaponSemantics.champion,
      weaponStats:weaponSemantics.stats
    };
  });
}

function aggregateCoverage(items=[]){
  const requested=[];
  const resolved=[];
  const unresolved=[];
  const semanticUnknown=[];
  for(const item of items.filter(Boolean)){
    requested.push(...(item.socketCoverage?.requested||[]));
    resolved.push(...(item.socketCoverage?.resolved||[]));
    unresolved.push(...(item.socketCoverage?.unresolved||[]));
    const semantics=item.armourSemantics||item.weaponSemantics;
    semanticUnknown.push(...(semantics?.unknownPlugs||[]).map(plug=>Number(plug.hash)).filter(Number.isFinite));
    if(semantics?.set?.unresolved&&Number.isInteger(Number(semantics.set.hash)))semanticUnknown.push(Number(semantics.set.hash));
  }
  return {
    requested:[...new Set(requested.map(Number))],
    resolved:[...new Set(resolved.map(Number))],
    unresolved:[...new Set(unresolved.map(Number))],
    semanticUnknown:[...new Set(semanticUnknown)],
    complete:unresolved.length===0&&semanticUnknown.length===0
  };
}

function enrich(detail){
  if(!detail||detail.source!=="bungie-live")return detail;
  const payload=payloadFor(detail);
  const profile=profileFor(detail,payload);
  if(!profile)return detail;
  const rows=rawEquipment(detail,payload,profile);
  enrichArmour(detail,payload,profile,rows);
  enrichWeapons(detail,payload,profile,rows);
  detail.statModel=normaliseGuardianStats(detail.stats||[]);
  detail.artifactValidation=validateArtifact(detail.artifact);
  detail.hashCoverage=detail.hashCoverage||{};
  detail.hashCoverage.armour=aggregateCoverage(detail.armour);
  detail.hashCoverage.weapons=aggregateCoverage(detail.weapons);
  detail.hashCoverage.armourSets=payload.armourSetCoverage||null;
  detail.paradoxEvidence=detail.paradoxEvidence||{};
  detail.paradoxEvidence.armour=detail.armour.flatMap(armourEvidence).filter(row=>row.active&&row.verified);
  detail.paradoxEvidence.artifact=(detail.artifact?.activePerks||[]).map(perk=>({
    sourceKind:"artifact",
    sourceHash:Number(perk.hash)||null,
    sourceName:perk.name||"Artifact perk",
    semanticRole:"artifact-applied-perk",
    description:perk.description||"",
    verified:Boolean(perk.definition&&Object.keys(perk.definition).length),
    active:true
  })).filter(row=>row.verified);
  return detail;
}

document.addEventListener("astrix:guardian-selection-changed",event=>{
  try{enrich(event.detail);}
  catch(error){console.error("[ASTRIX semantics] enrichment failed",error);}
});

export {enrich};
