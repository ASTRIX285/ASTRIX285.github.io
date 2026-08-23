import {AUTH_ORIGIN,getBungieSession} from './guardian-bungie-auth.mjs';
import {captureMatchesCharacter,selectCandidateActivities,classifyCandidateEvidence,summarizeCaptureEvidence} from './guardian-shooting-range-evidence.mjs';

const CAPTURE_KEY='astrix:shooting-range-capture:v1';
const BUILD_SPACE_KEY='astrix:paradox-build-space:v1';
const SELECTED_CHARACTER_KEY='astrix:selected-character-id';

const clone=value=>{try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value??null));}};
const asString=value=>String(value??'').trim();
const asNumber=value=>Number.isFinite(Number(value))?Number(value):null;

function selectedCharacterId(){
  try{return asString(sessionStorage.getItem(SELECTED_CHARACTER_KEY));}catch{return '';}
}

function readBuildSnapshot(){
  try{
    const state=JSON.parse(sessionStorage.getItem(BUILD_SPACE_KEY)||'null');
    return clone(state?.workingBuild||state?.originalBuild||null);
  }catch{return null;}
}

function readCapture(){
  try{return JSON.parse(sessionStorage.getItem(CAPTURE_KEY)||'null');}catch{return null;}
}

function saveCapture(capture){
  sessionStorage.setItem(CAPTURE_KEY,JSON.stringify(capture));
  return capture;
}

function clearCapture(){
  try{sessionStorage.removeItem(CAPTURE_KEY);}catch{}
}

function membershipFromSession(session){
  const active=session?.activeDestinyMembership||session?.destinyMembership||null;
  const membershipType=asNumber(active?.membershipType);
  const membershipId=asString(active?.membershipId);
  if(!Number.isInteger(membershipType)||!membershipId)return null;
  return {membershipType,membershipId,displayName:asString(active?.displayName)};
}

function historyUrl({membershipType,membershipId,characterId,count=25,page=0}){
  if(typeof globalThis.ASTRIX_ACTIVITY_HISTORY_ENDPOINT==='function'){
    return globalThis.ASTRIX_ACTIVITY_HISTORY_ENDPOINT({membershipType,membershipId,characterId,count,page});
  }
  const url=new URL(`${AUTH_ORIGIN}/bungie/activity-history`);
  url.searchParams.set('membershipType',String(membershipType));
  url.searchParams.set('membershipId',membershipId);
  url.searchParams.set('characterId',characterId);
  url.searchParams.set('count',String(count));
  url.searchParams.set('page',String(page));
  return url.toString();
}

function pgcrUrl(instanceId){
  if(typeof globalThis.ASTRIX_PGCR_ENDPOINT==='function')return globalThis.ASTRIX_PGCR_ENDPOINT(instanceId);
  return `${AUTH_ORIGIN}/bungie/pgcr/${encodeURIComponent(instanceId)}`;
}

async function fetchJson(url,{timeoutMs=15000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{credentials:'include',headers:{Accept:'application/json'},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(payload?.error||`request failed (${response.status})`);
      error.status=response.status;
      error.url=url;
      if(response.status===404)error.code='backend-route-missing';
      throw error;
    }
    return payload;
  }finally{clearTimeout(timer);}
}

function activityRows(payload){
  const rows=payload?.Response?.activities
    ??payload?.activities
    ??payload?.activityHistory?.Response?.activities
    ??payload?.activityHistory?.activities
    ??[];
  return Array.isArray(rows)?rows:[];
}

function instanceIdOf(activity){
  return asString(activity?.activityDetails?.instanceId||activity?.instanceId);
}

function periodOf(activity){
  return asString(activity?.period||activity?.activityDetails?.period);
}

function activityIdentity(activity){
  const details=activity?.activityDetails||{};
  return {
    instanceId:instanceIdOf(activity),
    period:periodOf(activity),
    referenceId:asNumber(details.referenceId),
    directorActivityHash:asNumber(details.directorActivityHash),
    mode:asNumber(details.mode),
    modes:Array.isArray(details.modes)?details.modes.map(asNumber).filter(value=>value!==null):[],
    isPrivate:Boolean(details.isPrivate),
    raw:clone(activity)
  };
}

async function pullActivityHistory({session=null,characterId=null,count=25,page=0}={}){
  const liveSession=session||await getBungieSession();
  if(!liveSession?.authenticated)throw new Error('Bungie session is not authenticated.');
  const membership=membershipFromSession(liveSession);
  if(!membership)throw new Error('Active Destiny membership is unavailable from the session.');
  const cid=asString(characterId||selectedCharacterId());
  if(!cid)throw new Error('Select a Guardian before capturing activity history.');
  const endpoint=historyUrl({...membership,characterId:cid,count,page});
  const payload=await fetchJson(endpoint);
  return {membership,characterId:cid,endpoint,payload,activities:activityRows(payload).map(activityIdentity).filter(row=>row.instanceId)};
}

async function pullPgcr(instanceId){
  const id=asString(instanceId);
  if(!id)throw new Error('Activity instanceId is required.');
  const endpoint=pgcrUrl(id);
  const payload=await fetchJson(endpoint);
  return {instanceId:id,endpoint,payload,pgcr:payload?.Response??payload?.pgcr?.Response??payload?.pgcr??payload};
}

function statValue(stat){
  const value=stat?.basic?.value??stat?.value;
  return Number.isFinite(Number(value))?Number(value):null;
}

