import {getBungieSession} from "./guardian-bungie-auth.mjs";
import {resolveArtifactByProvenance} from "./guardian-artifact-provenance.mjs";
import {guardianManifest} from "./guardian-manifest-service.mjs";
import {
  cacheBungieProfile,
  readCachedBungieProfile,
  cacheBungieLoadoutDetail,
  readCachedBungieLoadoutDetail
} from "./guardian-session-cache.mjs";

const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||"https://auth.astrixparadox.com";
const BUNGIE_ORIGIN="https://www.bungie.net";
const CLASS_NAMES=["titan","hunter","warlock"];
const BUCKETS={kinetic:1498876634,energy:2465295065,power:953998645,helmet:3448274439,gauntlets:3551918588,chest:14239492,legs:20886954,classItem:1585787867,ghost:4023194814,subclass:3284755031};
const ARMOUR_ORDER=[BUCKETS.helmet,BUCKETS.gauntlets,BUCKETS.chest,BUCKETS.legs,BUCKETS.classItem];
const WEAPON_ORDER=[BUCKETS.kinetic,BUCKETS.energy,BUCKETS.power];
const STAT_ORDER=[
  2996146975,
  392767087,
  1943323491,
  1735777505,
  144602215,
  4244567218
];
const SELECTED_CHARACTER_KEY="astrix:selected-character-id";
const SELECTED_LOADOUT_KEY="astrix:selected-bungie-loadout-v1";
const loadoutCache=new Map();
let liveProfilePayload=null;
let liveProfileSession=null;
const manifestReady=guardianManifest.ready();

const setRenderStatus=(title,message,detail="")=>{
  const host=document.querySelector("#guardianHero.guardian-render-status");
  if(!host)return;
  const heading=host.querySelector("strong");
  const messageNode=host.querySelector(":scope > span:not(.guardian-render-status__icon)");
  const detailNode=host.querySelector("small");
  if(heading)heading.textContent=title;
  if(messageNode)messageNode.textContent=message;
  if(detailNode)detailNode.textContent=detail;
};

const PROFILE_REQUEST_TIMEOUT_MS=60_000;

