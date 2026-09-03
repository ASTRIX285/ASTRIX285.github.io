/* Deterministic Build Forge recommendation composer.
 *
 * The composer is intentionally evidence-bound: it may choose only hashes that
 * already exist in the selected Guardian's verified Bungie subclass catalogue.
 * It scores explicit Manifest descriptions/trait IDs against the staged Forge
 * Loader Exotic, armour-set, stat and owned-weapon evidence. An injected
 * directed-loop analyser is used as the strongest signal; missing evidence is
 * recorded as a limitation instead of being invented.
 */

const ELEMENTS=Object.freeze(['arc','solar','strand','stasis','void','prismatic']);
const COMBAT_TERMS=Object.freeze([
  'amplified','blind','cure','devour','freeze','frozen','ignite','ignition',
  'invisibility','invisible','jolt','overshield','radiant','restoration','scorch',
  'sever','shatter','slow','suspend','suppression','suppress','threadling',
  'unravel','volatile','weaken','weakened','woven mail','ionic trace','tangle',
  'stasis crystal','stasis shard','orb of power','grenade','melee','class ability',
  'super','weapon'
]);
const ABILITY_SOCKETS=Object.freeze(['classAbility','movement','melee','grenade']);
const BEAM_WIDTH=18;

const clone=value=>{try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}};
const clean=value=>String(value??'').trim();
const lower=value=>clean(value).toLowerCase();
const uniq=values=>[...new Set(values.filter(Boolean))];
const itemKey=item=>String(item?.hash??item?.itemHash??item?.bungieHash??'');
const itemName=(item,fallback='Verified component')=>clean(item?.name??item?.displayName??item?.definition?.displayProperties?.name)||fallback;

function itemEvidence(item={}){
  const definition=item?.definition||{};
  const official=item?.official||{};
  return [
    itemName(item,''),item?.element,item?.subclass,item?.damageType,item?.description,item?.officialDescription,item?.display?.description,
    definition?.displayProperties?.description,definition?.itemTypeDisplayName,
    definition?.plug?.plugCategoryIdentifier,definition?.plug?.plugCategoryHash,
    ...(definition?.traitIds||[]),...(official?.traitIds||[]),...(item?.traitIds||[])
  ].map(clean).filter(Boolean).join(' · ').toLowerCase();
}

function explicitTokens(value){
  const text=typeof value==='string'?lower(value):itemEvidence(value);
  return uniq([
    ...ELEMENTS.filter(term=>text.includes(term)),
    ...COMBAT_TERMS.filter(term=>text.includes(term)).map(term=>term==='frozen'?'freeze':term==='ignition'?'ignite':term==='invisible'?'invisibility':term==='suppress'?'suppression':term==='weakened'?'weaken':term)
  ]);
}

function resolvedItem(item){
  const hash=Number(itemKey(item));
  if(!item||!Number.isInteger(hash)||hash<=0||item.unresolved===true||/^unresolved\b/i.test(itemName(item,'')))return false;
  const definition=item.definition;
  return Boolean((definition&&typeof definition==='object'&&Object.keys(definition).length)||item.source==='bungie-manifest'||clean(item.description||item.officialDescription));
}

function uniqueResolved(rows=[]){
  const seen=new Set();
  return (Array.isArray(rows)?rows:[]).filter(resolvedItem).filter(item=>{const key=itemKey(item);if(seen.has(key))return false;seen.add(key);return true;});
}

function hasVerifiedSubclassSockets(candidate={}){
  const sb=candidate.subclassBuild||candidate.build||{};
  if(sb.socketsAvailable!==true||sb.socketCoverage?.complete===false||!uniqueResolved([sb.super,...(sb.superOptions||[])]).length)return false;
  const abilitiesReady=ABILITY_SOCKETS.every(socket=>uniqueResolved([sb[socket],...(sb.abilityOptionsBySocket?.[socket]||[])]).length);
  const aspectsReady=uniqueResolved([...(sb.aspects||[]),...(sb.availableAspects||sb.aspectOptions||[])]).length>0;
  const fragmentsReady=uniqueResolved([...(sb.fragments||[]),...(sb.availableFragments||sb.fragmentOptions||[])]).length>0;
  return abilitiesReady&&aspectsReady&&fragmentsReady;
}

function selectedComponents(build={}){
  const sb=build.subclassBuild||{};
  return [sb.super,...(sb.abilities||[]),...(sb.aspects||[]),...(sb.fragments||[])].filter(Boolean);
}

