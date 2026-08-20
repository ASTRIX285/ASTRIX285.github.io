/* ASTRIX PARADOX — semantic classification for resolved live Bungie equipment.
 *
 * This module does NOT fetch Bungie data and does NOT replace the profile normalizer.
 * It enriches the already-resolved Guardian selection in-place before renderers consume it.
 *
 * Evidence rule: unknown/unverified state stays unknown. Never turn ownership, availability,
 * UI/system plugs, or incomplete catalyst progress into active build evidence.
 */

const ARMOUR_ARCHETYPES = Object.freeze({
  paragon:{name:'Paragon',primaryStat:'Super',secondaryStat:'Melee'},
  grenadier:{name:'Grenadier',primaryStat:'Grenade',secondaryStat:'Super'},
  specialist:{name:'Specialist',primaryStat:'Class',secondaryStat:'Weapons'},
  brawler:{name:'Brawler',primaryStat:'Melee',secondaryStat:'Health'},
  bulwark:{name:'Bulwark',primaryStat:'Health',secondaryStat:'Class'},
  gunner:{name:'Gunner',primaryStat:'Weapons',secondaryStat:'Grenade'},
  siegebreaker:{name:'Siegebreaker',primaryStat:'Health',secondaryStat:'Grenade'},
  skirmisher:{name:'Skirmisher',primaryStat:'Melee',secondaryStat:'Weapons'},
  demolitionist:{name:'Demolitionist',primaryStat:'Grenade',secondaryStat:'Class'},
  colossus:{name:'Colossus',primaryStat:'Super',secondaryStat:'Health'},
  reaver:{name:'Reaver',primaryStat:'Class',secondaryStat:'Melee'},
  powerhouse:{name:'Powerhouse',primaryStat:'Weapons',secondaryStat:'Super'}
});

const ARMOUR_SLOT_NAMES = Object.freeze({
  3448274439:'helmet',
  3551918588:'gauntlets',
  14239492:'chest',
  20886954:'legs',
  1585787867:'classItem'
});

const normalizeText = value => String(value ?? '').trim().toLowerCase();
const uniqueByHash = rows => rows.filter((row,index,all)=>row && all.findIndex(other=>Number(other.hash)===Number(row.hash))===index);

function plugCategory(plug){
  return normalizeText(plug?.definition?.plug?.plugCategoryIdentifier);
}

function plugText(plug){
  return [
    plug?.name,
    plug?.description,
    plug?.itemTypeDisplayName,
    plugCategory(plug),
    ...(plug?.definition?.traitIds||[])
  ].filter(Boolean).join(' ').toLowerCase();
}

function isDummyPlug(plug){
  return plug?.definition?.plug?.isDummyPlug === true;
}

function isAppearancePlug(plug){
  return /shader|ornament|skin|memento|appearance/.test(plugText(plug));
}

function isSubclassPlug(plug){
  const text=plugText(plug);
  return /class[_ .-]?abilit|movement|grenade|melee|fragment|aspect|supers?|subclass/.test(text);
}

function isInfusionPlug(plug){
  const text=plugText(plug);
  return /(^|[\s._-])infus(e|ion|ing)?([\s._-]|$)/.test(text);
}

function isMasterworkPlug(plug){
  return /masterwork/.test(plugText(plug));
}

function isTuningPlug(plug){
  return /(^|[\s._-])tuning([\s._-]|$)|balanced tuning|tuned stat/.test(plugText(plug));
}

function isCatalystPlug(plug){
  return /catalyst/.test(plugText(plug));
}

function isArmourModPlug(plug){
  const text=plugText(plug);
  return Number(plug?.definition?.itemType)===19 || /armou?r[._ -]?mods?|enhancement/.test(text);
}

function isWeaponModPlug(plug){
  const text=plugText(plug);
  return /weapon[._ -]?mods?/.test(text) && !/armou?r/.test(text);
}

