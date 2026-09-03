import {classifyArmourPlug} from '../guardian-semantic-resolver.mjs';
import {explicitTokens} from './paradox-forge-intelligence.mjs';

const STAT_KEYS=Object.freeze(['health','melee','grenade','super','class','weapon']);
const WEAPON_BUCKETS=Object.freeze([1498876634,2465295065,953998645]);
const OBJECTIVE_TERMS=Object.freeze({
  balanced:['health','grenade','melee','class ability','super','weapon','orb of power'],
  dps:['weapon','super','radiant','weaken','ignite','volatile','precision','damage','reload'],
  'add-clear':['grenade','jolt','scorch','ignite','volatile','threadling','tangle','shatter','area','chain'],
  survivability:['health','cure','restoration','overshield','woven mail','invisibility','devour','resist'],
  'ability-uptime':['grenade','melee','class ability','super','ionic trace','orb of power','energy','cooldown']
});
const EMPTY_MOD=/^(empty|no)\b|empty (armou?r )?mod|no mod/i;

const clone=value=>{try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}};
const clean=value=>String(value??'').trim();
const lower=value=>clean(value).toLowerCase();
const itemHash=item=>Number(item?.hash??item?.itemHash??item?.bungieHash);
const itemIdentity=item=>String(item?.itemInstanceId||itemHash(item)||'');
const itemName=(item,fallback='Verified option')=>clean(item?.name||item?.displayName||item?.definition?.displayProperties?.name)||fallback;
const itemText=item=>[
  itemName(item,''),item?.description,item?.itemTypeDisplayName,item?.definition?.displayProperties?.description,
  item?.definition?.itemTypeDisplayName,item?.definition?.plug?.plugCategoryIdentifier,...(item?.definition?.traitIds||[])
].map(clean).filter(Boolean).join(' · ').toLowerCase();
const uniqueByHash=rows=>{const seen=new Set();return (rows||[]).filter(Boolean).filter(row=>{const key=itemHash(row);if(!Number.isInteger(key)||seen.has(key))return false;seen.add(key);return true;});};
const objectiveName=value=>Object.hasOwn(OBJECTIVE_TERMS,lower(value))?lower(value):'balanced';

function statKey(name){
  const value=lower(name).replace(/[^a-z0-9]+/g,'');
  if(value==='class'||value==='classability')return 'class';
  if(value==='weapon'||value==='weapons')return 'weapon';
  return STAT_KEYS.find(key=>value===key)||null;
}

function modCost(mod){
  const value=mod?.energyCost??mod?.cost??mod?.definition?.plug?.energyCost??mod?.plug?.energyCost;
  const number=Number(value&&typeof value==='object'?(value.energyCost??value.value):value);
  return Number.isFinite(number)?Math.max(0,number):0;
}

function isVerifiedMod(mod){
  const hash=itemHash(mod),definition=mod?.definition;
  return Number.isInteger(hash)&&hash>0&&mod?.isEnabled!==false&&Boolean(definition&&Object.keys(definition).length)&&!EMPTY_MOD.test(itemName(mod,''))&&['general-mod','slot-mod'].includes(classifyArmourPlug(mod));
}

function modStats(mod){
  const output=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
  for(const row of mod?.statContributions||[]){
    if(row?.isConditionallyActive===true)continue;
    const key=statKey(row?.name);
    if(key)output[key]+=Number(row?.value||0);
  }
  return output;
}

function buildEvidence(build={}){
  const decision=build.forgeLoaderDecision||{},rows=[];
  const add=(kind,item)=>{if(item)rows.push({kind,name:itemName(item,kind),tokens:explicitTokens(item),text:itemText(item)});};
  add('Exotic perk',decision?.buildAnchor?.perk);
  for(const row of decision?.setProtocol||[])add(`${Number(row?.count)||0}-piece set`,row?.trait||row);
  const subclass=build.subclassBuild||{};
  for(const item of [subclass.super,...(subclass.abilities||[]),...(subclass.aspects||[]),...(subclass.fragments||[])])add('subclass',item);
  const selectedArtifact=new Set((build.artifactConfiguration?.selectedPerkHashes||build.artifactRecommendation?.selectedPerkHashes||[]).map(String));
  for(const perk of build.artifact?.perks||[])if(selectedArtifact.has(String(itemHash(perk))))add('Artifact',perk);
  for(const weapon of build.weapons||[]){add('weapon',weapon);for(const perk of weapon?.weaponSemantics?.selectedPerks||[])add('weapon perk',perk);}
  return rows;
}

