const DEFAULT_AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const VAULT_BUCKET=138197802;
const POSTMASTER_BUCKET=215593132;

const EMPTY_LIVE_ACTION_CAPABILITIES=Object.freeze({
  captureSnapshot:false,
  transferItems:false,
  equipItems:false,
  verifyEquipment:false,
  insertSocketPlugFree:false,
  verifyFinalState:false,
  equipLoadout:false,
  snapshotLoadout:false,
  updateLoadoutIdentifiers:false,
  clearLoadout:false
});
const SOCKET_THROTTLE_MS=550;

const clone=value=>{try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}};
const decimal=value=>/^\d+$/.test(String(value??''));

function sessionBinding(session={}){
  const membership=session.activeDestinyMembership||{};
  return {membershipId:String(membership.membershipId||session.primaryMembershipId||''),membershipType:String(membership.membershipType??'')};
}

function liveActionCapabilities(session={}){
  const advertised=session?.capabilities?.destinyActions||session?.liveActionCapabilities||{};
  return Object.fromEntries(Object.keys(EMPTY_LIVE_ACTION_CAPABILITIES).map(key=>[key,advertised[key]===true]));
}

function assertSessionBinding(plan,session){
  const binding=sessionBinding(session);
  if(!session?.authenticated||!session.csrfToken)throw new Error('Reconnect Bungie before applying live changes.');
  if(binding.membershipId!==String(plan.membershipId||'')||binding.membershipType!==String(plan.membershipType??''))throw new Error('The authenticated Destiny membership does not match this Working Build.');
  if(!decimal(plan.characterId))throw new Error('The Working Build has no valid Guardian binding.');
  return binding;
}

function assertAdvertisedPlanCapabilities(plan,session){
  const advertised=liveActionCapabilities(session);
  const missing=(plan?.phases||[]).filter(phase=>phase?.required===true&&advertised[phase.capability]!==true).map(phase=>phase.label||phase.capability);
  if(missing.length)throw new Error(`The authenticated live route no longer supports: ${missing.join(', ')}.`);
  return advertised;
}

