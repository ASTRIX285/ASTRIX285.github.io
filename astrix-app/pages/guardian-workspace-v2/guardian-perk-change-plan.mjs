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

export {createPerkChangePlan,confirmPerkChangePlan,applyConfirmedPerkChangePlan};