function optionSources(build={}){
  const decision=build.forgeLoaderDecision||{},sources=[];
  const add=(kind,item)=>{if(item)sources.push({kind,item,name:itemName(item,kind),tokens:explicitTokens(item)});};
  add('selected Exotic',decision?.buildAnchor?.perk);
  for(const row of decision?.setProtocol||[])add(`${Number(row?.count)||0}-piece armour set`,row?.trait||row);
  for(const row of build?.paradoxEvidence?.armour||[])if(row?.verified!==false)add('equipped armour evidence',row);
  for(const weapon of build.weapons||[]){
    add('owned weapon',weapon);
    for(const perk of weapon?.weaponSemantics?.selectedPerks||[])add(`${itemName(weapon,'weapon')} perk`,perk);
  }
  return sources.filter(source=>source.tokens.length);
}

function elementOf(value){
  const text=typeof value==='string'?lower(value):itemEvidence(value);
  return ELEMENTS.find(element=>text.includes(element))||'';
}

function stageVerifiedSubclassCandidate(build={},candidate={}){
  const working=clone(build)||{};
  const supplied=candidate.subclassBuild||candidate.build||{};
  working.subclassName=itemName(candidate,working.subclassName||working.subclass||'Subclass');
  working.subclass=candidate.key||candidate.element||candidate.subclass||working.subclass;
  working.subclassIcon=candidate.icon||candidate?.definition?.displayProperties?.icon||working.subclassIcon||'';
  working.subclassBuild=clone(supplied);
  return synchroniseSubclassProjection(working);
}

function synchroniseSubclassProjection(build={}){
  const sb=build.subclassBuild||{};
  const abilities=ABILITY_SOCKETS.map(key=>sb[key]).filter(Boolean);
  sb.abilities=abilities.length?abilities:uniqueResolved(sb.abilities||[]);
  const byType=new Map((sb.abilities||[]).map(item=>[lower(item?.componentType||item?.abilityType||item?.type),item]));
  if(!sb.classAbility)sb.classAbility=byType.get('classability')||null;
  if(!sb.movement)sb.movement=byType.get('movementability')||byType.get('movement')||null;
  if(!sb.melee)sb.melee=byType.get('melee')||null;
  if(!sb.grenade)sb.grenade=byType.get('grenade')||null;
  sb.abilities=ABILITY_SOCKETS.map(key=>sb[key]).filter(Boolean);
  build.subclassBuild=sb;
  build.super=sb.super||null;
  build.superOptions=clone(sb.superOptions||[]);
  build.classAbility=sb.classAbility||null;
  build.movement=sb.movement||null;
  build.melee=sb.melee||null;
  build.grenade=sb.grenade||null;
  build.abilities=clone(sb.abilities||[]);
  build.aspects=clone(sb.aspects||[]);
  build.fragments=clone(sb.fragments||[]);
  return build;
}

function componentEvidenceScore(item,context={}){
  const tokens=explicitTokens(item),reasons=[];
  const add=(code,label,score,evidence=null)=>reasons.push({code,label,score,evidence});
  for(const source of context.sources||[]){
    for(const token of tokens.filter(value=>source.tokens.includes(value)).slice(0,3)){
      add(`mechanic:${token}:${source.kind}`,`${itemName(item)} shares verified ${token} evidence with ${source.kind} · ${source.name}`,36,{componentHash:Number(itemKey(item)),sourceKind:source.kind,sourceName:source.name,token});
    }
  }
  const element=elementOf(item);
  if(context.element&&context.element!=='prismatic'&&element===context.element)add('element-match',`${itemName(item)} matches the requested ${context.element.toUpperCase()} damage build`,18,{element});
  const priorities=context.priorities||{};
  for(const stat of ['health','melee','grenade','super','class','weapon']){
    const rank=Number(priorities[stat]);
    if(!Number.isInteger(rank)||rank<1||rank>6||!tokens.includes(stat==='class'?'class ability':stat))continue;
    add(`stat-priority:${stat}`,`${itemName(item)} has explicit ${stat} evidence for Forge Loader priority ${rank}`,Math.max(6,24-(rank-1)*3),{stat,rank});
  }
  reasons.sort((left,right)=>right.score-left.score||left.label.localeCompare(right.label));
  return {score:reasons.reduce((sum,row)=>sum+row.score,0),tokens,reasons};
}