async function responsePayload(response){
  const payload=await response.json().catch(()=>({}));
  const bungieError=payload?.ErrorCode!==undefined&&Number(payload.ErrorCode)!==1;
  if(!response.ok||bungieError){
    const error=new Error(payload?.Message||payload?.error||`Bungie action failed (${response.status}).`);
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function requestAction(path,body,{session,fetchImpl=fetch,authOrigin=DEFAULT_AUTH_ORIGIN}={}){
  if(!session?.csrfToken)throw new Error('The Bungie session is missing its live-action token. Reconnect Bungie.');
  const response=await fetchImpl(new URL(path,authOrigin),{
    method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify(body)
  });
  return responsePayload(response);
}

async function requestFreshProfile({fetchImpl=fetch,authOrigin=DEFAULT_AUTH_ORIGIN}={}){
  const url=new URL('/bungie/profile',authOrigin);url.searchParams.set('scope','character');url.searchParams.set('definitions','client-manifest');
  const response=await fetchImpl(url,{credentials:'include',headers:{Accept:'application/json'}});
  return responsePayload(response);
}

function inventoryLocations(payload={}){
  const profile=payload.profile||payload.Response||{},locations=new Map(),put=(item,source)=>{
    const id=String(item?.itemInstanceId||'');if(!id)return;
    locations.set(id,{itemInstanceId:id,itemHash:Number(item.itemHash),source});
  };
  for(const item of profile?.profileInventory?.data?.items||[])put(item,{kind:Number(item?.bucketHash)===VAULT_BUCKET?'vault':'profile',characterId:null});
  for(const [characterId,row] of Object.entries(profile?.characterInventories?.data||{}))for(const item of row?.items||[])put(item,{kind:Number(item?.bucketHash)===POSTMASTER_BUCKET?'postmaster':'carried',characterId:String(characterId)});
  for(const [characterId,row] of Object.entries(profile?.characterEquipment?.data||{}))for(const item of row?.items||[])put(item,{kind:'equipped',characterId:String(characterId)});
  return {profile,locations};
}

function freshTransferSteps(plan,payload){
  const {locations}=inventoryLocations(payload),steps=[],blockers=[];
  for(const target of plan?.equipment?.targets||[]){
    const location=locations.get(String(target.itemInstanceId||''));
    if(!location){blockers.push(`${target.name} is no longer present in the authenticated account inventory.`);continue;}
    if(Number.isInteger(Number(target.itemHash))&&Number(location.itemHash)!==Number(target.itemHash)){blockers.push(`${target.name} no longer matches its saved Bungie item identity.`);continue;}
    const source=location.source,sourceCharacterId=String(source.characterId||''),targetCharacterId=String(plan.characterId||'');
    if(['equipped','carried'].includes(source.kind)&&sourceCharacterId===targetCharacterId)continue;
    if(['vault','profile'].includes(source.kind)){steps.push({itemInstanceId:target.itemInstanceId,itemHash:target.itemHash,characterId:targetCharacterId,transferToVault:false,label:`Move ${target.name} from Vault to target Guardian`});continue;}
    if(source.kind==='carried'&&sourceCharacterId&&sourceCharacterId!==targetCharacterId){steps.push({itemInstanceId:target.itemInstanceId,itemHash:target.itemHash,characterId:sourceCharacterId,transferToVault:true,label:`Move ${target.name} from source Guardian to Vault`},{itemInstanceId:target.itemInstanceId,itemHash:target.itemHash,characterId:targetCharacterId,transferToVault:false,label:`Move ${target.name} from Vault to target Guardian`});continue;}
    if(source.kind==='equipped')blockers.push(`${target.name} is equipped on another Guardian. Unequip it there before retrying.`);
    else if(source.kind==='postmaster')blockers.push(`${target.name} must be collected from Postmaster before retrying.`);
    else blockers.push(`${target.name} has an unsupported inventory location.`);
  }
  return {steps,blockers};
}

function freshSocketChanges(plan,payload){
  const {profile,locations}=inventoryLocations(payload),targetIds=new Set((plan?.equipment?.targets||[]).map(row=>String(row.itemInstanceId||''))),changes=[],alreadyApplied=[],blockers=[];
  const reusable=profile?.itemComponents?.reusablePlugs?.data||{},sockets=profile?.itemComponents?.sockets?.data||{};
  for(const change of plan?.socketChanges||[]){
    const itemInstanceId=String(change?.itemInstanceId||''),socketIndex=Number(change?.socketIndex),plugHash=Number(change?.plugHash),label=`${change?.plugName||plugHash} on ${change?.itemName||itemInstanceId}`;
    if(!targetIds.has(itemInstanceId)){blockers.push(`${label} is not attached to an exact equipment target in this Working Build.`);continue;}
    if(!locations.has(itemInstanceId)){blockers.push(`${label} cannot be checked because its exact item instance is no longer owned.`);continue;}
    const current=Number(sockets?.[itemInstanceId]?.sockets?.[socketIndex]?.plugHash);
    if(current===plugHash){alreadyApplied.push(change);continue;}
    const options=reusable?.[itemInstanceId]?.plugs?.[String(socketIndex)]||[];
    const compatible=(Array.isArray(options)?options:[]).some(option=>Number(option?.plugItemHash??option?.plugHash)===plugHash&&option?.canInsert===true&&option?.enabled!==false);
    if(!compatible){blockers.push(`${label} is not currently exposed as a free, reversible choice for that exact item socket.`);continue;}
    changes.push(change);
  }
  return {changes,alreadyApplied,blockers};
}

function verifyReadback(plan,payload){
  const profile=payload.profile||payload.Response||{},equipment=profile?.characterEquipment?.data?.[String(plan.characterId)]?.items||[],equippedIds=new Set(equipment.map(row=>String(row?.itemInstanceId||'')).filter(Boolean));
  const missingEquipment=(plan?.equipment?.targets||[]).filter(row=>!equippedIds.has(String(row.itemInstanceId))).map(row=>({itemInstanceId:row.itemInstanceId,name:row.name,kind:row.kind}));
  const sockets=profile?.itemComponents?.sockets?.data||{},socketMismatches=(plan.socketChanges||[]).filter(change=>Number(sockets?.[change.itemInstanceId]?.sockets?.[change.socketIndex]?.plugHash)!==Number(change.plugHash)).map(change=>({itemInstanceId:change.itemInstanceId,itemName:change.itemName,socketIndex:change.socketIndex,expectedPlugHash:change.plugHash,actualPlugHash:Number(sockets?.[change.itemInstanceId]?.sockets?.[change.socketIndex]?.plugHash)||null}));
  return {verified:missingEquipment.length===0&&socketMismatches.length===0,missingEquipment,socketMismatches,equippedInstanceIds:[...equippedIds]};
}

function equipResponseFailures(payload,itemIds=[]){
  const rows=payload?.Response?.equipResults;
  if(!Array.isArray(rows))return [];
  const byId=new Map(rows.map(row=>[String(row?.itemInstanceId||''),row]));
  return itemIds.map(value=>String(value)).map(itemInstanceId=>{
    const row=byId.get(itemInstanceId),equipStatus=Number(row?.equipStatus);
    if(row&&equipStatus===1)return null;
    return {itemInstanceId,equipStatus:Number.isInteger(equipStatus)?equipStatus:null,reason:row?'bungie-equip-status':'missing-equip-result'};
  }).filter(Boolean);
}

function confirmLiveTransferPlan(plan){
  if(!plan?.ready||plan?.status!=='staged')throw new Error(plan?.blockers?.[0]||'The Working Build is not ready for Apply.');
  return {...clone(plan),status:'confirmed',confirmedAt:new Date().toISOString()};
}

async function executeLiveTransferPlan(plan,{session,fetchImpl=fetch,authOrigin=DEFAULT_AUTH_ORIGIN,onProgress=()=>{},waitImpl=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))}={}){
  if(!plan?.ready||plan?.status!=='confirmed'||!plan?.confirmedAt)throw new Error('Final user confirmation is required before Apply can contact Bungie mutation routes.');
  const binding=assertSessionBinding(plan,session),advertised=assertAdvertisedPlanCapabilities(plan,session);
  const result={schemaVersion:1,kind:'destiny-live-apply-result',status:'running',startedAt:new Date().toISOString(),characterId:plan.characterId,membershipId:binding.membershipId,steps:[],inGameSteps:clone(plan.inGameSteps||[]),readback:null};
  let fresh=null,equipmentApplied=false;
  const record=(phase,status,label,detail=null)=>{const row={phase,status,label,at:new Date().toISOString(),detail};result.steps.push(row);onProgress(row);return row;};
  try{
    onProgress({phase:'snapshot',status:'running',label:'Reading fresh Bungie ownership and equipment…'});
    fresh=await requestFreshProfile({fetchImpl,authOrigin});
    const resolved=freshTransferSteps(plan,fresh),resolvedSockets=freshSocketChanges(plan,fresh),freshBlockers=[...resolved.blockers,...resolvedSockets.blockers];
    if(resolved.steps.length&&advertised.transferItems!==true)freshBlockers.push('Fresh inventory state now requires item transfer, but the authenticated live route does not advertise that capability.');
    if(resolvedSockets.changes.length&&advertised.insertSocketPlugFree!==true)freshBlockers.push('Fresh socket state now requires a socket mutation, but the authenticated live route does not advertise that capability.');
    if(freshBlockers.length){record('snapshot','blocked','Fresh ownership or socket compatibility validation blocked Apply.',freshBlockers);result.status='blocked';result.finishedAt=new Date().toISOString();return result;}
    record('snapshot','complete','Fresh Bungie ownership, equipment and socket compatibility captured.',{targetCount:plan.equipment.targets.length,transferCount:resolved.steps.length,socketChangeCount:resolvedSockets.changes.length,socketsAlreadyApplied:resolvedSockets.alreadyApplied.length});

    for(const step of resolved.steps){
      try{
        onProgress({phase:'transfer',status:'running',label:step.label});
        const payload=await requestAction('/bungie/actions/transfer-item',{membershipType:Number(plan.membershipType),characterId:step.characterId,itemId:step.itemInstanceId,itemReferenceHash:step.itemHash,stackSize:1,transferToVault:step.transferToVault},{session,fetchImpl,authOrigin});
        record('transfer','complete',step.label,{ErrorCode:payload?.ErrorCode??1});
      }catch(error){record('transfer','failed',step.label,{message:error.message,payload:error.payload||null});result.status='partial';result.finishedAt=new Date().toISOString();return result;}
    }

    try{
      onProgress({phase:'equip',status:'running',label:'Equipping exact Working Build items…'});
      const itemIds=(plan.equipment.targets||[]).map(row=>row.itemInstanceId);
      const payload=await requestAction('/bungie/actions/equip-items',{membershipType:Number(plan.membershipType),characterId:plan.characterId,itemIds},{session,fetchImpl,authOrigin});
      const failures=equipResponseFailures(payload,itemIds);
      if(failures.length)record('equip','failed','Bungie reported one or more exact equipment failures; socket changes were skipped.',{itemIds,failures,ErrorCode:payload?.ErrorCode??1});
      else{equipmentApplied=true;record('equip','complete','Exact Working Build equipment request completed.',{itemIds,ErrorCode:payload?.ErrorCode??1});}
    }catch(error){record('equip','failed','Exact Working Build equipment request failed.',{message:error.message,payload:error.payload||null});}

    if(equipmentApplied){
      for(const [index,change] of resolvedSockets.changes.entries()){
        const label=`Set ${change.plugName||change.plugHash} on ${change.itemName||change.itemInstanceId}`;
        try{
          onProgress({phase:'socket',status:'running',label});
          const payload=await requestAction('/bungie/actions/socket-plug-free',{membershipType:Number(plan.membershipType),characterId:plan.characterId,itemId:change.itemInstanceId,plug:{socketIndex:change.socketIndex,socketArrayType:change.socketArrayType??0,plugItemHash:change.plugHash}},{session,fetchImpl,authOrigin});
          record('socket','complete',label,{ErrorCode:payload?.ErrorCode??1});
        }catch(error){record('socket','failed',label,{message:error.message,payload:error.payload||null});}
        if(index<resolvedSockets.changes.length-1)await waitImpl(SOCKET_THROTTLE_MS);
      }
    }
  }finally{
    try{
      onProgress({phase:'readback',status:'running',label:'Reading back final Bungie state…'});
      const payload=await requestFreshProfile({fetchImpl,authOrigin}),verification=verifyReadback(plan,payload);
      result.readback=verification;record('readback',verification.verified?'complete':'mismatch',verification.verified?'Final Bungie state matches every remotely applied target.':'Final Bungie state differs from one or more requested targets.',verification);
    }catch(error){record('readback','failed','Final Bungie readback failed.',{message:error.message});}
  }
  const failures=result.steps.filter(row=>['failed','mismatch','blocked'].includes(row.status));
  result.status=!failures.length&&result.readback?.verified?'applied':'partial';
  result.finishedAt=new Date().toISOString();
  return result;
}

