// Canonical semantic classification for live Bungie Guardian data.
// Keep this module deterministic and conservative: unknown evidence stays unknown.

const norm=value=>String(value??"").trim().toLowerCase();
const uniq=rows=>rows.filter((row,index,all)=>row&&all.findIndex(other=>Number(other?.hash)===Number(row?.hash))===index);

function semanticText(item){
  return [item?.name,item?.description,item?.itemTypeDisplayName,item?.definition?.plug?.plugCategoryIdentifier,...(item?.definition?.traitIds||[])].filter(Boolean).join(" ").toLowerCase();
}
function plugCategory(item){return norm(item?.definition?.plug?.plugCategoryIdentifier);}

function classifyArmourPlug(plug){
  const category=plugCategory(plug),text=semanticText(plug);
  if(/shader|ornament|skin/.test(text))return "appearance";
  if(/infus(e|ion)/.test(text)||category.includes("infusion"))return "infuse";
  if(category.includes("masterwork")||/armou?r masterwork|masterwork level/.test(text))return "masterwork";
  if(category.includes("archetype")||/armou?r archetype/.test(text))return "archetype";
  if(category.includes("set_bonus")||category.includes("setbonus")||/\b[24][ -]?piece\b|set bonus/.test(text))return "set-bonus";
  if((category.includes("exotic")&&(category.includes("intrinsic")||category.includes("perk")))||/exotic (armou?r )?(intrinsic|perk)/.test(text))return "exotic-perk";
  if(category.includes("armor.mods.general")||category.includes("armour.mods.general")||/general armou?r mod/.test(text))return "general-mod";
  if((category.includes("armor.mods")||category.includes("armour.mods")||/armou?r mod/.test(text))&&!/general armou?r mod/.test(text))return "slot-mod";
  return "unknown";
}

function setEffects(plugs){
  const effects=plugs.filter(plug=>classifyArmourPlug(plug)==="set-bonus");
  return {identity:null,twoPiece:effects.find(plug=>/\b2[ -]?piece\b/.test(semanticText(plug)))||null,fourPiece:effects.find(plug=>/\b4[ -]?piece\b/.test(semanticText(plug)))||null,effects};
}

function normaliseArmourSemantics({plugs=[],instance=null,stats=null}={}){
  const buckets={masterwork:[],generalMods:[],slotMods:[],archetype:[],exoticPerk:[],discarded:[],unknown:[]};
  for(const plug of plugs){
    const role=classifyArmourPlug(plug);
    if(role==="appearance")continue;
    if(role==="infuse")buckets.discarded.push({...plug,semanticRole:"infuse"});
    else if(role==="masterwork")buckets.masterwork.push(plug);
    else if(role==="general-mod")buckets.generalMods.push(plug);
    else if(role==="slot-mod")buckets.slotMods.push(plug);
    else if(role==="archetype")buckets.archetype.push(plug);
    else if(role==="exotic-perk")buckets.exoticPerk.push(plug);
    else if(role!=="set-bonus")buckets.unknown.push(plug);
  }
  const energy=instance?.energy||null;
  const tier=Number.isFinite(Number(instance?.gearTier))?Number(instance.gearTier):null;
  return {
    tier,masterwork:buckets.masterwork[0]||null,masterworkCandidates:uniq(buckets.masterwork),
    energy:energy?{type:energy.energyType??null,typeHash:energy.energyTypeHash??null,capacity:Number.isFinite(Number(energy.energyCapacity))?Number(energy.energyCapacity):null,used:Number.isFinite(Number(energy.energyUsed))?Number(energy.energyUsed):null}:null,
    archetype:buckets.archetype[0]||null,generalMods:uniq(buckets.generalMods),slotMods:uniq(buckets.slotMods),exoticPerk:buckets.exoticPerk[0]||null,
    set:setEffects(plugs),stats:stats?.stats||stats||null,discarded:uniq(buckets.discarded),unknownPlugs:uniq(buckets.unknown),complete:buckets.unknown.length===0
  };
}

