const unique=values=>[...new Set((values||[]).filter(Boolean).map(String))];
const TOKEN_PATTERNS=Object.freeze({
  "arc":/\barc\b/i,"solar":/\bsolar\b/i,"void":/\bvoid\b/i,"stasis":/\bstasis\b/i,"strand":/\bstrand\b/i,
  "blind":/\bblind(?:ed|ing)?\b/i,"devour":/\bdevour\b/i,"freeze":/\bfreez(?:e|es|ing)\b|\bfrozen\b/i,"ignite":/\bignit(?:e|es|ing|ion)\b/i,"jolt":/\bjolt(?:ed|ing)?\b/i,"radiant":/\bradiant\b/i,"restoration":/\brestoration\b/i,"scorch":/\bscorch(?:ed|ing)?\b/i,"sever":/\bsever(?:ed|ing)?\b/i,"slow":/\bslow(?:ed|ing)?\b/i,"suspend":/\bsuspend(?:ed|ing)?\b/i,"suppression":/\bsuppress(?:ed|ion|ing)?\b/i,"unravel":/\bunravel(?:ed|ing)?\b/i,"volatile":/\bvolatile\b/i,"weaken":/\bweaken(?:ed|ing)?\b/i,
  "ionic-trace":/\bionic traces?\b/i,"stasis-crystal":/\bstasis crystals?\b/i,"stasis-shard":/\bstasis shards?\b/i,"tangle":/\btangles?\b/i,"threadling":/\bthreadlings?\b/i,"orb-of-power":/\borbs? of power\b/i,
  "grenade-energy":/\bgrenade energy\b/i,"melee-energy":/\bmelee energy\b/i,"class-ability-energy":/\bclass ability energy\b/i,"super-energy":/\bsuper energy\b/i,
  "precision-final-blow":/\bprecision (?:final blows?|kills?)\b/i,"rapid-final-blow":/\brapid (?:final blows?|kills?)\b/i,"weapon-final-blow":/\b(?:weapon )?(?:final blows?|kills?)\b/i,"reload":/\breload(?:ed|ing)?\b/i,"matching-element":/\bmatching (?:damage type|element|subclass)\b/i,
  "damage":/\b(?:bonus|increased|additional) (?:weapon )?damage\b|\bdamage bonus\b/i,"ammo":/\bammo|ammunition\b/i,"overshield":/\bovershield\b/i,"invisibility":/\binvisib(?:le|ility)\b/i,"health":/\bhealth|healing|heal\b/i
});

const ROLE_PATTERNS=Object.freeze({
  "damage":/\b(?:bonus|increased|additional) (?:weapon )?damage\b|\bdamage bonus\b/i,
  "add-clear":/\bnearby targets?|multiple targets?|chain|area of effect|explosion\b/i,
  "ability-uptime":/\b(?:grenade|melee|class ability|super) energy\b|\bability energy\b/i,
  "ammo-economy":/\bammo|ammunition\b/i,
  "survivability":/\bheal|health|overshield|restoration|devour|invisib|damage resistance\b/i,
  "reload":/\breload(?:ed|ing)?\b/i,
  "precision":/\bprecision\b/i
});

const verifiedText=option=>[option?.name,option?.description,option?.displayProperties?.description,option?.definition?.displayProperties?.description,...(option?.traitIds||[]),...(option?.definition?.traitIds||[])].filter(Boolean).join(" · ");
const canonicalToken=value=>String(value??"").trim().toLowerCase().replace(/\s+/g,"-");

function normalisePerkIntelligence(perkHash, intelligence){
  const row=intelligence?.perks?.[String(perkHash)]||null;
  if(!row)return null;
  return {
    hash:String(perkHash),
    name:String(row.name||""),
    emits:unique(row.emits),
    consumes:unique(row.consumes),
    conditions:unique(row.conditions),
    roles:unique(row.roles),
    strengths:unique(row.strengths),
    limitations:unique(row.limitations),
    signals:unique([...(row.emits||[]),...(row.consumes||[]),...(row.conditions||[])]).map(canonicalToken),
    evidence:Array.isArray(row.evidence)?row.evidence:[],
    source:"paradox-curated"
  };
}