const LOADOUT_ACTION_PATHS=Object.freeze({equip:'/bungie/actions/loadout/equip',snapshot:'/bungie/actions/loadout/snapshot',identifiers:'/bungie/actions/loadout/identifiers',clear:'/bungie/actions/loadout/clear'});
function stageBungieLoadoutAction(action,{characterId,index,loadoutName=''}={}){
  if(!LOADOUT_ACTION_PATHS[action])throw new TypeError('Unsupported Bungie loadout action.');
  if(!decimal(characterId)||!Number.isInteger(Number(index))||Number(index)<0||Number(index)>19)throw new TypeError('A valid Guardian and Bungie loadout slot are required.');
  return {schemaVersion:1,kind:'bungie-loadout-action-intent',status:'staged',action,characterId:String(characterId),index:Number(index),loadoutName:String(loadoutName||''),requiresUserConfirmation:true,confirmedAt:null};
}
function confirmBungieLoadoutAction(intent){
  if(intent?.kind!=='bungie-loadout-action-intent'||intent?.status!=='staged'||!intent?.requiresUserConfirmation)throw new Error('A staged in-game loadout action is required before confirmation.');
  return {...clone(intent),status:'confirmed',confirmedAt:new Date().toISOString()};
}
async function executeBungieLoadoutAction(action,{characterId,index,session,confirmation=null,identifiers={},fetchImpl=fetch,authOrigin=DEFAULT_AUTH_ORIGIN}={}){
  const path=LOADOUT_ACTION_PATHS[action];
  if(!path)throw new TypeError('Unsupported Bungie loadout action.');
  if(!decimal(characterId)||!Number.isInteger(Number(index))||Number(index)<0||Number(index)>19)throw new TypeError('A valid Guardian and Bungie loadout slot are required.');
  if(confirmation?.kind!=='bungie-loadout-action-intent'||confirmation?.status!=='confirmed'||!confirmation?.confirmedAt||confirmation.action!==action||confirmation.characterId!==String(characterId)||confirmation.index!==Number(index))throw new Error('Final user confirmation is required before changing an in-game Bungie loadout slot.');
  const binding=sessionBinding(session);if(!session?.authenticated||!session.csrfToken||!decimal(binding.membershipType))throw new Error('Reconnect Bungie before changing an in-game loadout.');
  const capability={equip:'equipLoadout',snapshot:'snapshotLoadout',identifiers:'updateLoadoutIdentifiers',clear:'clearLoadout'}[action];
  if(!liveActionCapabilities(session)[capability])throw new Error('The authenticated Bungie session has not advertised support for this in-game loadout action.');
  const body={membershipType:Number(binding.membershipType),characterId:String(characterId),loadoutIndex:Number(index)};
  for(const key of ['colorHash','iconHash','nameHash'])if(Number.isInteger(Number(identifiers[key])))body[key]=Number(identifiers[key]);
  return requestAction(path,body,{session,fetchImpl,authOrigin});
}

export {EMPTY_LIVE_ACTION_CAPABILITIES,SOCKET_THROTTLE_MS,liveActionCapabilities,sessionBinding,assertAdvertisedPlanCapabilities,inventoryLocations,freshTransferSteps,freshSocketChanges,verifyReadback,equipResponseFailures,confirmLiveTransferPlan,requestAction,requestFreshProfile,executeLiveTransferPlan,stageBungieLoadoutAction,confirmBungieLoadoutAction,executeBungieLoadoutAction};