function armourSlot(item){
  return ARMOUR_SLOT_NAMES[Number(item?.bucketHash)] || normalizeText(item?.itemTypeDisplayName).replace(/\s+/g,'') || 'unknown';
}

function isSlotSpecificArmourMod(plug,item){
  const category=plugCategory(plug);
  const text=plugText(plug);
  const slot=armourSlot(item);
  const aliases={
    helmet:['helmet','head'],
    gauntlets:['gauntlet','arms','arm'],
    chest:['chest'],
    legs:['leg','boots'],
    classItem:['classitem','class_item','class item','bond','cloak','mark']
  }[slot] || [];
  return aliases.some(alias=>category.includes(alias)||text.includes(` ${alias} `)||text.startsWith(`${alias} `));
}

function archetypeFromPlug(plug){
  const text=plugText(plug);
  const key=Object.keys(ARMOUR_ARCHETYPES).find(name=>text.includes(name));
  if(!key)return null;
  return {...ARMOUR_ARCHETYPES[key],hash:Number(plug.hash)||null,icon:plug.icon||'',source:'equipped-plug'};
}

function extractMasterworkLevel(plug){
  if(!plug)return null;
  const text=`${plug?.name||''} ${plug?.description||''}`;
  const patterns=[/masterwork\s*(?:level|lvl)?\s*(\d+)/i,/(?:level|lvl)\s*(\d+)/i,/\b(\d+)\s*\/\s*5\b/];
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(match)return Number(match[1]);
  }
  return null;
}

function classifyArmour(item){
  if(!item)return null;
  const plugs=Array.isArray(item?.socketCoverage?.plugs)?item.socketCoverage.plugs:[];
  const systemPlugs=plugs.filter(plug=>isDummyPlug(plug)||isInfusionPlug(plug));
  const masterworkPlug=plugs.find(isMasterworkPlug)||null;
  const tuningMods=plugs.filter(plug=>isTuningPlug(plug)&&!systemPlugs.includes(plug));
  const archetypePlug=plugs.find(plug=>Boolean(archetypeFromPlug(plug)))||null;
  const archetype=archetypeFromPlug(archetypePlug);
  const intrinsic=item?.intrinsicTrait||plugs.find(plug=>/intrinsic|exotic perk/.test(plugText(plug)))||null;

  const armourMods=plugs.filter(plug=>
    isArmourModPlug(plug)
    && !isAppearancePlug(plug)
    && !isSubclassPlug(plug)
    && !isDummyPlug(plug)
    && !isInfusionPlug(plug)
    && !isMasterworkPlug(plug)
    && !isTuningPlug(plug)
    && Number(plug?.hash)!==Number(intrinsic?.hash)
  );
  const slotMods=armourMods.filter(plug=>isSlotSpecificArmourMod(plug,item));
  const generalMods=armourMods.filter(plug=>!slotMods.includes(plug));

  const classified=new Set([
    ...systemPlugs,
    ...tuningMods,
    ...armourMods,
    ...(masterworkPlug?[masterworkPlug]:[]),
    ...(archetypePlug?[archetypePlug]:[]),
    ...(intrinsic?[intrinsic]:[]),
    ...plugs.filter(isAppearancePlug),
    ...plugs.filter(isSubclassPlug)
  ].map(row=>Number(row?.hash)).filter(Number.isFinite));
  const unknownPlugs=plugs.filter(plug=>!classified.has(Number(plug?.hash)));

  const instanceGearTier=Number(item?.gearTier ?? item?.instance?.gearTier);
  const gearTier=Number.isFinite(instanceGearTier)&&instanceGearTier>0?instanceGearTier:null;
  const energy=item?.energy ?? item?.instance?.energy ?? null;
  const masterworkLevel=extractMasterworkLevel(masterworkPlug);
  const equipableItemSetHash=Number(item?.definition?.equippingBlock?.equipableItemSetHash);
  const setHash=Number.isFinite(equipableItemSetHash)&&equipableItemSetHash>0?equipableItemSetHash:null;

  return {
    slot:armourSlot(item),
    gearTier,
    rarity:item?.tier||'',
    masterwork:{
      plug:masterworkPlug,
      level:masterworkLevel,
      maxLevel:5,
      complete:masterworkLevel===null?null:masterworkLevel>=5
    },
    energy,
    archetype,
    generalMods:uniqueByHash(generalMods),
    tuningMods:uniqueByHash(tuningMods),
    slotMods:uniqueByHash(slotMods),
    exoticPerk:item?.isExotic?intrinsic:null,
    intrinsicTrait:intrinsic,
    setBonus:{
      setHash,
      definition:null,
      perks:[],
      resolved:false
    },
    ignoredSystemPlugs:uniqueByHash(systemPlugs),
    unknownPlugs:uniqueByHash(unknownPlugs),
    coverage:{
      socketDefinitionsComplete:item?.socketCoverage?.complete!==false,
      gearTierKnown:gearTier!==null,
      energyKnown:energy!==null,
      archetypeKnown:Boolean(archetype),
      setDefinitionRequired:Boolean(setHash),
      setDefinitionResolved:false,
      unknownPlugHashes:unknownPlugs.map(plug=>Number(plug.hash)).filter(Number.isFinite)
    }
  };
}