function classifyWeaponPlug(plug){
  const category=plugCategory(plug),text=semanticText(plug);
  if(/shader|ornament|skin/.test(text))return "appearance";
  if(category.includes("catalyst")||/\bcatalyst\b/.test(text))return "catalyst";
  if(category.includes("masterwork")||/weapon masterwork|masterwork level/.test(text))return "masterwork";
  if(category.includes("intrinsic")||/\b(frame|intrinsic)\b/.test(text))return "intrinsic";
  if(category.includes("weapon.mods")||/weapon mod/.test(text))return "weapon-mod";
  if(category.includes("barrel")||category.includes("magazine")||category.includes("trait")||category.includes("perk"))return "perk";
  return "unknown";
}

function catalystProgress(profile,itemInstanceId,catalyst){
  if(!itemInstanceId||!catalyst)return null;
  const row=profile?.itemComponents?.plugObjectives?.data?.[itemInstanceId]||null;
  const byPlug=row?.objectivesPerPlug||{};
  const objectives=byPlug[String(catalyst.hash)]||byPlug[catalyst.hash]||[];
  const completed=objectives.length>0&&objectives.every(objective=>Boolean(objective.complete));
  return {acquired:true,objectives,completed,active:Boolean(catalyst.isEnabled)&&completed};
}

function enhancementState(item){
  const state=Number(item?.state)||0;
  return {rawState:state,masterworked:Boolean(state&4),crafted:Boolean(state&8),enhanced:Boolean(state&32)};
}

function normaliseAlternativeColumns(columns={}){
  return Object.entries(columns||{}).map(([socketIndex,plugs])=>({
    socketIndex:Number(socketIndex),
    options:uniq((plugs||[]).filter(plug=>["perk","intrinsic","weapon-mod","catalyst"].includes(classifyWeaponPlug(plug))))
  })).filter(column=>column.options.length);
}

function normaliseWeaponSemantics({profile=null,item=null,plugs=[],instance=null,stats=null,alternativeColumns={}}={}){
  const groups={intrinsic:[],perks:[],masterwork:[],mod:[],catalyst:[],unknown:[]};
  for(const plug of plugs){
    const role=classifyWeaponPlug(plug);
    if(role==="appearance")continue;
    if(role==="intrinsic")groups.intrinsic.push(plug);
    else if(role==="perk")groups.perks.push(plug);
    else if(role==="masterwork")groups.masterwork.push(plug);
    else if(role==="weapon-mod")groups.mod.push(plug);
    else if(role==="catalyst")groups.catalyst.push(plug);
    else groups.unknown.push(plug);
  }
  const catalyst=groups.catalyst[0]||null;
  return {
    intrinsic:groups.intrinsic[0]||null,selectedPerks:uniq(groups.perks),alternativePerkColumns:normaliseAlternativeColumns(alternativeColumns),
    enhancementState:enhancementState(item),masterwork:groups.masterwork[0]||null,mod:groups.mod[0]||null,
    catalyst:catalyst?{...catalyst,progress:catalystProgress(profile,item?.itemInstanceId,catalyst)}:null,
    champion:(instance?.breakerTypeHash||instance?.breakerType)?{breakerType:instance.breakerType??null,breakerTypeHash:instance.breakerTypeHash??null,source:"bungie-item-instance"}:null,
    stats:stats?.stats||stats||null,unknownPlugs:uniq(groups.unknown),complete:groups.unknown.length===0
  };
}

function normaliseGuardianStats(statPairs=[]){
  return Object.fromEntries((statPairs||[]).map(([name,value])=>{const numeric=Number(value)||0;return [name,{value:numeric,enhancedThreshold:100,enhancedThresholdReached:numeric>100}];}));
}
function validateArtifact(artifact){
  const active=artifact?.activePerks||[],hashes=active.map(item=>Number(item?.hash)).filter(Number.isFinite);
  return {activeCount:active.length,uniqueActiveCount:new Set(hashes).size,noDuplicateActiveHashes:new Set(hashes).size===hashes.length};
}

export {semanticText,plugCategory,classifyArmourPlug,normaliseArmourSemantics,classifyWeaponPlug,normaliseWeaponSemantics,normaliseGuardianStats,validateArtifact,enhancementState};