function scoreMod(mod,{build={},objective='balanced'}={}){
  const decision=build.forgeLoaderDecision?.statDirective||{},targets=decision.targets||{},achieved=decision.achieved||{},priorities=decision.priorities||{},stats=modStats(mod),reasons=[];
  let score=0;
  for(const key of STAT_KEYS){
    const value=Number(stats[key]||0);if(!value)continue;
    const target=Number(targets[key]||0),raw=Number(achieved[key]||0),shortfall=Math.max(0,target-raw),rank=Number(priorities[key]||0),weight=rank>0?Math.max(4,12-rank):shortfall>0?5:2,points=value*weight;
    score+=points;reasons.push({kind:'stat',label:`${value>0?'+':''}${value} ${key.toUpperCase()} supports ${rank>0?`priority ${rank}`:shortfall>0?`${shortfall}-point raw shortfall`:'the projected stat total'}.`,score:points,stat:key,value});
  }
  const tokens=explicitTokens(mod),evidence=buildEvidence(build);
  for(const source of evidence){
    const shared=tokens.filter(token=>source.tokens.includes(token)).slice(0,2);
    for(const token of shared){score+=9;reasons.push({kind:'synergy',label:`Verified ${token} wording matches ${source.kind} · ${source.name}.`,score:9,token});}
  }
  const objectiveTerms=OBJECTIVE_TERMS[objectiveName(objective)],text=itemText(mod);
  const objectiveMatches=objectiveTerms.filter(term=>text.includes(term)).slice(0,3);
  for(const term of objectiveMatches){score+=6;reasons.push({kind:'objective',label:`Explicit ${term} evidence supports the ${objectiveName(objective)} objective.`,score:6,term});}
  reasons.sort((left,right)=>right.score-left.score||left.label.localeCompare(right.label));
  return {score,tokens,stats,reasons};
}

function socketRows(item={}){
  const current=[...(item.generalMods||item.armourSemantics?.generalMods||[]),...(item.slotMods||item.armourSemantics?.slotMods||[])];
  const currentBySocket=new Map(current.filter(row=>Number.isInteger(Number(row?.socketIndex))).map(row=>[Number(row.socketIndex),row]));
  const options=item.armourModOptions||item.socketOptions||{};
  const indexes=new Set([...currentBySocket.keys(),...Object.keys(options).map(Number).filter(Number.isInteger)]);
  return [...indexes].sort((a,b)=>a-b).map(socketIndex=>{
    const currentPlug=currentBySocket.get(socketIndex)||null,available=uniqueByHash(options[String(socketIndex)]||options[socketIndex]||[]);
    const currentRole=classifyArmourPlug(currentPlug),role=['general-mod','slot-mod'].includes(currentRole)?currentRole:classifyArmourPlug(available.find(row=>['general-mod','slot-mod'].includes(classifyArmourPlug(row))));
    if(!['general-mod','slot-mod'].includes(role))return null;
    return {socketIndex,role,currentPlug,current:isVerifiedMod(currentPlug)?currentPlug:null,options:available.filter(row=>classifyArmourPlug(row)===role&&isVerifiedMod(row)&&row.canInsert!==false)};
  }).filter(Boolean);
}