function summarizePgcr(pgcr,{membershipId='',characterId=''}={}){
  const entries=Array.isArray(pgcr?.entries)?pgcr.entries:[];
  const target=entries.find(entry=>{
    const values=[
      entry?.player?.destinyUserInfo?.membershipId,
      entry?.player?.destinyUserInfo?.bungieGlobalDisplayName,
      entry?.characterId
    ].map(asString);
    return (membershipId&&values.includes(asString(membershipId)))||(characterId&&values.includes(asString(characterId)));
  })||entries[0]||null;
  const values=target?.values||{};
  const stats={};
  for(const [key,row] of Object.entries(values)){
    const value=statValue(row);
    if(value!==null)stats[key]=value;
  }
  return {
    activityDetails:clone(pgcr?.activityDetails||null),
    period:asString(pgcr?.period),
    startingPhaseIndex:asNumber(pgcr?.startingPhaseIndex),
    entryCount:entries.length,
    matchedEntry:Boolean(target),
    player:{
      membershipId:asString(target?.player?.destinyUserInfo?.membershipId),
      displayName:asString(target?.player?.destinyUserInfo?.bungieGlobalDisplayName||target?.player?.destinyUserInfo?.displayName),
      characterId:asString(target?.characterId),
      classHash:asNumber(target?.player?.classHash),
      raceHash:asNumber(target?.player?.raceHash),
      genderHash:asNumber(target?.player?.genderHash),
      lightLevel:asNumber(target?.player?.lightLevel)
    },
    stats,
    rawEntry:clone(target)
  };
}

async function armShootingRangeCapture({characterId=null,buildSnapshot=null}={}){
  const session=await getBungieSession();
  if(!session?.authenticated)throw new Error('Connect Bungie before arming a Shooting Range test.');
  const membership=membershipFromSession(session);
  if(!membership)throw new Error('Active Destiny membership is unavailable.');
  const cid=asString(characterId||selectedCharacterId()||buildSnapshot?.characterId);
  if(!cid)throw new Error('Select the Guardian you will use in the Shooting Range.');
  let baseline=[];
  let baselineError=null;
  try{
    const history=await pullActivityHistory({session,characterId:cid,count:25,page:0});
    baseline=history.activities.map(row=>row.instanceId);
  }catch(error){
    baselineError={message:error?.message||String(error),code:error?.code||null,status:error?.status||null,url:error?.url||null};
  }
  const capture={
    schemaVersion:1,
    testId:`PF-RANGE-${Date.now()}`,
    armedAt:new Date().toISOString(),
    membership,
    characterId:cid,
    buildSnapshot:clone(buildSnapshot||readBuildSnapshot()),
    baselineInstanceIds:baseline,
    baselineError,
    status:'armed'
  };
  return saveCapture(capture);
}

async function collectShootingRangeResults({maxCandidates=5,expectedCharacterId=null}={}){
  const capture=readCapture();
  if(!capture)throw new Error('No Shooting Range capture is armed.');
  if(expectedCharacterId&&!captureMatchesCharacter(capture,expectedCharacterId)){
    const error=new Error(`The saved capture belongs to character ${asString(capture.characterId)||'unknown'}, not the current Build Forge Guardian ${asString(expectedCharacterId)||'unknown'}.`);
    error.code='capture-character-mismatch';
    error.captureCharacterId=asString(capture.characterId);
    error.currentCharacterId=asString(expectedCharacterId);
    throw error;
  }
  const session=await getBungieSession();
  const history=await pullActivityHistory({session,characterId:capture.characterId,count:25,page:0});
  const baselineAvailable=!capture.baselineError;
  const candidates=selectCandidateActivities({
    activities:history.activities,
    baselineInstanceIds:capture.baselineInstanceIds||[],
    armedAt:capture.armedAt,
    baselineAvailable
  })
    .sort((a,b)=>String(b.period).localeCompare(String(a.period)))
    .slice(0,Math.max(1,Number(maxCandidates)||5));
  const results=[];
  for(const candidate of candidates){
    try{
      const pulled=await pullPgcr(candidate.instanceId);
      const pgcr=summarizePgcr(pulled.pgcr,{membershipId:history.membership.membershipId,characterId:capture.characterId});
      results.push({activity:candidate,pgcr,evidence:classifyCandidateEvidence({activity:candidate,pgcr}),rawPgcr:pulled.payload,pgcrEndpoint:pulled.endpoint});
    }catch(error){
      const failure={message:error?.message||String(error),code:error?.code||null,status:error?.status||null,url:error?.url||null};
      results.push({activity:candidate,pgcr:null,evidence:classifyCandidateEvidence({activity:candidate,error:failure}),error:failure});
    }
  }
  const completed={
    ...capture,
    status:'collected',
    collectedAt:new Date().toISOString(),
    historyEndpoint:history.endpoint,
    baselineStatus:baselineAvailable?'available':'unavailable',
    candidates:results,
    evidenceSummary:summarizeCaptureEvidence(results)
  };
  saveCapture(completed);
  return completed;
}

export {
  CAPTURE_KEY,
  BUILD_SPACE_KEY,
  membershipFromSession,
  activityRows,
  activityIdentity,
  summarizePgcr,
  pullActivityHistory,
  pullPgcr,
  armShootingRangeCapture,
  collectShootingRangeResults,
  captureMatchesCharacter,
  readCapture,
  clearCapture
};
