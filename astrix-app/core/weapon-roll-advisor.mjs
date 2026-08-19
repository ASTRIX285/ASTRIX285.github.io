const unique=values=>[...new Set((values||[]).filter(Boolean).map(String))];

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
    evidence:Array.isArray(row.evidence)?row.evidence:[]
  };
}

function cartesian(columns){
  if(!columns.length)return [[]];
  return columns.reduce((acc,column)=>acc.flatMap(prefix=>column.map(value=>[...prefix,value])),[[]]);
}

function scoreCombination(perks,context={}){
  const desired=unique(context.desiredTokens||context.consumedTokens||[]);
  const buildEmits=unique(context.emittedTokens||[]);
  const preferredRoles=unique(context.preferredRoles||[]);
  const activityNeeds=unique(context.activityNeeds||[]);

  const emits=unique(perks.flatMap(perk=>perk?.emits||[]));
  const consumes=unique(perks.flatMap(perk=>perk?.consumes||[]));
  const roles=unique(perks.flatMap(perk=>perk?.roles||[]));

  const directEdges=emits.filter(token=>desired.includes(token));
  const supportedInputs=consumes.filter(token=>buildEmits.includes(token));
  const roleMatches=roles.filter(role=>preferredRoles.includes(role)||activityNeeds.includes(role));

  let score=0;
  score+=directEdges.length*30;
  score+=supportedInputs.length*18;
  score+=roleMatches.length*12;
  score+=perks.filter(Boolean).length*2;

  const reasons=[];
  if(directEdges.length)reasons.push(`Feeds build tokens: ${directEdges.join(", ")}`);
  if(supportedInputs.length)reasons.push(`Consumes existing build outputs: ${supportedInputs.join(", ")}`);
  if(roleMatches.length)reasons.push(`Matches requested roles: ${roleMatches.join(", ")}`);
  if(!reasons.length)reasons.push("No verified directed synergy edge found for the current build context.");

  return {score,directEdges,supportedInputs,roleMatches,reasons,emits,consumes,roles};
}

function adviseWeaponRoll({weapon,intelligence,context={}}={}){
  const columns=Array.isArray(weapon?.perkColumns)?weapon.perkColumns:[];
  const selectableColumns=columns
    .map(column=>(Array.isArray(column?.options)?column.options:[])
      .map(option=>({
        ...option,
        hash:String(option?.hash??option?.plugHash??""),
        intelligence:normalisePerkIntelligence(option?.hash??option?.plugHash,intelligence)
      }))
      .filter(option=>option.hash))
    .filter(column=>column.length);

  const combinations=cartesian(selectableColumns).map(options=>{
    const curated=options.map(option=>option.intelligence).filter(Boolean);
    const assessment=scoreCombination(curated,context);
    return {
      options:options.map(option=>({hash:option.hash,name:option.name||option.intelligence?.name||""})),
      curatedCoverage:curated.length,
      ...assessment
    };
  });

  combinations.sort((a,b)=>b.score-a.score||b.curatedCoverage-a.curatedCoverage);
  const best=combinations[0]||null;
  const currentHashes=unique(weapon?.selectedPerkHashes||[]);
  const recommendedHashes=best?best.options.map(option=>option.hash):[];
  const alreadySelected=best&&currentHashes.length===recommendedHashes.length&&recommendedHashes.every(hash=>currentHashes.includes(hash));

  return {
    weaponHash:weapon?.itemHash??weapon?.hash??null,
    itemInstanceId:weapon?.itemInstanceId??null,
    combinationCount:combinations.length,
    currentPerkHashes:currentHashes,
    best,
    alternatives:combinations.slice(1,4),
    alreadySelected:Boolean(alreadySelected),
    action:{
      mode:"recommend-only",
      remotePerkMutationSupported:false,
      label:alreadySelected?"Current roll already matches this build":"Use recommended perk combination"
    },
    warnings:[
      ...(selectableColumns.length?[]:["No selectable perk columns were supplied for this weapon instance."]),
      ...(best&&best.curatedCoverage<best.options.length?["Some selectable perks do not yet have curated Paradox intelligence; they were not awarded unverified synergy score."]:[])
    ]
  };
}

export {adviseWeaponRoll,scoreCombination,normalisePerkIntelligence};