function rankArmourModPlan(item,build,objective){
  const sockets=socketRows(item),energy=item.energy||item.armourSemantics?.energy||{},capacity=energy?.capacity===null||energy?.capacity===undefined?null:Number(energy.capacity),reportedUsed=energy?.used===null||energy?.used===undefined?null:Number(energy.used);
  const installed=sockets.map(row=>row.current).filter(Boolean),installedCost=installed.reduce((sum,mod)=>sum+modCost(mod),0),baseUsed=Number.isFinite(reportedUsed)?Math.max(0,reportedUsed-installedCost):0,limit=Number.isFinite(capacity)?capacity:Number.POSITIVE_INFINITY;
  let beam=[{score:0,used:baseUsed,choices:[]}];
  for(const socket of sockets){
    const scored=uniqueByHash([socket.current,...socket.options]).map(mod=>({mod,...scoreMod(mod,{build,objective})}));
    const useful=scored.filter(row=>row.mod===socket.current||row.score>0),choices=[...useful,{mod:null,score:0,stats:Object.fromEntries(STAT_KEYS.map(key=>[key,0])),reasons:[]}];
    const next=[];
    for(const state of beam)for(const choice of choices){
      const used=state.used+modCost(choice.mod);if(used>limit)continue;
      const currentHash=itemHash(socket.current),choiceHash=itemHash(choice.mod),same=(!socket.current&&!choice.mod)||(Number.isInteger(currentHash)&&currentHash===choiceHash),stability=same?2:0,changePenalty=same?0:1;
      next.push({score:state.score+choice.score+stability-changePenalty,used,choices:[...state.choices,{socket,...choice}]});
    }
    next.sort((left,right)=>right.score-left.score||left.used-right.used||JSON.stringify(left.choices.map(row=>itemHash(row.mod)||0)).localeCompare(JSON.stringify(right.choices.map(row=>itemHash(row.mod)||0))));
    beam=next.slice(0,64);
  }
  const best=beam[0]||{score:0,used:Number.isFinite(reportedUsed)?reportedUsed:0,choices:[]};
  const decisions=best.choices.map(row=>{
    const before=row.socket.current,after=row.mod,beforeHash=itemHash(before),afterHash=itemHash(after);
    const action=(!before&&!after)||(before&&after&&beforeHash===afterHash)?'KEEP':!before&&after?'ADD':before&&!after?'REMOVE':'REPLACE';
    return {armourItemInstanceId:String(item.itemInstanceId||''),armourName:itemName(item,'Armour'),socketIndex:row.socket.socketIndex,role:row.socket.role,action,current:clone(before),recommended:clone(after),energyCost:modCost(after),score:row.score,reasons:row.reasons.slice(0,3),projectedStats:row.stats,verifiedOptions:row.socket.options.length};
  });
  const limitations=[];
  if(!sockets.length)limitations.push(`${itemName(item,'Armour')}: Bungie supplied no resolved functional mod sockets.`);
  if(!Number.isFinite(capacity))limitations.push(`${itemName(item,'Armour')}: energy capacity was not resolved, so no capacity claim is made.`);
  for(const row of sockets)if(!row.options.length)limitations.push(`${itemName(item,'Armour')} socket ${row.socketIndex}: no verified insertable alternatives were supplied; the installed state is preserved.`);
  return {itemInstanceId:String(item.itemInstanceId||''),itemName:itemName(item,'Armour'),capacity:Number.isFinite(capacity)?capacity:null,reportedUsed:Number.isFinite(reportedUsed)?reportedUsed:null,projectedUsed:Number.isFinite(best.used)?best.used:null,score:best.score,decisions,limitations};
}

function projectedStats(build,decisions){
  const raw=Object.fromEntries(STAT_KEYS.map(key=>[key,Number(build.forgeLoaderDecision?.statDirective?.achieved?.[key]||0)])),currentContribution=Object.fromEntries(STAT_KEYS.map(key=>[key,decisions.reduce((sum,row)=>sum+Number(modStats(row.current||{})[key]||0),0)])),recommendedContribution=Object.fromEntries(STAT_KEYS.map(key=>[key,decisions.reduce((sum,row)=>sum+Number(modStats(row.recommended||{})[key]||0),0)]));
  const total=vector=>Object.fromEntries(STAT_KEYS.map(key=>[key,Math.max(0,Math.min(200,Number(raw[key]||0)+Number(vector[key]||0)))]));
  return {raw,currentContribution,currentTotal:total(currentContribution),recommendedContribution,recommendedTotal:total(recommendedContribution)};
}

function applyRecommendedMods(item,decisions){
  const next=clone(item);if(!decisions.length)return next;
  const selected=decisions.map(row=>row.recommended?{...clone(row.recommended),socketIndex:row.socketIndex,semanticRole:row.role}:null).filter(Boolean),generalMods=selected.filter(row=>row.semanticRole==='general-mod').sort((a,b)=>a.socketIndex-b.socketIndex),slotMods=selected.filter(row=>row.semanticRole==='slot-mod').sort((a,b)=>a.socketIndex-b.socketIndex),masterwork=next.masterwork||next.armourSemantics?.masterwork||null;
  next.generalMods=generalMods;next.slotMods=slotMods;next.mods=[masterwork,...generalMods.slice(0,2),...slotMods.slice(0,3)];next.armourSemantics={...(next.armourSemantics||{}),generalMods,slotMods};
  return next;
}