function analysisScore(analysis={}){
  const links=Array.isArray(analysis?.buildLoop)?analysis.buildLoop.length:0;
  const strengths=Array.isArray(analysis?.strengths)?analysis.strengths.length:0;
  const weakLinks=Array.isArray(analysis?.weakLinks)?analysis.weakLinks.length:0;
  const confidence=String(analysis?.confidence?.level||'').toLowerCase();
  const confidencePoints={high:80,medium:45,low:10,insufficient:0}[confidence]||0;
  return {score:(links*120)+(strengths*20)-(weakLinks*45)+confidencePoints,links,strengths,weakLinks,confidence:confidence||'evidence-limited'};
}

function evaluate(build,context,analyzeBuild){
  const projected=synchroniseSubclassProjection(build);
  const components=selectedComponents(projected),componentRows=components.map(item=>({item,...componentEvidenceScore(item,context)}));
  const signature=JSON.stringify({super:itemKey(projected.subclassBuild?.super),abilities:(projected.subclassBuild?.abilities||[]).map(itemKey),aspects:(projected.subclassBuild?.aspects||[]).map(itemKey).sort(),fragments:(projected.subclassBuild?.fragments||[]).map(itemKey).sort()});
  const cached=context.cache?.get(signature);
  if(cached)return {build:projected,componentRows,signature,...cached};
  let analysis=null;
  try{analysis=typeof analyzeBuild==='function'?analyzeBuild(projected):null;}catch{analysis=null;}
  const directed=analysisScore(analysis||{});
  const componentScore=componentRows.reduce((sum,row)=>sum+row.score,0);
  const coveredElements=uniq(components.flatMap(explicitTokens).filter(token=>ELEMENTS.includes(token)&&token!=='prismatic'));
  const prismaticScore=context.element==='prismatic'?coveredElements.length*28:0;
  const retainedComponents=components.filter(item=>context.baselineKeys?.has(itemKey(item))).length,stabilityScore=retainedComponents*2;
  const evaluated={analysis,score:directed.score+componentScore+prismaticScore+stabilityScore,directed,componentScore,stabilityScore,coveredElements};
  context.cache?.set(signature,evaluated);
  return {build:projected,componentRows,signature,...evaluated};
}

function rank(states,context,analyzeBuild,width=BEAM_WIDTH){
  const seen=new Map();
  for(const state of states){
    const row=evaluate(state,context,analyzeBuild),prior=seen.get(row.signature);
    if(!prior||row.score>prior.score)seen.set(row.signature,row);
  }
  return [...seen.values()].sort((left,right)=>right.score-left.score||right.directed.links-left.directed.links||left.signature.localeCompare(right.signature)).slice(0,width);
}

function combinations(rows,count){
  if(count<=0)return [[]];
  const output=[];
  const visit=(start,picked)=>{if(picked.length===count){output.push(picked);return;}for(let index=start;index<=rows.length-(count-picked.length);index+=1)visit(index+1,[...picked,rows[index]]);};
  visit(0,[]);
  return output;
}

function fragmentCapacity(build={},options=[]){
  const aspects=build.subclassBuild?.aspects||[];
  const explicit=aspects.map(item=>Number(item?.fragmentSlots??item?.fragmentSlotCount??item?.definition?.plug?.fragmentSlots)).filter(Number.isFinite);
  if(explicit.length===aspects.length&&explicit.length)return Math.max(0,Math.min(5,explicit.reduce((sum,value)=>sum+value,0)));
  const equipped=build.subclassBuild?.fragments||[];
  return Math.max(0,Math.min(5,equipped.length||options.length));
}

function setAbility(build,key,item){
  const next=clone(build);next.subclassBuild[key]=clone(item);return synchroniseSubclassProjection(next);
}

function decisionLedger(result,context){
  const rows=result.componentRows.map(row=>({
    componentHash:Number(itemKey(row.item)),componentName:itemName(row.item),componentType:clean(row.item?.componentType||row.item?.definition?.itemTypeDisplayName||'subclass component'),score:row.score,
    reasons:row.reasons.slice(0,3),evidenceStatus:row.reasons.length?'verified-match':'verified-identity-retained'
  }));
  rows.sort((left,right)=>right.score-left.score||left.componentName.localeCompare(right.componentName));
  const limitations=[];
  if(!result.analysis)limitations.push('Directed-loop analysis was unavailable; component choices use explicit Forge Loader evidence matches only.');
  if(result.directed.links===0)limitations.push('No directed producer-to-consumer loop is proven by the currently resolved descriptions.');
  if(context.element==='prismatic'){
    const missing=['arc','solar','void','stasis','strand'].filter(element=>!result.coveredElements.includes(element));
    if(missing.length)limitations.push(`Verified Prismatic component evidence does not cover: ${missing.join(', ')}.`);
  }
  return {rows,limitations};
}

