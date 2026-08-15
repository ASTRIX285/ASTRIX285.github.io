const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||"https://auth.astrixparadox.com";
const BUNGIE_ORIGIN="https://www.bungie.net";
const CLASS_NAMES=["titan","hunter","warlock"];
const BUCKETS={kinetic:1498876634,energy:2465295065,power:953998645,helmet:3448274439,gauntlets:3551918588,chest:14239492,legs:20886954,classItem:1585787867,ghost:4023194814,subclass:3284755031};
const ARMOUR_ORDER=[BUCKETS.helmet,BUCKETS.gauntlets,BUCKETS.chest,BUCKETS.legs,BUCKETS.classItem];
const WEAPON_ORDER=[BUCKETS.kinetic,BUCKETS.energy,BUCKETS.power];
const STAT_ORDER=[["Weapons",2996146975],["Health",392767087],["Class",1943323491],["Grenade",1735777505],["Super",144602215],["Melee",4244567218]];

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

const absoluteIcon=path=>path?new URL(path,BUNGIE_ORIGIN).toString():"";
const definition=(definitions,hash)=>definitions?.[String(hash)]||null;
const displayItem=(definitions,hash)=>{
  const row=definition(definitions,hash)||{};
  return {hash:Number(hash),bungieHash:Number(hash),name:row.displayProperties?.name||`Destiny item ${hash}`,description:row.displayProperties?.description||"",icon:absoluteIcon(row.displayProperties?.icon),tier:row.inventory?.tierTypeName||"",itemTypeDisplayName:row.itemTypeDisplayName||"",bucketHash:row.inventory?.bucketTypeHash??null,definition:row};
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

function socketPlugs(profile,definitions,item){
  if(!item?.itemInstanceId)return [];
  const sockets=profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]?.sockets||[];
  return sockets.map(socket=>displayItem(definitions,socket.plugHash)).filter(row=>row.definition);
}

function normaliseItem(profile,definitions,item){
  const base=displayItem(definitions,item.itemHash);
  const instance=item.itemInstanceId?profile?.itemComponents?.instances?.data?.[item.itemInstanceId]:null;
  const plugs=socketPlugs(profile,definitions,item);
  const shader=plugs.find(plug=>String(plug.definition?.plug?.plugCategoryIdentifier||"").includes("shader"))||null;
  const ornament=plugs.find(plug=>/skin|ornament/.test(String(plug.definition?.plug?.plugCategoryIdentifier||"")))||null;
  const mods=plugs.filter(plug=>/mod|enhancement/.test(String(plug.definition?.plug?.plugCategoryIdentifier||""))&&!/shader|skin|ornament/.test(String(plug.definition?.plug?.plugCategoryIdentifier||"")));
  return {...base,power:instance?.primaryStat?.value??null,isExotic:String(base.tier).toLowerCase()==="exotic",shader,ornament,appearancePlugs:[shader,ornament].filter(Boolean),mods};
}

function identityCosmetics(profile,definitions,equipment,character){
  const ghostItem=equipment.find(item=>definition(definitions,item.itemHash)?.inventory?.bucketTypeHash===BUCKETS.ghost);
  const allPlugs=equipment.flatMap(item=>socketPlugs(profile,definitions,item));
  const shader=allPlugs.find(plug=>String(plug.definition?.plug?.plugCategoryIdentifier||"").includes("shader"))||null;
  return {ghost:ghostItem?normaliseItem(profile,definitions,ghostItem):null,shader,emblem:{hash:character.emblemHash??null,icon:absoluteIcon(character.emblemPath),background:absoluteIcon(character.emblemBackgroundPath)}};
}

function normaliseLiveProfile(payload,session){
  const profile=payload.profile||{};
  const definitions=payload.definitions||{};
  const character=activeCharacter(profile);
  if(!character?.characterId)throw new Error("No Destiny character was returned for this membership.");
  const equipment=profile?.characterEquipment?.data?.[character.characterId]?.items||[];
  const byBucket=hash=>equipment.find(item=>definition(definitions,item.itemHash)?.inventory?.bucketTypeHash===hash)||null;
  const weapons=WEAPON_ORDER.map(hash=>byBucket(hash)).filter(Boolean).map(item=>normaliseItem(profile,definitions,item));
  const armour=ARMOUR_ORDER.map(hash=>byBucket(hash)).map(item=>item?normaliseItem(profile,definitions,item):null);
  const subclassItem=byBucket(BUCKETS.subclass);
  const subclass=subclassItem?displayItem(definitions,subclassItem.itemHash):null;
  const cosmetics=identityCosmetics(profile,definitions,equipment,character);
  return {
    source:"bungie-live",
    characterId:character.characterId,
    characterClass:CLASS_NAMES[Number(character.classType)]||"hunter",
    subclass:classifySubclass(subclass),
    power:character.light??null,
    stats:STAT_ORDER.map(([name,hash])=>[name,Number(character.stats?.[hash]??0)]),
    weapons,
    armour,
    ...cosmetics,
    ornaments:armour.map(item=>item?.ornament).filter(Boolean),
    renderData:profile?.characterRenderData?.data?.[character.characterId]||null,
    itemRenderData:profile?.itemComponents?.renderData?.data||{},
    gearAssets:payload.gearAssets||{},
    displayName:payload.membership?.displayName||session?.activeDestinyMembership?.displayName||"Guardian"
  };
}

async function loadLiveProfile(session){
  setRenderStatus("LOADING CHARACTER PROFILE","Retrieving live Bungie appearance","Equipment, ornaments and shaders");
  document.dispatchEvent(new CustomEvent("astrix:guardian-loading"));
  const response=await fetch(`${AUTH_ORIGIN}/bungie/profile`,{credentials:"include",headers:{Accept:"application/json"}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Bungie profile request failed (${response.status}).`);
  const detail=normaliseLiveProfile(payload,session);
  document.documentElement.dataset.guardianSource="bungie-live";
  setRenderStatus("CHARACTER RENDERING","Live profile data ready","3D assembly in development");
  document.dispatchEvent(new CustomEvent("astrix:guardian-selection-changed",{detail}));
  document.dispatchEvent(new CustomEvent("astrix:bungie-profile-loaded",{detail}));
}

globalThis.addEventListener("astrix:bungie-session",event=>{
  loadLiveProfile(event.detail).catch(error=>{
    console.error("[ASTRIX Bungie profile]",error);
    setRenderStatus("LIVE PROFILE UNAVAILABLE",error.message||"Guardian data could not be loaded.","Reconnect Bungie or refresh this page");
    document.dispatchEvent(new CustomEvent("astrix:guardian-error",{detail:{message:error.message||"Guardian data could not be loaded."}}));
  });
});

export {normaliseLiveProfile};