function championCapabilities(item,plugs){
  const text=[item?.name,item?.description,item?.intrinsicTrait?.name,item?.intrinsicTrait?.description,...plugs.flatMap(plug=>[plug?.name,plug?.description])]
    .filter(Boolean).join(' ').toLowerCase();
  return ['barrier','overload','unstoppable'].filter(token=>text.includes(token));
}

function classifyCatalyst(plugs){
  const catalyst=plugs.find(isCatalystPlug)||null;
  if(!catalyst)return null;
  return {
    hash:Number(catalyst.hash)||null,
    name:catalyst.name||'Exotic Catalyst',
    description:catalyst.description||'',
    icon:catalyst.icon||'',
    present:true,
    progress:null,
    completed:null,
    active:null,
    reasoningCredit:false,
    verification:'objective-state-not-resolved'
  };
}

function classifyWeapon(item){
  if(!item)return null;
  const plugs=Array.isArray(item?.socketCoverage?.plugs)?item.socketCoverage.plugs:[];
  const systemPlugs=plugs.filter(plug=>isDummyPlug(plug)||isInfusionPlug(plug));
  const masterworkPlug=plugs.find(isMasterworkPlug)||null;
  const catalyst=classifyCatalyst(plugs);
  const intrinsic=item?.intrinsicTrait||plugs.find(plug=>/intrinsic|frame/.test(plugText(plug)))||null;
  const weaponMods=plugs.filter(plug=>isWeaponModPlug(plug)&&!systemPlugs.includes(plug));
  const excludedHashes=new Set([
    ...systemPlugs,
    ...weaponMods,
    ...(masterworkPlug?[masterworkPlug]:[]),
    ...(intrinsic?[intrinsic]:[]),
    ...plugs.filter(isAppearancePlug),
    ...plugs.filter(isCatalystPlug)
  ].map(row=>Number(row?.hash)).filter(Number.isFinite));
  const selectedPerks=uniqueByHash(plugs.filter(plug=>!excludedHashes.has(Number(plug?.hash))&&!isSubclassPlug(plug)));
  const masterworkLevel=extractMasterworkLevel(masterworkPlug);
  return {
    intrinsic,
    championCapabilities:championCapabilities(item,plugs),
    selectedPerks,
    weaponMods:uniqueByHash(weaponMods),
    masterwork:{plug:masterworkPlug,level:masterworkLevel,maxLevel:10,complete:masterworkLevel===null?null:masterworkLevel>=10},
    catalyst,
    stats:item?.weaponStats||item?.stats||null,
    ignoredSystemPlugs:uniqueByHash(systemPlugs),
    coverage:{
      socketDefinitionsComplete:item?.socketCoverage?.complete!==false,
      catalystStateResolved:catalyst?false:true,
      unknownPlugHashes:[]
    }
  };
}

