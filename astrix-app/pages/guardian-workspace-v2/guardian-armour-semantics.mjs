/* ASTRIX PARADOX — live Bungie armour semantic classifier.
 * No fetching, no UI redesign, no reasoning claims.
 * Unknown state remains explicit until a Bungie definition proves it.
 */

const ARMOUR_ARCHETYPES=Object.freeze({
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

const SLOT_BY_BUCKET=Object.freeze({
  3448274439:'helmet',3551918588:'gauntlets',14239492:'chest',20886954:'legs',1585787867:'classItem'
});

const txt=v=>String(v??'').trim().toLowerCase();
const category=plug=>txt(plug?.definition?.plug?.plugCategoryIdentifier);
const plugText=plug=>[plug?.name,plug?.description,plug?.itemTypeDisplayName,category(plug),...(plug?.definition?.traitIds||[])].filter(Boolean).join(' ').toLowerCase();
const uniqueByHash=rows=>rows.filter((row,index,all)=>row&&all.findIndex(other=>Number(other.hash)===Number(row.hash))===index);

function isSubclassPlug(plug){
  const value=category(plug);
  return /(^|[._-])(supers?|class_abilit|movement|melee|grenades?|aspects?|fragments?|subclass)([._-]|$)/.test(value);
}

function isAppearancePlug(plug){return /shader|ornament|skin|memento|appearance/.test(plugText(plug));}
function isDummyPlug(plug){return plug?.definition?.plug?.isDummyPlug===true;}
function isInfusionPlug(plug){return /(^|[\s._-])infus(e|ion|ing)?([\s._-]|$)/.test(plugText(plug));}
function isMasterworkPlug(plug){return /masterwork/.test(plugText(plug));}
function isTuningPlug(plug){return /(^|[\s._-])tuning([\s._-]|$)|balanced tuning|tuned stat/.test(plugText(plug));}
function isArmourModPlug(plug){return Number(plug?.definition?.itemType)===19||/armou?r[._ -]?mods?|enhancement/.test(plugText(plug));}

function armourSlot(item){
  return SLOT_BY_BUCKET[Number(item?.bucketHash)]||txt(item?.itemTypeDisplayName).replace(/\s+/g,'')||'unknown';
}

function isSlotSpecificMod(plug,item){
  const cat=category(plug);
  const text=` ${plugText(plug)} `;
  const aliases={helmet:['helmet','head'],gauntlets:['gauntlet','arms'],chest:['chest'],legs:['leg','boots'],classItem:['classitem','class_item','class item','bond','cloak','mark']}[armourSlot(item)]||[];
  return aliases.some(alias=>cat.includes(alias)||text.includes(` ${alias} `));
}

function armourArchetype(plug){
  const text=plugText(plug);
  const key=Object.keys(ARMOUR_ARCHETYPES).find(name=>text.includes(name));
  if(!key)return null;
  return {...ARMOUR_ARCHETYPES[key],hash:Number(plug.hash)||null,icon:plug.icon||'',source:'equipped-plug'};
}

function masterworkLevel(plug){
  if(!plug)return null;
  const text=`${plug?.name||''} ${plug?.description||''}`;
  for(const pattern of [/masterwork\s*(?:level|lvl)?\s*(\d+)/i,/(?:level|lvl)\s*(\d+)/i,/\b(\d+)\s*\/\s*5\b/]){
    const match=text.match(pattern);if(match)return Number(match[1]);
  }
  return null;
}

function classifyArmour(item){
  if(!item)return null;
  const plugs=Array.isArray(item?.socketCoverage?.plugs)?item.socketCoverage.plugs:[];
  const systemPlugs=plugs.filter(plug=>isDummyPlug(plug)||isInfusionPlug(plug));
  const mwPlug=plugs.find(isMasterworkPlug)||null;
  const tuningMods=plugs.filter(plug=>isTuningPlug(plug)&&!systemPlugs.includes(plug));
  const archetypePlug=plugs.find(plug=>Boolean(armourArchetype(plug)))||null;
  const archetype=armourArchetype(archetypePlug);
  const intrinsic=item?.intrinsicTrait||plugs.find(plug=>/intrinsic|exotic perk/.test(plugText(plug)))||null;

  const realMods=plugs.filter(plug=>isArmourModPlug(plug)&&!isAppearancePlug(plug)&&!isSubclassPlug(plug)&&!isDummyPlug(plug)&&!isInfusionPlug(plug)&&!isMasterworkPlug(plug)&&!isTuningPlug(plug)&&Number(plug?.hash)!==Number(intrinsic?.hash));
  const slotMods=realMods.filter(plug=>isSlotSpecificMod(plug,item));
  const generalMods=realMods.filter(plug=>!slotMods.includes(plug));

  const classifiedHashes=new Set([
    ...systemPlugs,...tuningMods,...realMods,...(mwPlug?[mwPlug]:[]),...(archetypePlug?[archetypePlug]:[]),...(intrinsic?[intrinsic]:[]),...plugs.filter(isAppearancePlug),...plugs.filter(isSubclassPlug)
  ].map(row=>Number(row?.hash)).filter(Number.isFinite));
  const unknownPlugs=plugs.filter(plug=>!classifiedHashes.has(Number(plug?.hash)));

  const tierValue=Number(item?.gearTier??item?.instance?.gearTier);
  const gearTier=Number.isFinite(tierValue)&&tierValue>0?tierValue:null;
  const level=masterworkLevel(mwPlug);
  const setValue=Number(item?.definition?.equippingBlock?.equipableItemSetHash);
  const setHash=Number.isFinite(setValue)&&setValue>0?setValue:null;

  return {
    slot:armourSlot(item),
    gearTier,
    energy:item?.energy??item?.instance?.energy??null,
    masterwork:{plug:mwPlug,level,maxLevel:5,complete:level===null?null:level>=5},
    archetype,
    generalMods:uniqueByHash(generalMods),
    tuningMods:uniqueByHash(tuningMods),
    slotMods:uniqueByHash(slotMods),
    exoticPerk:item?.isExotic?intrinsic:null,
    intrinsicTrait:intrinsic,
    setBonus:{setHash,definition:null,perks:[],resolved:false},
    ignoredSystemPlugs:uniqueByHash(systemPlugs),
    unknownPlugs:uniqueByHash(unknownPlugs),
    coverage:{
      socketDefinitionsComplete:item?.socketCoverage?.complete!==false,
      gearTierKnown:gearTier!==null,
      energyKnown:(item?.energy??item?.instance?.energy??null)!==null,
      archetypeKnown:Boolean(archetype),
      setDefinitionRequired:Boolean(setHash),
      setDefinitionResolved:false,
      unknownPlugHashes:unknownPlugs.map(plug=>Number(plug.hash)).filter(Number.isFinite)
    }
  };
}

function enrichArmourSemantics(detail){
  if(!detail||typeof detail!=='object'||!Array.isArray(detail.armour))return detail;
  detail.armour=detail.armour.map(item=>item?{...item,semanticArmour:classifyArmour(item)}:item);
  const rows=detail.armour.filter(Boolean).map(item=>item.semanticArmour).filter(Boolean);
  detail.semanticCoverage=detail.semanticCoverage||{};
  detail.semanticCoverage.armour={
    pieces:rows.length,
    unknownPlugHashes:[...new Set(rows.flatMap(row=>row.coverage.unknownPlugHashes||[]))],
    unresolvedSetHashes:[...new Set(rows.filter(row=>row.coverage.setDefinitionRequired&&!row.coverage.setDefinitionResolved).map(row=>row.setBonus.setHash).filter(Boolean))],
    gearTierMissing:rows.filter(row=>!row.coverage.gearTierKnown).length,
    energyMissing:rows.filter(row=>!row.coverage.energyKnown).length
  };
  detail.semanticVersion='guardian-armour-v1';
  return detail;
}

if(typeof document!=='undefined'){
  document.addEventListener('astrix:guardian-selection-changed',event=>enrichArmourSemantics(event.detail));
}

export {ARMOUR_ARCHETYPES,classifyArmour,enrichArmourSemantics,isSubclassPlug,isInfusionPlug,isMasterworkPlug,isTuningPlug};