function composeForgeRecommendation({build={},candidate={},element='',analyzeBuild=null}={}){
  const requested=ELEMENTS.includes(lower(element))?lower(element):elementOf(candidate);
  if(!requested)throw new TypeError('A verified elemental build option is required.');
  if(!hasVerifiedSubclassSockets(candidate))throw new TypeError('The selected element does not have a complete verified Bungie subclass socket set.');
  let base=stageVerifiedSubclassCandidate(build,candidate);
  const context={element:requested,sources:optionSources(base),priorities:base?.forgeLoaderDecision?.statDirective?.priorities||{},baselineKeys:new Set(selectedComponents(base).map(itemKey)),cache:new Map()};
  let beam=[evaluate(base,context,analyzeBuild)];

  const superOptions=uniqueResolved(base.subclassBuild?.superOptions||[]);
  if(superOptions.length)beam=rank(superOptions.map(item=>{const next=clone(base);next.subclassBuild.super=clone(item);return next;}),context,analyzeBuild);

  for(const socket of ABILITY_SOCKETS){
    const fallback=beam[0]?.build?.subclassBuild?.[socket];
    const options=uniqueResolved([...(base.subclassBuild?.abilityOptionsBySocket?.[socket]||[]),fallback]);
    if(!options.length)continue;
    beam=rank(beam.flatMap(row=>options.map(item=>setAbility(row.build,socket,item))),context,analyzeBuild);
  }

  const aspectOptions=uniqueResolved([...(base.subclassBuild?.availableAspects||base.subclassBuild?.aspectOptions||[]),...(base.subclassBuild?.aspects||[])]).slice(0,12);
  const aspectCount=Math.min(2,Math.max(base.subclassBuild?.aspects?.length||0,Math.min(2,aspectOptions.length)));
  if(aspectOptions.length&&aspectCount){
    const aspectSets=combinations(aspectOptions,aspectCount);
    beam=rank(beam.flatMap(row=>aspectSets.map(set=>{const next=clone(row.build);next.subclassBuild.aspects=clone(set);return synchroniseSubclassProjection(next);})),context,analyzeBuild);
  }

  const fragmentOptions=uniqueResolved([...(base.subclassBuild?.availableFragments||base.subclassBuild?.fragmentOptions||[]),...(base.subclassBuild?.fragments||[])]);
  const capacity=Math.min(fragmentOptions.length,fragmentCapacity(beam[0]?.build||base,fragmentOptions));
  if(fragmentOptions.length&&capacity){
    beam=beam.map(row=>{const next=clone(row.build);next.subclassBuild.fragments=[];return evaluate(synchroniseSubclassProjection(next),context,analyzeBuild);});
    for(let slot=0;slot<capacity;slot+=1){
      beam=rank(beam.flatMap(row=>fragmentOptions.filter(item=>!(row.build.subclassBuild.fragments||[]).some(selected=>itemKey(selected)===itemKey(item))).map(item=>{const next=clone(row.build);next.subclassBuild.fragments=[...(next.subclassBuild.fragments||[]),clone(item)];return synchroniseSubclassProjection(next);})),context,analyzeBuild);
      if(!beam.length)break;
    }
  }

  const best=beam[0]||evaluate(base,context,analyzeBuild),ledger=decisionLedger(best,context);
  return {
    workingBuild:best.build,
    analysis:best.analysis,
    intelligence:{
      schemaVersion:1,source:'verified-forge-loader-bungie-catalogue',method:'deterministic-evidence-beam-v1',element:requested,status:'review-required',score:best.score,
      evidence:{forgeSources:context.sources.map(source=>({kind:source.kind,name:source.name,tokens:source.tokens})),directedLinks:best.directed.links,strengths:best.directed.strengths,weakLinks:best.directed.weakLinks,confidence:best.directed.confidence,componentScore:best.componentScore,stabilityScore:best.stabilityScore},
      prismaticCoverage:requested==='prismatic'?{covered:best.coveredElements,missing:['arc','solar','void','stasis','strand'].filter(value=>!best.coveredElements.includes(value))}:null,
      decisions:ledger.rows,limitations:ledger.limitations,requiresReview:true,liveTransferAuthorized:false
    }
  };
}

export {ABILITY_SOCKETS,COMBAT_TERMS,ELEMENTS,composeForgeRecommendation,explicitTokens,hasVerifiedSubclassSockets,resolvedItem,stageVerifiedSubclassCandidate,synchroniseSubclassProjection};
