const clone=value=>value==null?value:structuredClone(value);

function validChange(change){
  return Boolean(String(change?.itemInstanceId||""))&&Number.isInteger(Number(change?.socketIndex))&&Number.isInteger(Number(change?.plugHash));
}

function createPerkChangePlan({characterId,advice}={}){
  const changes=(advice?.stagedChanges||[]).filter(validChange).map(change=>({
    itemInstanceId:String(change.itemInstanceId),socketIndex:Number(change.socketIndex),plugHash:Number(change.plugHash),currentPlugHash:Number.isInteger(Number(change.currentPlugHash))?Number(change.currentPlugHash):null,source:"bungie-reusable-plugs",reversible:true
  }));
  return {schemaVersion:1,kind:"destiny-insert-socket-plug-free",status:"staged",createdAt:new Date().toISOString(),characterId:String(characterId||""),requiresUserConfirmation:true,confirmedAt:null,changes,remotePerkMutationSupported:Boolean(advice?.remotePerkMutationSupported)};
}

function booleanCapabilities(value={}){
  return {
    captureSnapshot:value.captureSnapshot===true,
    equipItems:value.equipItems===true,
    verifyEquipment:value.verifyEquipment===true,
    insertWeaponPerks:value.insertWeaponPerks===true||value.insertSocketPlugFree===true,
    insertArmourMods:value.insertArmourMods===true,
    applyArtifact:value.applyArtifact===true,
    verifyFinalState:value.verifyFinalState===true
  };
}

function createLiveTransferPlan({build={},advice=null,capabilities={}}={}){
  const resolvedAdvice=advice||build.weaponRollAdvice||build.paradoxAnalysis?.weaponRollAdvice||{},supported=booleanCapabilities(capabilities),weapons=(build.weapons||[]).filter(Boolean),armour=(build.armour||[]).filter(Boolean);
  const weaponPerkChanges=(resolvedAdvice.stagedChanges||[]).filter(validChange).map(change=>({itemInstanceId:String(change.itemInstanceId),socketIndex:Number(change.socketIndex),currentPlugHash:Number.isInteger(Number(change.currentPlugHash))?Number(change.currentPlugHash):null,plugHash:Number(change.plugHash)}));
  const armourModChanges=(build.armourModRecommendation?.decisions||[]).filter(change=>change?.action&&change.action!=="KEEP").map(change=>({itemInstanceId:String(change.armourItemInstanceId||""),socketIndex:Number(change.socketIndex),currentPlugHash:Number(change.current?.hash??change.current?.itemHash??change.current?.bungieHash)||null,plugHash:Number(change.recommended?.hash??change.recommended?.itemHash??change.recommended?.bungieHash)||null,action:String(change.action)})).filter(change=>change.itemInstanceId&&Number.isInteger(change.socketIndex));
  const artifactConfiguration=build.artifactConfiguration||{},artifactPerkHashes=(artifactConfiguration.selectedPerkHashes||[]).map(Number).filter(Number.isInteger),equipment={weapons:weapons.map(item=>String(item.itemInstanceId||"")).filter(Boolean),armour:armour.map(item=>String(item.itemInstanceId||"")).filter(Boolean)};
  const phases=[
    {order:1,key:"snapshot",label:"Capture rollback snapshot",capability:"captureSnapshot",changes:1},
    {order:2,key:"equip",label:"Equip exact weapons and armour",capability:"equipItems",changes:equipment.weapons.length+equipment.armour.length},
    {order:3,key:"verify-equipment",label:"Verify equipped instance IDs",capability:"verifyEquipment",changes:equipment.weapons.length+equipment.armour.length},
    {order:4,key:"weapon-perks",label:"Apply compatible weapon perk sockets",capability:"insertWeaponPerks",changes:weaponPerkChanges.length},
    {order:5,key:"armour-mods",label:"Apply compatible armour mod sockets",capability:"insertArmourMods",changes:armourModChanges.length},
    {order:6,key:"artifact",label:"Apply ordered Artifact configuration",capability:"applyArtifact",changes:artifactPerkHashes.length},
    {order:7,key:"verify-final",label:"Refresh Bungie profile and verify every change",capability:"verifyFinalState",changes:equipment.weapons.length+equipment.armour.length+weaponPerkChanges.length+armourModChanges.length+artifactPerkHashes.length}
  ].map(phase=>({...phase,status:supported[phase.capability]?"supported":"blocked"}));
  const blockers=[];
  if(equipment.weapons.length!==3)blockers.push("Three exact owned weapon instances are required before transfer.");
  if(equipment.armour.length!==5)blockers.push("Five exact armour instances are required before transfer.");
  if(!artifactPerkHashes.length)blockers.push("The ordered Artifact selection is missing.");
  for(const phase of phases)if(phase.status!=="supported")blockers.push(`${phase.label} is not available through the authenticated live route.`);
  return {schemaVersion:2,kind:"destiny-complete-loadout-transfer",status:blockers.length?"blocked":"staged",ready:blockers.length===0,createdAt:new Date().toISOString(),characterId:String(build.characterId||""),requiresUserConfirmation:true,confirmedAt:null,executionPolicy:"equip-then-mutate-sockets-then-verify",equipment,weaponPerkChanges,armourModChanges,artifact:{artifactHash:Number(artifactConfiguration.artifactHash)||null,selectedPerkHashes:artifactPerkHashes},capabilities:supported,phases,blockers:[...new Set(blockers)]};
}

function confirmPerkChangePlan(plan){
  if(!plan?.changes?.length)throw new Error("No verified perk changes are staged.");
  if(!plan.remotePerkMutationSupported)throw new Error("The authenticated Bungie socket-action route is not enabled.");
  return {...clone(plan),status:"confirmed",confirmedAt:new Date().toISOString()};
}

async function applyConfirmedPerkChangePlan(plan,{fetchImpl=fetch,endpoint="https://auth.astrixparadox.com/bungie/socket-plug-free"}={}){
  if(plan?.status!=="confirmed"||!plan?.confirmedAt)throw new Error("User confirmation is required before applying perk changes.");
  const response=await fetchImpl(endpoint,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({schemaVersion:plan.schemaVersion,characterId:plan.characterId,changes:plan.changes})});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ErrorCode&&Number(payload.ErrorCode)!==1)throw Object.assign(new Error(payload?.Message||payload?.error||`Bungie perk action failed (${response.status})`),{status:response.status,payload});
  return {...clone(plan),status:"applied",appliedAt:new Date().toISOString(),result:payload};
}

export {createPerkChangePlan,createLiveTransferPlan,confirmPerkChangePlan,applyConfirmedPerkChangePlan};