function manifestPerkIntelligence(option){
  const hash=String(option?.hash??option?.plugHash??""),description=verifiedText(option),definition=option?.definition;
  if(!hash||!description||option?.unresolved===true||!definition||typeof definition!=="object"||!Object.keys(definition).length)return null;
  const signals=Object.entries(TOKEN_PATTERNS).filter(([,pattern])=>pattern.test(description)).map(([token])=>token),roles=Object.entries(ROLE_PATTERNS).filter(([,pattern])=>pattern.test(description)).map(([role])=>role),conditions=signals.filter(token=>["precision-final-blow","rapid-final-blow","weapon-final-blow","reload","matching-element"].includes(token));
  return {hash,name:String(option?.name||option?.displayProperties?.name||definition?.displayProperties?.name||""),emits:[],consumes:[],conditions,roles:unique(roles),strengths:[],limitations:[],signals:unique(signals),evidence:[{source:"DestinyInventoryItemDefinition",hash,description:String(option?.description||definition?.displayProperties?.description||"")}],source:"bungie-manifest-description"};
}

function resolvePerkIntelligence(option,intelligence){
  return normalisePerkIntelligence(option?.hash??option?.plugHash,intelligence)||manifestPerkIntelligence(option);
}

function cartesian(columns){
  if(!columns.length)return [[]];
  return columns.reduce((acc,column)=>acc.flatMap(prefix=>column.map(value=>[...prefix,value])),[[]]);
}

function scoreCombination(perks,context={}){
  const desired=unique(context.desiredTokens||context.consumedTokens||[]).map(canonicalToken);
  const buildEmits=unique(context.emittedTokens||[]).map(canonicalToken);
  const preferredRoles=unique(context.preferredRoles||[]).map(canonicalToken);
  const activityNeeds=unique(context.activityNeeds||[]).map(canonicalToken);

  const emits=unique(perks.flatMap(perk=>perk?.emits||[])).map(canonicalToken);
  const consumes=unique(perks.flatMap(perk=>perk?.consumes||[])).map(canonicalToken);
  const roles=unique(perks.flatMap(perk=>perk?.roles||[])).map(canonicalToken);
  const signals=unique(perks.flatMap(perk=>perk?.signals||[])).map(canonicalToken);

  const directEdges=emits.filter(token=>desired.includes(token));
  const supportedInputs=consumes.filter(token=>buildEmits.includes(token));
  const roleMatches=roles.filter(role=>preferredRoles.includes(role)||activityNeeds.includes(role));
  const contextSignals=unique([...desired,...buildEmits,...preferredRoles,...activityNeeds]);
  const signalMatches=signals.filter(token=>contextSignals.includes(token));

  let score=0;
  score+=directEdges.length*30;
  score+=supportedInputs.length*18;
  score+=roleMatches.length*12;
  score+=signalMatches.length*10;

  const reasons=[];
  if(directEdges.length)reasons.push(`Feeds build tokens: ${directEdges.join(", ")}`);
  if(supportedInputs.length)reasons.push(`Consumes existing build outputs: ${supportedInputs.join(", ")}`);
  if(roleMatches.length)reasons.push(`Matches requested roles: ${roleMatches.join(", ")}`);
  if(signalMatches.length)reasons.push(`Shares verified Bungie mechanics: ${signalMatches.join(", ")}`);
  if(!reasons.length)reasons.push("No verified directed synergy edge found for the current build context.");

  return {score,evidenceMatchCount:directEdges.length+supportedInputs.length+roleMatches.length+signalMatches.length,directEdges,supportedInputs,roleMatches,signalMatches,reasons,emits,consumes,roles,signals};
}