function classifyArtifact(artifact){
  if(!artifact)return null;
  const perks=Array.isArray(artifact.perks)?artifact.perks:[];
  const activePerks=Array.isArray(artifact.activePerks)?artifact.activePerks:[];
  return {
    hash:Number(artifact.hash)||null,
    name:artifact.name||'',
    appliedPerks:activePerks,
    allVisiblePerks:perks.filter(perk=>perk?.isVisible!==false),
    appliedCount:activePerks.length,
    expectedAppliedSlots:7,
    complete:activePerks.length===7 && activePerks.every(perk=>perks.some(row=>Number(row.hash)===Number(perk.hash)&&row?.definition&&Object.keys(row.definition).length>0))
  };
}

function classifyStats(stats){
  const rows=Array.isArray(stats)?stats:[];
  return Object.fromEntries(rows.map(([name,value])=>{
    const numeric=Number(value)||0;
    return [normalizeText(name),{
      name:String(name||''),
      value:numeric,
      enhancedThreshold:100,
      enhancedActive:numeric>=100
    }];
  }));
}

function semanticCoverage(detail){
  const armour=(detail.armour||[]).filter(Boolean).map(item=>item.semanticArmour).filter(Boolean);
  const weapons=(detail.weapons||[]).filter(Boolean).map(item=>item.semanticWeapon).filter(Boolean);
  const unknownArmourHashes=armour.flatMap(row=>row.coverage.unknownPlugHashes||[]);
  const unresolvedArmourSets=armour.filter(row=>row.coverage.setDefinitionRequired&&!row.coverage.setDefinitionResolved).map(row=>row.setBonus.setHash);
  const unresolvedCatalysts=weapons.filter(row=>row.catalyst&&!row.coverage.catalystStateResolved).map(row=>row.catalyst.hash);
  return {
    armour:{
      pieces:armour.length,
      unknownPlugHashes:[...new Set(unknownArmourHashes)],
      unresolvedSetHashes:[...new Set(unresolvedArmourSets.filter(Boolean))],
      gearTierMissing:armour.filter(row=>!row.coverage.gearTierKnown).length,
      energyMissing:armour.filter(row=>!row.coverage.energyKnown).length
    },
    weapons:{
      pieces:weapons.length,
      unresolvedCatalystHashes:[...new Set(unresolvedCatalysts.filter(Boolean))]
    },
    artifact:detail.semanticArtifact?{appliedCount:detail.semanticArtifact.appliedCount,complete:detail.semanticArtifact.complete}:null
  };
}

function enrichGuardianSemantics(detail){
  if(!detail||typeof detail!=='object')return detail;
  if(Array.isArray(detail.armour)){
    detail.armour=detail.armour.map(item=>item?{...item,semanticArmour:classifyArmour(item)}:item);
  }
  if(Array.isArray(detail.weapons)){
    detail.weapons=detail.weapons.map(item=>item?{...item,semanticWeapon:classifyWeapon(item)}:item);
  }
  detail.semanticArtifact=classifyArtifact(detail.artifact);
  detail.guardianStats=classifyStats(detail.stats);
  detail.semanticCoverage=semanticCoverage(detail);
  detail.semanticVersion='guardian-equipment-v1';
  return detail;
}

/* Register before guardian-bungie-profile dispatches selections. CustomEvent.detail is
 * deliberately enriched in-place so all existing renderers keep the same event contract. */
document.addEventListener('astrix:guardian-selection-changed',event=>{
  enrichGuardianSemantics(event.detail);
});

export {
  ARMOUR_ARCHETYPES,
  classifyArmour,
  classifyWeapon,
  classifyArtifact,
  classifyStats,
  enrichGuardianSemantics,
  isInfusionPlug,
  isMasterworkPlug,
  isTuningPlug
};
