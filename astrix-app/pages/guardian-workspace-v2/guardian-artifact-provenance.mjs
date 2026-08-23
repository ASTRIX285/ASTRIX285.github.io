const BUNGIE='https://www.bungie.net';
const abs=path=>path?(String(path).startsWith('http')?String(path):`${BUNGIE}${path}`):'';
const numberOrNull=value=>{
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
};
const definition=(definitions,hash)=>hash===null?null:(definitions?.[String(hash)]||null);

function displayItem(definitions,hash){
  const numericHash=numberOrNull(hash);
  const row=definition(definitions,numericHash);
  return {
    hash:numericHash,
    bungieHash:numericHash,
    name:row?.displayProperties?.name||'',
    description:row?.displayProperties?.description||'',
    icon:abs(row?.displayProperties?.icon),
    definition:row,
    displayResolved:Boolean(row),
    unresolved:!row
  };
}

function createArtifactConfiguration({artifactHash=null,seasonNumber=null,selectedPerkHashes=null,source,provenance}={}){
  return {
    schemaVersion:1,
    artifactHash:numberOrNull(artifactHash),
    seasonNumber:numberOrNull(seasonNumber),
    selectedPerkHashes:Array.isArray(selectedPerkHashes)?[...new Set(selectedPerkHashes.map(numberOrNull).filter(value=>value!==null))]:null,
    source:String(source||'unknown'),
    provenance:provenance&&typeof provenance==='object'?structuredClone(provenance):null
  };
}

function resolveArtifactByProvenance(payload,characterId){
  const profile=payload?.profile||{};
  const definitions=payload?.definitions||{};
  const cid=String(characterId||'');
  const progressionData=profile?.characterProgressions?.data;
  const characterProgression=progressionData&&Object.prototype.hasOwnProperty.call(progressionData,cid)?progressionData[cid]:null;
  const seasonalArtifact=characterProgression?.seasonalArtifact;
  const profileArtifactHash=numberOrNull(profile?.profileProgression?.data?.seasonalArtifact?.artifactHash);
  const characterArtifactHash=numberOrNull(seasonalArtifact?.artifactHash);
  const artifactDefinition=payload?.artifactDefinition||null;
  const definitionHash=numberOrNull(artifactDefinition?.hash);
  const artifactHash=characterArtifactHash??profileArtifactHash??definitionHash;
  const seasonNumber=numberOrNull(payload?.seasonNumber??payload?.currentSeasonNumber??payload?.artifactCoverage?.seasonNumber??artifactDefinition?.seasonNumber);
  const base={hash:artifactHash,bungieHash:artifactHash,name:artifactDefinition?.displayProperties?.name||'',description:artifactDefinition?.displayProperties?.description||'',icon:abs(artifactDefinition?.displayProperties?.icon),definition:artifactDefinition,displayResolved:Boolean(artifactDefinition),coverage:payload?.artifactCoverage||null};
  const provenance={provider:'bungie',endpoint:'Destiny2.GetProfile',component:202,componentName:'CharacterProgressions',characterId:cid,path:`characterProgressions.data.${cid}.seasonalArtifact.tiers[].items[isActive=true]`};

  if(!characterProgression||!seasonalArtifact||!Array.isArray(seasonalArtifact.tiers)){
    const artifactConfiguration=createArtifactConfiguration({artifactHash,seasonNumber,selectedPerkHashes:null,source:'bungie-live-state-unavailable',provenance:{...provenance,state:'state-unavailable'}});
    return {...base,state:'state-unavailable',provenance:'state-unavailable',perks:null,activePerks:null,unresolvedPerkHashes:[],artifactConfiguration,stateMessage:'Artifact activation state for the selected character is unavailable.'};
  }

  const items=seasonalArtifact.tiers.flatMap((tier,tierIndex)=>Array.isArray(tier?.items)?tier.items.map((item,itemIndex)=>({...item,tierIndex,itemIndex,tierUnlocked:tier?.isUnlocked===true,pointsToUnlock:Number(tier?.pointsToUnlock??0)||0})):[]);
  if(!items.length){
    const artifactConfiguration=createArtifactConfiguration({artifactHash,seasonNumber,selectedPerkHashes:null,source:'bungie-live-state-unavailable',provenance:{...provenance,state:'state-unavailable'}});
    return {...base,state:'state-unavailable',provenance:'state-unavailable',perks:null,activePerks:null,unresolvedPerkHashes:[],artifactConfiguration,stateMessage:'Bungie returned no Artifact tier item state for the selected character.'};
  }

  const perks=items.map(item=>({...displayItem(definitions,item.itemHash),isActive:item.isActive===true,isVisible:item.isVisible!==false,tierIndex:item.tierIndex,itemIndex:item.itemIndex,tierUnlocked:item.tierUnlocked,pointsToUnlock:item.pointsToUnlock}));
  const activePerks=perks.filter(item=>item.isActive);
  const selectedPerkHashes=activePerks.map(item=>item.hash);
  const unresolvedPerkHashes=activePerks.filter(item=>item.unresolved).map(item=>item.hash);
  const state=activePerks.length?'resolved':'none-active';
  const artifactConfiguration=createArtifactConfiguration({artifactHash,seasonNumber,selectedPerkHashes,source:'bungie-live',provenance:{...provenance,state,manifestDefinitions:'DestinyInventoryItemDefinition'}});
  return {...base,state,provenance:'bungie-character-progressions-202',perks,activePerks,unresolvedPerkHashes,artifactConfiguration,stateMessage:activePerks.length?`${activePerks.length} applied Artifact perk(s) resolved from Bungie.`:'Bungie returned a complete Artifact state with no active perks.'};
}

function artifactUiState(artifact){
  if(!artifact||artifact.state==='state-unavailable')return {state:'state-unavailable',message:'Live Artifact activation state is unavailable.'};
  if(artifact.state==='resolved')return {state:'resolved',message:`${artifact.activePerks?.length||0} applied Artifact perk(s)`};
  if(artifact.state==='none-active')return {state:'none-active',message:'Bungie reports no active Artifact perks.'};
  return {state:'state-unavailable',message:'Live Artifact activation state is unavailable.'};
}

export {createArtifactConfiguration,resolveArtifactByProvenance,artifactUiState};