async function fetchJsonWithTimeout(url,timeoutMs=PROFILE_REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{credentials:"include",headers:{Accept:"application/json"},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Bungie request failed (${response.status}).`);
    return payload;
  }catch(error){
    if(error?.name==="AbortError")throw new Error("Bungie profile request timed out. Refresh or reconnect Bungie.");
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

async function manifestRequestUrl(path){
  await manifestReady;
  const url=new URL(path,AUTH_ORIGIN);
  if(guardianManifest.status().mode==="indexeddb")url.searchParams.set("definitions","client-manifest");
  return url;
}

async function hydrateManifestPayload(payload){
  await guardianManifest.hydratePayload(payload);
  document.dispatchEvent(new CustomEvent("astrix:manifest-payload-hydrated",{detail:payload}));
  return payload;
}

const absoluteIcon=path=>path?new URL(path,BUNGIE_ORIGIN).toString():"";
const definition=(definitions,hash)=>definitions?.[String(hash)]||null;
const displayItem=(definitions,hash)=>{
  const row=definition(definitions,hash)||{};
  const displays=[row.displayProperties,...(row.resolvedSandboxPerks||[]).map(perk=>perk?.displayProperties)].filter(Boolean);
  const displayValue=key=>displays.find(display=>display?.[key])?.[key]||"";
  return {hash:Number(hash),bungieHash:Number(hash),name:displayValue("name")||`Unresolved Destiny item ${hash}`,description:displayValue("description"),icon:absoluteIcon(displayValue("icon")),tier:row.inventory?.tierTypeName||"",tierType:Number(row.inventory?.tierType??0),tierTypeHash:row.inventory?.tierTypeHash??null,tierIcon:absoluteIcon(row.iconWatermark||row.quality?.displayVersionWatermarkIcons?.[0]),itemTypeDisplayName:row.itemTypeDisplayName||"",bucketHash:row.inventory?.bucketTypeHash??null,definition:row};
};

function classifySubclass(item){
  const text=[item?.name,item?.description,...(item?.definition?.traitIds||[])].join(" ").toLowerCase();
  for(const name of ["prismatic","strand","stasis","solar","arc","void"]){if(text.includes(name))return name;}
  return "void";
}

function activeCharacter(profile){
  const rows=Object.values(profile?.characters?.data||{});
  return rows.sort((a,b)=>String(b.dateLastPlayed||"").localeCompare(String(a.dateLastPlayed||"")))[0]||null;
}

function rememberedCharacterId(profile){
  try{
    const id=String(sessionStorage.getItem(SELECTED_CHARACTER_KEY)||"");
    return id&&profile?.characters?.data?.[id]?id:"";
  }catch{
    return "";
  }
}

function rememberCharacterId(characterId){
  try{sessionStorage.setItem(SELECTED_CHARACTER_KEY,String(characterId||""));}
  catch{}
}

function rememberedLoadoutSelection(profile){
  try{
    const saved=JSON.parse(localStorage.getItem(SELECTED_LOADOUT_KEY)||"null");
    const characterId=String(saved?.characterId||"");
    const index=Number(saved?.index);
    if(!characterId||!Number.isInteger(index)||index<0||index>19||!profile?.characters?.data?.[characterId])return null;
    return {characterId,index};
  }catch{return null;}
}

function rememberLoadoutSelection(characterId,index){
  try{localStorage.setItem(SELECTED_LOADOUT_KEY,JSON.stringify({characterId:String(characterId||""),index:Number(index)}));}
  catch{}
}

function forgetLoadoutSelection(){
  try{localStorage.removeItem(SELECTED_LOADOUT_KEY);}
  catch{}
}

function guardianRank(profile){
  const progression=profile?.profileProgression?.data||{};
  const rank=progression.currentGuardianRank??progression.highestCurrentGuardianRank;
  return Number.isFinite(Number(rank))?Number(rank):null;
}

function equippedTitle(payload,character){
  const hash=character?.titleRecordHash;
  if(!hash)return {hash:null,name:""};
  const row=payload?.recordDefinitions?.[String(hash)]||payload?.definitions?.[String(hash)]||null;
  return {hash:Number(hash),name:String(row?.displayProperties?.name||"")};
}

function characterStats(payload,character){
  return STAT_ORDER.map(hash=>{
    const row=payload?.statDefinitions?.[String(hash)]||null;
    return [row?.displayProperties?.name||`Unresolved Destiny stat ${hash}`,Number(character?.stats?.[hash]??0),absoluteIcon(row?.displayProperties?.icon),hash];
  });
}

function characterRoster(payload,selectedCharacterId=null){
  const profile=payload?.profile||{};
  const rank=guardianRank(profile);
  const order={hunter:0,warlock:1,titan:2};
  return Object.values(profile?.characters?.data||{}).map(character=>{
    const characterClass=CLASS_NAMES[Number(character.classType)]||"hunter";
    const title=equippedTitle(payload,character);
    return {
      characterId:String(character.characterId||""),
      characterClass,
      power:character.light??null,
      guardianRank:rank,
      titleHash:title.hash,
      title:title.name,
      stats:characterStats(payload,character),
      emblem:{hash:character.emblemHash??null,icon:absoluteIcon(character.emblemPath),background:absoluteIcon(character.emblemBackgroundPath)},
      selected:String(character.characterId||"")===String(selectedCharacterId||"")
    };
  }).sort((a,b)=>(order[a.characterClass]??9)-(order[b.characterClass]??9));
}

function publishCharacterRoster(payload,selectedCharacterId){
  document.dispatchEvent(new CustomEvent("astrix:bungie-character-roster",{detail:{source:"bungie-live",selectedCharacterId:String(selectedCharacterId||""),characters:characterRoster(payload,selectedCharacterId)}}));
}

function socketResolution(profile,definitions,item,payload={}){
  if(!item?.itemInstanceId)return {plugs:[],requested:[],resolved:[],unresolved:[],complete:true};
  const sockets=profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]?.sockets||[];
  const socketCategories=definition(definitions,item.itemHash)?.sockets?.socketCategories||[];
  const requested=sockets.map(socket=>Number(socket.plugHash)).filter(Number.isFinite);
  const rows=sockets.map((socket,socketIndex)=>{
    const hash=Number(socket?.plugHash);
    const category=socketCategories.find(row=>(row?.socketIndexes||[]).map(Number).includes(socketIndex))||null;
    const socketCategoryHash=Number(category?.socketCategoryHash);
    const socketCategoryDefinition=Number.isFinite(socketCategoryHash)?payload?.socketCategoryDefinitions?.[String(socketCategoryHash)]||null:null;
    return Number.isFinite(hash)?{...displayItem(definitions,hash),socketIndex,socketCategoryHash:Number.isFinite(socketCategoryHash)?socketCategoryHash:null,socketCategoryDefinition}:null;
  }).filter(Boolean);
  const plugs=rows;
  const resolved=plugs.filter(row=>row.definition&&Object.keys(row.definition).length>0).map(row=>Number(row.hash));
  const unresolved=requested.filter(hash=>!definition(definitions,hash));
  return {plugs,requested,resolved,unresolved,complete:unresolved.length===0};
}

function socketPlugs(profile,definitions,item,payload={}){
  return socketResolution(profile,definitions,item,payload).plugs;
}

function plugType(plug){
  return [
    plug?.itemTypeDisplayName,
    plug?.name,
    plug?.definition?.plug?.plugCategoryIdentifier,
    plug?.socketCategoryDefinition?.displayProperties?.name,
    plug?.socketCategoryDefinition?.displayProperties?.description,
    ...(plug?.definition?.traitIds||[])
  ].filter(Boolean).join(" ").toLowerCase();
}

/* Bungie subclass plugs use stable category identifiers such as "supers",
 * "class_abilities", "movement", "melee", "grenades", "aspects" and
 * "fragments". Do not require the display text to contain an exact singular
 * English word: that caused valid equipped Supers to be missed. */
const plugCategory=plug=>String(plug?.definition?.plug?.plugCategoryIdentifier||"").toLowerCase();
const matchesCategory=(plug,categoryWords,textPattern)=>{
  const category=plugCategory(plug);
  if(categoryWords.some(word=>category===word||category.includes(word)))return true;
  return textPattern.test(plugType(plug));
};
const isSuperPlug=plug=>matchesCategory(plug,["super","supers"],/(^|[\W_])supers?([\W_]|$)|super ability|super_ability/);
const isClassAbilityPlug=plug=>matchesCategory(plug,["class_abilit","classabilit"],/class ability|class_ability/);
const isMovementPlug=plug=>matchesCategory(plug,["movement","jump","lift","glide"],/movement|jump|lift|glide/);
const isMeleePlug=plug=>matchesCategory(plug,["melee"],/melee/);
const isGrenadePlug=plug=>matchesCategory(plug,["grenade"],/grenade/);
const isAspectPlug=plug=>matchesCategory(plug,["aspect"],/aspect/);
const isFragmentPlug=plug=>matchesCategory(plug,["fragment"],/fragment/);
const isTranscendencePlug=plug=>{
  const itemType=String(plug?.itemTypeDisplayName||plug?.definition?.itemTypeDisplayName||"").toLowerCase();
  const name=String(plug?.name||plug?.definition?.displayProperties?.name||"").toLowerCase();
  return itemType==="utility ability"||itemType==="prismatic grenade"||name==="transcendence"||plugCategory(plug).includes("transcend");
};

const uniqueItems=rows=>rows.filter((row,index,all)=>row&&Number.isFinite(Number(row.hash))&&all.findIndex(other=>Number(other?.hash)===Number(row.hash))===index);

function subclassCandidatePlugs(profile,definitions,item,characterId=""){
  const reusable=profile?.itemComponents?.reusablePlugs?.data?.[item?.itemInstanceId]?.plugs||{};
  const reusableHashes=Object.values(reusable).flatMap(rows=>Array.isArray(rows)?rows:[])
    .map(row=>Number(row?.plugItemHash??row?.plugHash)).filter(Number.isFinite);
  const itemDef=definition(definitions,item?.itemHash)||{};
  const socketEntries=itemDef.sockets?.socketEntries||[];
  const manifestHashes=socketEntries.map(entry=>Number(entry?.singleInitialItemHash)).filter(Number.isFinite);
  const plugSetHashes=socketEntries.map(entry=>Number(entry?.reusablePlugSetHash)).filter(Number.isInteger);
  const plugSets=[profile?.profilePlugSets?.data?.plugs,profile?.characterPlugSets?.data?.[characterId]?.plugs];
  const availablePlugSetHashes=plugSets.flatMap(plugs=>plugSetHashes.flatMap(hash=>plugs?.[String(hash)]||[]))
    .filter(row=>row?.canInsert!==false&&row?.enabled!==false)
    .map(row=>Number(row?.plugItemHash??row?.plugHash)).filter(Number.isFinite);
  const availableHashes=[...reusableHashes,...availablePlugSetHashes];
  return uniqueItems([...(availableHashes.length?availableHashes:manifestHashes)]
    .map(hash=>displayItem(definitions,hash))
    .filter(row=>row.definition&&Object.keys(row.definition).length));
}

function normaliseItem(profile,definitions,item,payload={}){
  const base=displayItem(definitions,item.itemHash);
  const override=Number.isInteger(Number(item?.overrideStyleItemHash))?displayItem(definitions,Number(item.overrideStyleItemHash)):null;
  const instance=item.itemInstanceId?profile?.itemComponents?.instances?.data?.[item.itemInstanceId]:null;
  const socketCoverage=socketResolution(profile,definitions,item,payload);
  const plugs=socketCoverage.plugs;
  const shader=plugs.find(plug=>/shader/.test(plugType(plug)))||null;
  const ornament=plugs.find(plug=>/skin|ornament/.test(plugType(plug)))||null;
  const intrinsicTrait=plugs.find(plug=>/intrinsic|exotic perk/.test(plugType(plug)))||null;
  const mods=plugs.filter(plug=>{
    const type=plugType(plug);
    const isAppearance=/shader|skin|ornament/.test(type);
    const isSubclass=isSuperPlug(plug)||isClassAbilityPlug(plug)||isMovementPlug(plug)||isMeleePlug(plug)||isGrenadePlug(plug)||isAspectPlug(plug)||isFragmentPlug(plug);
    return !isAppearance&&!isSubclass&&intrinsicTrait?.hash!==plug.hash&&(
      /mod|enhancement|armour\.mods|armor\.mods/.test(type)
      ||Number(plug.definition?.itemType)===19
    );
  });
  return {
    ...base,
    icon:override?.definition&&Object.keys(override.definition).length?override.icon:base.icon,
    exactStyleHash:override?.definition&&Object.keys(override.definition).length?Number(item.overrideStyleItemHash):null,
    isHolofoil:Boolean((override?.definition||base.definition)?.isHolofoil),
    versionNumber:Number.isInteger(Number(item?.versionNumber))?Number(item.versionNumber):null,
    power:instance?.primaryStat?.value??null,
    itemLevel:Number.isFinite(Number(instance?.itemLevel))?Number(instance.itemLevel):null,
    gearTier:Number.isFinite(Number(instance?.gearTier))?Number(instance.gearTier):null,
    quality:Number.isFinite(Number(instance?.quality))?Number(instance.quality):null,
    state:Number(item?.state??0),
    damageTypeHash:instance?.damageTypeHash??base.definition?.defaultDamageTypeHash??null,
    elementDefinition:payload?.damageDefinitions?.[String(instance?.damageTypeHash??base.definition?.defaultDamageTypeHash)]||null,
    breakerDefinition:payload?.breakerDefinitions?.[String(instance?.breakerTypeHash??base.definition?.breakerTypeHash)]||null,
    isExotic:String(base.tier).toLowerCase()==="exotic",
    shader,
    ornament,
    intrinsicTrait,
    appearancePlugs:[shader,ornament].filter(Boolean),
    mods,
    socketsAvailable:Boolean(item?.itemInstanceId&&profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]),
    socketCoverage
  };
}

function subclassConfiguration(profile,definitions,item,payload={},characterId=""){
  const socketCoverage=socketResolution(profile,definitions,item,payload);
  const plugs=socketCoverage.plugs;
  const superItem=plugs.find(isSuperPlug)||null;
  console.log("[TRACE super] subclassItem:", item?.itemHash, "instance:", item?.itemInstanceId, "→ super:", superItem?.hash, superItem?.name, "| cat:", superItem?.definition?.plug?.plugCategoryIdentifier);
  const classAbility=plugs.find(isClassAbilityPlug)||null;
  const movement=plugs.find(isMovementPlug)||null;
  const melee=plugs.find(isMeleePlug)||null;
  const grenade=plugs.find(isGrenadePlug)||null;

  const candidates=subclassCandidatePlugs(profile,definitions,item,characterId);
  const optionsFor=(equipped,predicate)=>uniqueItems([equipped,...candidates.filter(predicate)]);

  const superOptions=[
    superItem,
    ...candidates.filter(isSuperPlug)
  ].filter((row,index,rows)=>row&&rows.findIndex(other=>Number(other.hash)===Number(row.hash))===index)
    .map(row=>{
      const damageHash=Number(row?.damageTypeHash??row?.definition?.defaultDamageTypeHash??row?.definition?.damageTypeHashes?.[0]);
      const elementDefinition=Number.isFinite(damageHash)?payload?.damageDefinitions?.[String(damageHash)]||null:null;
      return {...row,damageTypeHash:Number.isFinite(damageHash)?damageHash:null,elementDefinition};
    });
  const transcendenceOptions=plugs.filter(isTranscendencePlug);
  const transcendenceSlots=transcendenceOptions.slice(0,2).map(row=>({socketIndex:row.socketIndex,equipped:row,options:[row]}));
  const abilityOptionsBySocket={
    classAbility:optionsFor(classAbility,isClassAbilityPlug),
    movement:optionsFor(movement,isMovementPlug),
    melee:optionsFor(melee,isMeleePlug),
    grenade:optionsFor(grenade,isGrenadePlug)
  };
  const availableAspects=optionsFor(null,isAspectPlug);
  const availableFragments=optionsFor(null,isFragmentPlug);

  return {
    super:superItem||null,
    superOptions,
    transcendenceOptions,
    transcendenceSlots,
    classAbility,
    movement,
    melee,
    grenade,
    abilities:[classAbility,movement,melee,grenade].filter(Boolean),
    abilityOptionsBySocket,
    availableAbilities:uniqueItems(Object.values(abilityOptionsBySocket).flat()),
    aspects:plugs.filter(isAspectPlug),
    fragments:plugs.filter(isFragmentPlug),
    availableAspects,
    aspectOptions:availableAspects,
    availableFragments,
    fragmentOptions:availableFragments,
    socketsAvailable:Boolean(item?.itemInstanceId&&profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]),
    reusablePlugsAvailable:Boolean(item?.itemInstanceId&&profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]),
    socketCoverage
  };
}

function currentArtifact(payload,characterId){
  return resolveArtifactByProvenance(payload,characterId);
}

function availableArtifactItems(payload,current){
  const profile=payload?.profile||{};
  const definitions=payload?.definitions||{};
  const inventoryItems=[
    ...(profile?.profileInventory?.data?.items||[]),
    ...Object.values(profile?.characterInventories?.data||{}).flatMap(row=>row?.items||[]),
    ...Object.values(profile?.characterEquipment?.data||{}).flatMap(row=>row?.items||[])
  ];
  const inventoryArtifacts=inventoryItems.map(item=>displayItem(definitions,item?.itemHash)).filter(item=>{
    const type=[item?.itemTypeDisplayName,item?.definition?.itemTypeAndTierDisplayName,item?.definition?.displayProperties?.name].join(" ").toLowerCase();
    return type.includes("artifact");
  });
  return uniqueItems([current,...inventoryArtifacts]);
}

function identityCosmetics(profile,definitions,equipment,character,payload={}){
  const ghostItem=equipment.find(item=>definition(definitions,item.itemHash)?.inventory?.bucketTypeHash===BUCKETS.ghost);
  const allPlugs=equipment.flatMap(item=>socketPlugs(profile,definitions,item,payload));
  const shader=allPlugs.find(plug=>String(plug.definition?.plug?.plugCategoryIdentifier||"").includes("shader"))||null;
  return {ghost:ghostItem?normaliseItem(profile,definitions,ghostItem,payload):null,shader,emblem:{hash:character.emblemHash??null,icon:absoluteIcon(character.emblemPath),background:absoluteIcon(character.emblemBackgroundPath)}};
}

function normaliseLiveProfile(payload,session,preferredCharacterId=null){
  const profile=payload.profile||{};
  const definitions=payload.definitions||{};
  const explicitCharacterId=String(preferredCharacterId||"");
  const character=explicitCharacterId?profile?.characters?.data?.[explicitCharacterId]:activeCharacter(profile);
  console.log("[TRACE resolve] preferred:", preferredCharacterId, "→ resolved:", character?.characterId, "class:", character?.classType);
  if(explicitCharacterId&&!character)throw new Error(`Selected Bungie character was not found: ${explicitCharacterId}`);
  if(!character?.characterId)throw new Error("No Destiny character was returned for this membership.");
  const equipment=profile?.characterEquipment?.data?.[character.characterId]?.items||[];
  const byBucket=hash=>equipment.find(item=>definition(definitions,item.itemHash)?.inventory?.bucketTypeHash===hash)||null;
  const weapons=WEAPON_ORDER.map(hash=>byBucket(hash)).filter(Boolean).map(item=>normaliseItem(profile,definitions,item,payload));
  const armour=ARMOUR_ORDER.map(hash=>byBucket(hash)).map(item=>item?normaliseItem(profile,definitions,item,payload):null);
  const subclassItem=byBucket(BUCKETS.subclass);
  const subclass=subclassItem?displayItem(definitions,subclassItem.itemHash):null;
  const subclassItems=[subclassItem,...(profile?.characterInventories?.data?.[character.characterId]?.items||[])].filter(item=>item&&definition(definitions,item.itemHash)?.inventory?.bucketTypeHash===BUCKETS.subclass);
  const subclassCatalog=subclassItems.map(item=>{const display=displayItem(definitions,item.itemHash),element=classifySubclass(display);return {...display,itemInstanceId:item.itemInstanceId||null,element,subclass:element,key:element,subclassBuild:subclassConfiguration(profile,definitions,item,payload,character.characterId)}}).filter((item,index,rows)=>rows.findIndex(other=>other.element===item.element)===index);
  const subclassBuild=subclassCatalog.find(item=>Number(item.hash)===Number(subclassItem?.itemHash))?.subclassBuild||{super:null,superOptions:[],classAbility:null,movement:null,melee:null,grenade:null,abilities:[],abilityOptionsBySocket:{classAbility:[],movement:[],melee:[],grenade:[]},availableAbilities:[],aspects:[],availableAspects:[],aspectOptions:[],fragments:[],availableFragments:[],fragmentOptions:[],socketsAvailable:false,reusablePlugsAvailable:false,socketCoverage:{plugs:[],requested:[],resolved:[],unresolved:[],complete:true}};
  const cosmetics=identityCosmetics(profile,definitions,equipment,character,payload);
  const artifact=currentArtifact(payload,character.characterId);
  const availableArtifacts=availableArtifactItems(payload,artifact);
  const characterLoadouts=profile?.characterLoadouts?.data?.[character.characterId];
  const loadoutsAvailable=Array.isArray(characterLoadouts?.loadouts);
  const rank=guardianRank(profile);
  const title=equippedTitle(payload,character);
  const hashCoverage={
    definitions:payload?.definitionCoverage||null,
    subclass:subclassBuild.socketCoverage,
    artifact:payload?.artifactCoverage||null
  };
  if(hashCoverage.subclass?.unresolved?.length){
    console.warn("[ASTRIX hash coverage] unresolved subclass plug hashes",hashCoverage.subclass.unresolved);
  }
  return {
    source:"bungie-live",
    characterId:character.characterId,
    characterClass:CLASS_NAMES[Number(character.classType)]||"hunter",
    subclass:classifySubclass(subclass),
    subclassName:subclass?.name||"Subclass",
    subclassIcon:subclass?.icon||"",
    subclassCatalog,
    subclassBuild,
    super:subclassBuild.super,
    superOptions:subclassBuild.superOptions,
    classAbility:subclassBuild.classAbility,
    movement:subclassBuild.movement,
    melee:subclassBuild.melee,
    grenade:subclassBuild.grenade,
    abilities:subclassBuild.abilities,
    abilityOptionsBySocket:subclassBuild.abilityOptionsBySocket,
    availableAbilities:subclassBuild.availableAbilities,
    aspects:subclassBuild.aspects,
    fragments:subclassBuild.fragments,
    availableAspects:subclassBuild.availableAspects,
    aspectOptions:subclassBuild.aspectOptions,
    availableFragments:subclassBuild.availableFragments,
    fragmentOptions:subclassBuild.fragmentOptions,
    artifact,
    availableArtifacts,
    artifactOptions:availableArtifacts,
    artifactConfiguration:artifact?.artifactConfiguration||null,
    hashCoverage,
    power:character.light??null,
    guardianRank:rank,
    titleHash:title.hash,
    title:title.name,
    stats:characterStats(payload,character),
    weapons,
    armour,
    ...cosmetics,
    ornaments:armour.map(item=>item?.ornament).filter(Boolean),
    renderData:profile?.characterRenderData?.data?.[character.characterId]||null,
    itemRenderData:profile?.itemComponents?.renderData?.data||{},
    gearAssets:payload.gearAssets||{},
    loadoutsAvailable,
    loadouts:loadoutsAvailable?characterLoadouts.loadouts:[],
    displayName:payload.membership?.displayName||session?.activeDestinyMembership?.displayName||"Guardian"
  };
}

function profileWithSelectedLoadout(payload){
  const profile=structuredClone(payload.profile||{});
  const characterId=String(payload.characterId||"");
  const items=Array.isArray(payload.selectedItems)?payload.selectedItems:[];
  profile.characterEquipment=profile.characterEquipment||{data:{}};
  profile.characterEquipment.data=profile.characterEquipment.data||{};
  profile.characterEquipment.data[characterId]={items:items.map(({plugItemHashes,...item})=>item)};
  profile.itemComponents=profile.itemComponents||{};
  profile.itemComponents.sockets=profile.itemComponents.sockets||{data:{}};
  profile.itemComponents.sockets.data=profile.itemComponents.sockets.data||{};
  items.forEach(item=>{
    if(!item.itemInstanceId)return;
    if(Array.isArray(item.plugItemHashes)){
      profile.itemComponents.sockets.data[item.itemInstanceId]={sockets:item.plugItemHashes.map(plugHash=>({plugHash}))};
    }
  });
  const statData=profile?.itemComponents?.stats?.data||{};
  const character=profile?.characters?.data?.[characterId];
  if(character){
    const totals={};
    STAT_ORDER.forEach(hash=>{totals[hash]=items.reduce((sum,item)=>sum+Number(statData?.[item.itemInstanceId]?.stats?.[hash]?.value||0),0)});
    character.stats=totals;
  }
  return profile;
}

function mergeLoadoutContext(payload){
  if(!liveProfilePayload)return payload;
  const live=liveProfilePayload;
  payload.profile={
    ...(live.profile||{}),
    ...(payload.profile||{}),
    characters:payload.profile?.characters||live.profile?.characters,
    profileInventory:payload.profile?.profileInventory||live.profile?.profileInventory,
    characterInventories:payload.profile?.characterInventories||live.profile?.characterInventories,
    characterLoadouts:payload.profile?.characterLoadouts||live.profile?.characterLoadouts,
    characterProgressions:payload.profile?.characterProgressions||live.profile?.characterProgressions,
    profileProgression:payload.profile?.profileProgression||live.profile?.profileProgression,
    itemComponents:{
      ...(live.profile?.itemComponents||{}),
      ...(payload.profile?.itemComponents||{})
    }
  };
  payload.definitions={...(live.definitions||{}),...(payload.definitions||{})};
  payload.damageDefinitions={...(live.damageDefinitions||{}),...(payload.damageDefinitions||{})};
  payload.breakerDefinitions={...(live.breakerDefinitions||{}),...(payload.breakerDefinitions||{})};
  payload.recordDefinitions={...(live.recordDefinitions||{}),...(payload.recordDefinitions||{})};
  payload.gearAssets={...(live.gearAssets||{}),...(payload.gearAssets||{})};
  payload.artifactDefinition=payload.artifactDefinition||live.artifactDefinition||null;
  payload.artifactCoverage=payload.artifactCoverage||live.artifactCoverage||null;
  payload.definitionCoverage=payload.definitionCoverage||live.definitionCoverage||null;
  payload.membership=payload.membership||live.membership;
  return payload;
}

function loadoutCoverage(detail){
  const missing=[];
  if(!detail.super)missing.push("super");
  if(detail.abilities.length<4)missing.push("abilities");
  if(!detail.aspects.length)missing.push("aspects");
  if(!detail.fragments.length)missing.push("fragments");
  if(detail.weapons.length<3)missing.push("weapons");
  if(detail.armour.filter(Boolean).length<5)missing.push("armour");
  if(!detail.subclassBuild?.socketsAvailable)missing.push("subclass sockets");
  if(detail.subclassBuild?.socketCoverage?.unresolved?.length)missing.push(`unresolved subclass hashes: ${detail.subclassBuild.socketCoverage.unresolved.join(",")}`);
  detail.armour.forEach((item,index)=>{
    if(item&&!item.socketsAvailable)missing.push(`armour ${index+1} sockets`);
  });
  return {complete:missing.length===0,missing};
}

async function loadSelectedLoadout(selection){
  const characterId=String(selection?.characterId||"");
  const index=Number(selection?.index);
  if(!characterId||!Number.isInteger(index))throw new Error("Invalid Bungie loadout selection.");
  const cacheKey=`${characterId}:${index}`;
  const cached=loadoutCache.get(cacheKey);
  if(cached){
    rememberLoadoutSelection(characterId,index);
    document.documentElement.dataset.guardianSource="bungie-loadout";
    document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail:cached}));
    document.dispatchEvent(new CustomEvent("astrix:bungie-loadout-loaded",{detail:cached}));
    return cached;
  }
  const stored=await readCachedBungieLoadoutDetail(liveProfileSession||globalThis.ASTRIX_BUNGIE_SESSION,characterId,index);
  if(stored&&Array.isArray(stored.subclassCatalog)){
    loadoutCache.set(cacheKey,stored);
    rememberLoadoutSelection(characterId,index);
    document.documentElement.dataset.guardianSource="bungie-loadout";
    document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail:{...stored,sessionCacheRestored:true}}));
    document.dispatchEvent(new CustomEvent("astrix:bungie-loadout-loaded",{detail:{...stored,sessionCacheRestored:true}}));
    return stored;
  }
  setRenderStatus("LOADING SAVED LOADOUT",`Opening Bungie loadout ${index+1}`,"Resolving equipment and subclass configuration");
  document.dispatchEvent(new CustomEvent("astrix:loadout-loading",{detail:{characterId,index}}));
  const url=await manifestRequestUrl("/bungie/loadout");
  url.searchParams.set("characterId",characterId);
  url.searchParams.set("index",String(index));
  const payload=await hydrateManifestPayload(mergeLoadoutContext(await fetchJsonWithTimeout(url)));
  payload.profile=profileWithSelectedLoadout(payload);
  const detail={...normaliseLiveProfile(payload,null,characterId),selectedLoadoutIndex:index,loadoutSource:"bungie-live"};
  detail.coverage=loadoutCoverage(detail);

  if(!detail.coverage.complete){
    console.warn(`[ASTRIX] Bungie loadout ${index+1} partial: ${detail.coverage.missing.join(", ")}`);
  }

  loadoutCache.set(cacheKey,detail);
  await cacheBungieLoadoutDetail(liveProfileSession||globalThis.ASTRIX_BUNGIE_SESSION,characterId,index,detail);
  rememberCharacterId(characterId);
  rememberLoadoutSelection(characterId,index);
  document.documentElement.dataset.guardianSource="bungie-loadout";
  setRenderStatus("BUILD INTELLIGENCE",`Bungie loadout ${index+1} ready`,"Saved build loaded for analysis");
  document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail}));
  document.dispatchEvent(new CustomEvent("astrix:bungie-loadout-loaded",{detail}));
  return detail;
}

async function activateLiveProfile(payload,session,{fromCache=false}={}){
  liveProfilePayload=payload;
  liveProfileSession=session;
  const rememberedLoadout=rememberedLoadoutSelection(payload.profile);
  const selectedCharacterId=rememberedCharacterId(payload.profile)||rememberedLoadout?.characterId||String(activeCharacter(payload.profile)?.characterId||"");
  if(selectedCharacterId)rememberCharacterId(selectedCharacterId);
  publishCharacterRoster(payload,selectedCharacterId);

  document.documentElement.dataset.guardianSource="bungie-live";
  document.documentElement.dataset.equippedActive="true";
  if(fromCache){
    document.documentElement.dataset.guardianSessionRestored="true";
    document.dispatchEvent(new CustomEvent("astrix:bungie-profile-cache-restored",{detail:{source:"bungie-session-cache",characterId:selectedCharacterId}}));
  }

  if(!selectedCharacterId){
    setRenderStatus("SELECT GUARDIAN","Choose Hunter, Warlock or Titan","Waiting for an explicit Bungie character selection");
    document.dispatchEvent(new CustomEvent("astrix:bungie-profile-loaded",{detail:{source:"bungie-live",pendingSelection:true,characterId:"",sessionCacheRestored:fromCache,definitionCoverage:payload.definitionCoverage||null,artifactCoverage:payload.artifactCoverage||null}}));
    return null;
  }

  if(document.documentElement.dataset.guardianProfileMode==="roster-only"){
    const detail=normaliseLiveProfile(payload,session,selectedCharacterId);
    document.dispatchEvent(new CustomEvent("astrix:guardian-loadout-context",{detail:{...detail,sessionCacheRestored:fromCache}}));
    return detail;
  }

  if(rememberedLoadout&&rememberedLoadout.characterId===selectedCharacterId){
    const detail=await loadSelectedLoadout(rememberedLoadout);
    document.dispatchEvent(new CustomEvent("astrix:bungie-profile-loaded",{detail:{...detail,sessionCacheRestored:fromCache}}));
    return detail;
  }

  const detail=normaliseLiveProfile(payload,session,selectedCharacterId);
  setRenderStatus("BUILD INTELLIGENCE","Live profile data ready","Equipment and loadout analysis active");
  document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail:{...detail,sessionCacheRestored:fromCache}}));
  document.dispatchEvent(new CustomEvent("astrix:bungie-profile-loaded",{detail:{...detail,sessionCacheRestored:fromCache}}));
  return detail;
}

async function loadLiveProfile(session,{background=false}={}){
  if(!background){
    setRenderStatus("LOADING CHARACTER PROFILE","Retrieving live Bungie appearance","Equipment, ornaments and shaders");
    document.dispatchEvent(new CustomEvent("astrix:guardian-loading"));
  }
  const payload=await hydrateManifestPayload(await fetchJsonWithTimeout(await manifestRequestUrl("/bungie/profile")));
  await cacheBungieProfile(session,payload);
  return activateLiveProfile(payload,session);
}

function selectLiveCharacter(characterId,expectedClass=""){
  console.log("[TRACE select] clicked id:", characterId, "| exists in profile?", !!liveProfilePayload?.profile?.characters?.data?.[characterId]);
  if(!liveProfilePayload)throw new Error("Bungie character roster is not loaded; character selection cannot fall back to last played.");
  const detail=normaliseLiveProfile(liveProfilePayload,liveProfileSession,characterId);
  const expected=String(expectedClass||"").trim().toLowerCase();
  if(expected&&detail.characterClass!==expected)throw new Error(`Selected ${expected} card resolved ${detail.characterClass} data for character ${characterId}.`);
  forgetLoadoutSelection();
  rememberCharacterId(detail.characterId);
  document.documentElement.dataset.guardianSource="bungie-live";
  document.documentElement.dataset.equippedActive="true";
  setRenderStatus("BUILD INTELLIGENCE",`${detail.characterClass} profile ready`,"Live equipment and saved loadouts selected");
  document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail}));
  publishCharacterRoster(liveProfilePayload,detail.characterId);
  document.dispatchEvent(new CustomEvent("astrix:bungie-character-selected",{detail}));
  return detail;
}

let liveProfileRequest=null;
let liveProfileReady=false;

function reportProfileError(error){
  const message=error?.message||"Guardian data could not be loaded.";
  console.error("[ASTRIX Bungie profile]",error);
  setRenderStatus("LIVE PROFILE UNAVAILABLE",message,"Your preview workspace remains available");
  document.dispatchEvent(new CustomEvent("astrix:profile-error",{detail:{message}}));
  document.dispatchEvent(new CustomEvent("astrix:guardian-error",{detail:{message}}));
}

function ensureLiveProfile(session,{background=false,silent=false}={}){
  if(liveProfileReady)return Promise.resolve(null);
  if(liveProfileRequest)return liveProfileRequest;
  liveProfileRequest=(async()=>{
    const cachedPayload=await readCachedBungieProfile(session);
    if(cachedPayload?.profile)return activateLiveProfile(await hydrateManifestPayload(cachedPayload),session,{fromCache:true});
    return loadLiveProfile(session,{background});
  })()
    .then(detail=>{
      liveProfileReady=true;
      return detail;
    })
    .catch(error=>{
      if(!silent)reportProfileError(error);
      return null;
    })
    .finally(()=>{
      if(!liveProfileReady)liveProfileRequest=null;
    });
  return liveProfileRequest;
}

async function handleAuthenticatedSession(session){
  if(!session?.authenticated)return null;
  // One authenticated profile request only. The earlier silent 15-second
  // attempt immediately launched a second request when the Worker was still
  // resolving Bungie manifest evidence, leaving the UI on empty placeholders.
  return ensureLiveProfile(session,{background:false,silent:false});
}

globalThis.addEventListener("astrix:bungie-session",event=>{
  handleAuthenticatedSession(event.detail);
});

document.addEventListener("astrix:loadout-selected",event=>{
  loadSelectedLoadout(event.detail).catch(error=>{
    const message=error.message||"Saved loadout could not be loaded.";
    console.error("[ASTRIX Bungie loadout]",error);
    setRenderStatus("SAVED LOADOUT UNAVAILABLE",message,"Your current Guardian profile is still active");
    document.dispatchEvent(new CustomEvent("astrix:loadout-error",{detail:{...event.detail,message}}));
  });
});

document.addEventListener("astrix:character-selected",event=>{
  try{selectLiveCharacter(String(event.detail?.characterId||""),String(event.detail?.characterClass||""));}
  catch(error){reportProfileError(error);}
});

if(globalThis.ASTRIX_BUNGIE_SESSION?.authenticated)handleAuthenticatedSession(globalThis.ASTRIX_BUNGIE_SESSION);
getBungieSession().then(handleAuthenticatedSession);

export {normaliseLiveProfile,loadSelectedLoadout,characterRoster,selectLiveCharacter,profileWithSelectedLoadout,subclassConfiguration,loadoutCoverage,socketResolution,currentArtifact};
