const BUNGIE='https://www.bungie.net';
const abs=path=>path?(String(path).startsWith('http')?String(path):`${BUNGIE}${path}`):'';
const definition=(definitions,hash)=>definitions?.[String(hash)]||null;
function displayItem(definitions,hash){const row=definition(definitions,hash)||{};return {hash:Number(hash),bungieHash:Number(hash),name:row.displayProperties?.name||`Destiny item ${hash}`,description:row.displayProperties?.description||'',icon:abs(row.displayProperties?.icon),definition:row};}
export function resolveArtifactByProvenance(payload,characterId){
  const profile=payload?.profile||{};
  const definitions=payload?.definitions||{};
  const artifactHash=Number(profile?.profileProgression?.data?.seasonalArtifact?.artifactHash);
  const artifactDefinition=payload?.artifactDefinition||null;
  const hash=Number.isFinite(artifactHash)?artifactHash:Number(artifactDefinition?.hash);
  const base={hash:Number.isFinite(hash)?hash:null,bungieHash:Number.isFinite(hash)?hash:null,name:artifactDefinition?.displayProperties?.name||(Number.isFinite(hash)?`Seasonal Artifact ${hash}`:'Seasonal Artifact'),description:artifactDefinition?.displayProperties?.description||'',icon:abs(artifactDefinition?.displayProperties?.icon),definition:artifactDefinition||{},coverage:payload?.artifactCoverage||null};
  const progressionData=profile?.characterProgressions?.data;
  const cid=String(characterId||'');
  if(!progressionData||!Object.prototype.hasOwnProperty.call(progressionData,cid))return {...base,state:'state-unavailable',provenance:'state-unavailable',perks:[],activePerks:[],stateMessage:'Artifact state for the selected character is unavailable.'};
  const tiers=progressionData[cid]?.seasonalArtifact?.tiers;
  const items=Array.isArray(tiers)?tiers.flatMap(tier=>Array.isArray(tier?.items)?tier.items:[]):[];
  if(!items.length)return {...base,state:'state-unavailable',provenance:'state-unavailable',perks:[],activePerks:[],stateMessage:'Live Artifact activation state was not returned for the selected character.'};
  const perks=items.map(item=>({...displayItem(definitions,item.itemHash),isActive:item.isActive===true,isVisible:item.isVisible!==false}));
  const activePerks=perks.filter(item=>item.isActive);
  return {...base,state:activePerks.length?'resolved':'none-active',provenance:'bungie-character-progressions-202',perks,activePerks,stateMessage:activePerks.length?`${activePerks.length} applied Artifact perk(s) resolved.`:'No artifact perks activated.'};
}
export function artifactUiState(artifact){if(!artifact)return {state:'state-unavailable',message:'Live artifact state not shared.'};if(artifact.state==='resolved')return {state:'resolved',message:`${artifact.activePerks?.length||0} applied Artifact perk(s)`};if(artifact.state==='none-active')return {state:'none-active',message:'No artifact perks activated.'};return {state:'state-unavailable',message:'Live artifact state not shared. Recommended perks for this build:'};}