function recommendArmourMods({build={},objective='balanced'}={}){
  const working=clone(build),resolvedObjective=objectiveName(objective||working.objective),items=(working.armour||[]).filter(Boolean),itemPlans=items.map(item=>rankArmourModPlan(item,working,resolvedObjective)),decisions=itemPlans.flatMap(row=>row.decisions),limitations=itemPlans.flatMap(row=>row.limitations);
  const byItem=new Map(itemPlans.map(row=>[row.itemInstanceId,row]));
  working.armour=(working.armour||[]).map(item=>item?applyRecommendedMods(item,byItem.get(String(item.itemInstanceId||''))?.decisions||[]):item);
  const plan={schemaVersion:1,source:'bungie-item-sockets-and-reusable-plugs',method:'deterministic-energy-bounded-mod-beam-v1',objective:resolvedObjective,status:'review-required',rawStatsModFree:true,projectedStats:projectedStats(working,decisions),items:itemPlans,decisions,summary:{keep:decisions.filter(row=>row.action==='KEEP').length,replace:decisions.filter(row=>row.action==='REPLACE').length,add:decisions.filter(row=>row.action==='ADD').length,remove:decisions.filter(row=>row.action==='REMOVE').length},limitations:[...new Set(limitations)],requiresReview:true,liveTransferAuthorized:false};
  working.objective=resolvedObjective;working.armourModRecommendation=plan;
  return {workingBuild:working,recommendation:plan};
}

function weaponEvidence(weapon){return [weapon,weapon?.weaponSemantics?.intrinsic,...(weapon?.weaponSemantics?.selectedPerks||[]),...(weapon?.weaponSemantics?.alternativePerkColumns||[]).flatMap(column=>column.options||[])].filter(Boolean);}
function scoreWeapon(weapon,build,objective,currentIds){
  const evidence=weaponEvidence(weapon),tokens=[...new Set(evidence.flatMap(explicitTokens))],text=evidence.map(itemText).join(' · '),sources=buildEvidence({...build,weapons:[]}),reasons=[];
  let score=currentIds.has(itemIdentity(weapon))?2:0;
  for(const source of sources){for(const token of tokens.filter(value=>source.tokens.includes(value)).slice(0,3)){score+=12;reasons.push({kind:'synergy',label:`${itemName(weapon,'Weapon')} has verified ${token} evidence matching ${source.kind} · ${source.name}.`,score:12,token});}}
  for(const term of OBJECTIVE_TERMS[objectiveName(objective)].filter(term=>text.includes(term)).slice(0,5)){score+=7;reasons.push({kind:'objective',label:`Explicit ${term} wording supports the ${objectiveName(objective)} objective.`,score:7,term});}
  reasons.sort((left,right)=>right.score-left.score||left.label.localeCompare(right.label));
  return {weapon,score,reasons,tokens};
}

function selectOwnedWeapons({build={},objective='balanced'}={}){
  const working=clone(build),resolvedObjective=objectiveName(objective||working.objective),owned=(working.ownedWeapons||working.weapons||[]).filter(item=>item?.itemInstanceId&&item?.definition&&Object.keys(item.definition).length),currentIds=new Set((working.weapons||[]).map(itemIdentity)),decisions=[],selected=[];
  for(const bucketHash of WEAPON_BUCKETS){
    const candidates=owned.filter(item=>Number(item.bucketHash)===bucketHash).map(item=>scoreWeapon(item,working,resolvedObjective,currentIds)).sort((left,right)=>right.score-left.score||itemName(left.weapon).localeCompare(itemName(right.weapon))||itemIdentity(left.weapon).localeCompare(itemIdentity(right.weapon)));
    const best=candidates[0]||null,current=(working.weapons||[]).find(item=>Number(item?.bucketHash)===bucketHash)||null,choice=best?.weapon||current;
    if(choice)selected.push(clone(choice));
    decisions.push({bucketHash,current:clone(current),recommended:clone(choice),action:current&&choice&&itemIdentity(current)===itemIdentity(choice)?'KEEP':current&&choice?'REPLACE':choice?'ADD':'UNRESOLVED',score:best?.score||0,reasons:(best?.reasons||[]).slice(0,4),candidateCount:candidates.length});
  }
  working.weapons=selected;working.objective=resolvedObjective;
  const limitations=[];if(!(working.ownedWeapons||[]).length)limitations.push('A broader owned-weapon catalogue was unavailable; current equipped weapons were retained.');for(const row of decisions)if(!row.candidateCount)limitations.push(`Weapon bucket ${row.bucketHash}: no verified exact owned instance was resolved.`);
  const recommendation={schemaVersion:1,source:'bungie-owned-exact-weapon-instances',method:'deterministic-owned-weapon-evidence-rank-v1',objective:resolvedObjective,status:'review-required',decisions,candidateCount:owned.length,limitations,requiresReview:true,liveTransferAuthorized:false};
  working.weaponSelectionRecommendation=recommendation;
  return {workingBuild:working,recommendation};
}

export {OBJECTIVE_TERMS,STAT_KEYS,WEAPON_BUCKETS,isVerifiedMod,modCost,modStats,recommendArmourMods,scoreMod,selectOwnedWeapons};