function adviseWeaponRoll({weapon,intelligence,context={},capabilities={}}={}){
  const fixedTraits=(weapon?.fixedTraits||[]).map(option=>resolvePerkIntelligence(option,intelligence)).filter(Boolean),fixedAssessment=scoreCombination(fixedTraits,context);
  const columns=Array.isArray(weapon?.perkColumns)?weapon.perkColumns:[];
  const selectableColumns=columns
    .map(column=>(Array.isArray(column?.options)?column.options:[])
      .map(option=>({
        ...option,
        hash:String(option?.hash??option?.plugHash??""),
        intelligence:resolvePerkIntelligence(option,intelligence)
      }))
      .filter(option=>option.hash))
    .filter(column=>column.length);

  const combinations=cartesian(selectableColumns).map(options=>{
    const curated=options.map(option=>option.intelligence).filter(Boolean);
    const selectableAssessment=scoreCombination(curated,context),assessment=scoreCombination([...fixedTraits,...curated],context);
    return {
      options:options.map(option=>({hash:option.hash,name:option.name||option.intelligence?.name||"",socketIndex:Number.isInteger(Number(option.socketIndex))?Number(option.socketIndex):null})),
      curatedCoverage:curated.length,
      verifiedCoverage:curated.length,
      selectableEvidenceMatchCount:selectableAssessment.evidenceMatchCount,
      fixedEvidenceMatchCount:fixedAssessment.evidenceMatchCount,
      ...assessment
    };
  });

  combinations.sort((a,b)=>b.score-a.score||b.curatedCoverage-a.curatedCoverage);
  const best=combinations[0]||null;
  const currentHashes=unique(weapon?.selectedPerkHashes||[]);
  const currentBySocket=new Map((weapon?.selectedPerks||[]).filter(row=>Number.isInteger(Number(row?.socketIndex))).map(row=>[Number(row.socketIndex),String(row.hash??row.plugHash??"")]));
  const recommendedHashes=best?best.options.map(option=>option.hash):[];
  const alreadySelected=best&&best.options.every(option=>option.socketIndex!=null?currentBySocket.get(option.socketIndex)===option.hash:currentHashes.includes(option.hash));
  const hasVerifiedRecommendation=Boolean(best&&best.selectableEvidenceMatchCount>0&&best.verifiedCoverage>0);
  const stagedChanges=hasVerifiedRecommendation&&!alreadySelected?best.options.filter(option=>option.socketIndex!=null&&currentBySocket.get(option.socketIndex)!==option.hash).map(option=>({itemInstanceId:String(weapon?.itemInstanceId||""),socketIndex:option.socketIndex,currentPlugHash:currentBySocket.get(option.socketIndex)||null,plugHash:option.hash,source:"bungie-reusable-plugs",reversible:true,confirmed:false})).filter(change=>change.itemInstanceId):[];
  const remotePerkMutationSupported=Boolean(capabilities?.insertSocketPlugFree===true);

  return {
    weaponHash:weapon?.itemHash??weapon?.hash??null,
    itemInstanceId:weapon?.itemInstanceId??null,
    combinationCount:combinations.length,
    currentPerkHashes:currentHashes,
    best,
    fixedEvidence:{traitCount:fixedTraits.length,catalystMasterworked:Boolean(weapon?.catalyst?.masterworked),score:fixedAssessment.score,reasons:fixedAssessment.reasons},
    alternatives:combinations.slice(1,4),
    alreadySelected:Boolean(alreadySelected),
    hasVerifiedRecommendation,
    stagedChanges,
    action:{
      mode:remotePerkMutationSupported&&stagedChanges.length?"confirm-required":"recommend-only",
      remotePerkMutationSupported,
      requiresUserConfirmation:true,
      label:alreadySelected?"Current roll already matches this build":hasVerifiedRecommendation?(remotePerkMutationSupported?"Review and apply perk changes":"Use recommended perk combination"):"No verified perk match"
    },
    warnings:[
      ...(selectableColumns.length?[]:["No selectable perk columns were supplied for this weapon instance."]),
      ...(best&&best.verifiedCoverage<best.options.length?["Some selectable perks have no verified effect description or curated Paradox intelligence; they received no synergy score."]:[])
    ]
  };
}

export {adviseWeaponRoll,scoreCombination,normalisePerkIntelligence,manifestPerkIntelligence,resolvePerkIntelligence};
