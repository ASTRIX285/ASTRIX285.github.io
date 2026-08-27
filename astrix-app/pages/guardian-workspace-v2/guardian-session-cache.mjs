const SESSION_KEY="astrix:bungie-session-cache:v1";
const PROFILE_MARKER_KEY="astrix:bungie-profile-cache:v2";
const PROFILE_FALLBACK_KEY="astrix:bungie-profile-cache-fallback:v2";
const LOADOUT_FALLBACK_PREFIX="astrix:bungie-loadout-cache-fallback:v2:";
const FAST_RETURN_KEY="astrix:guardian-fast-return:v1";
const DB_NAME="astrix-guardian-session";
const DB_VERSION=2;
const STORE_NAME="guardian-data";
const MANIFEST_STORE_NAME="manifest-data";
// The profile cache belongs to the current browser session. Keep the last
// verified Guardian available for a full working session so Main <-> Build
// navigation never collapses to placeholders while Bungie refreshes.
const PROFILE_TTL_MS=12*60*60*1000;

const safeSessionRead=key=>{
  try{return JSON.parse(sessionStorage.getItem(key)||"null");}
  catch{return null;}
};

const safeSessionWrite=(key,value)=>{
  try{sessionStorage.setItem(key,JSON.stringify(value));return true;}
  catch{return false;}
};

function sessionIdentity(session={}){
  const membership=session.activeDestinyMembership||{};
  const membershipId=String(membership.membershipId||session.primaryMembershipId||session.bungieMembershipId||"");
  const membershipType=String(membership.membershipType??"");
  return membershipId?`${membershipType}:${membershipId}`:"";
}

function cacheBungieSession(session){
  if(!session?.authenticated)return false;
  return safeSessionWrite(SESSION_KEY,{savedAt:Date.now(),session});
}

function readCachedBungieSession(){
  const row=safeSessionRead(SESSION_KEY);
  return row?.session?.authenticated?{...row.session,sessionCacheRestored:true}:null;
}

function openDatabase(){
  if(typeof indexedDB==="undefined")return Promise.resolve(null);
  return new Promise(resolve=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"key"});
      if(!db.objectStoreNames.contains(MANIFEST_STORE_NAME))db.createObjectStore(MANIFEST_STORE_NAME,{keyPath:"key"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
    request.onblocked=()=>resolve(null);
  });
}

async function writeRecord(record){
  const db=await openDatabase();
  if(!db)return false;
  return new Promise(resolve=>{
    const transaction=db.transaction(STORE_NAME,"readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete=()=>{db.close();resolve(true);};
    transaction.onerror=()=>{db.close();resolve(false);};
    transaction.onabort=()=>{db.close();resolve(false);};
  });
}

async function readRecord(key){
  const db=await openDatabase();
  if(!db)return null;
  return new Promise(resolve=>{
    const transaction=db.transaction(STORE_NAME,"readonly");
    const request=transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>resolve(null);
    transaction.oncomplete=()=>db.close();
    transaction.onerror=()=>db.close();
    transaction.onabort=()=>db.close();
  });
}

function profileRecordKey(identity){return `profile:v2:${identity}`;}
function loadoutRecordKey(identity,characterId,index){return `loadout:v2:${identity}:${characterId}:${index}`;}
function isFresh(record){return Boolean(record&&Date.now()-Number(record.savedAt||0)<=PROFILE_TTL_MS);}

async function cacheBungieProfile(session,payload){
  const identity=sessionIdentity(session);
  if(!identity||!payload)return false;
  const savedAt=Date.now();
  const key=profileRecordKey(identity);
  cacheBungieSession(session);
  safeSessionWrite(PROFILE_MARKER_KEY,{key,identity,savedAt});
  const written=await writeRecord({key,identity,savedAt,payload});
  if(!written)safeSessionWrite(PROFILE_FALLBACK_KEY,{key,identity,savedAt,payload});
  return written;
}

async function readCachedBungieProfile(session){
  const identity=sessionIdentity(session);
  const marker=safeSessionRead(PROFILE_MARKER_KEY);
  if(!identity||marker?.identity!==identity||!isFresh(marker))return null;
  const stored=await readRecord(marker.key);
  if(stored?.identity===identity&&isFresh(stored)&&stored.payload)return stored.payload;
  const fallback=safeSessionRead(PROFILE_FALLBACK_KEY);
  return fallback?.identity===identity&&fallback?.key===marker.key&&isFresh(fallback)?fallback.payload:null;
}

async function cacheBungieLoadoutDetail(session,characterId,index,detail){
  const identity=sessionIdentity(session);
  if(!identity||!characterId||!Number.isInteger(Number(index))||!detail)return false;
  const key=loadoutRecordKey(identity,String(characterId),Number(index));
  const record={key,identity,savedAt:Date.now(),detail};
  const written=await writeRecord(record);
  if(!written)safeSessionWrite(`${LOADOUT_FALLBACK_PREFIX}${characterId}:${Number(index)}`,record);
  return written;
}

async function readCachedBungieLoadoutDetail(session,characterId,index){
  const identity=sessionIdentity(session);
  if(!identity||!characterId||!Number.isInteger(Number(index)))return null;
  const key=loadoutRecordKey(identity,String(characterId),Number(index));
  const stored=await readRecord(key);
  if(stored?.identity===identity&&isFresh(stored))return stored.detail||null;
  const fallback=safeSessionRead(`${LOADOUT_FALLBACK_PREFIX}${characterId}:${Number(index)}`);
  return fallback?.key===key&&fallback?.identity===identity&&isFresh(fallback)?fallback.detail||null:null;
}

function markGuardianFastReturn(){
  try{sessionStorage.setItem(FAST_RETURN_KEY,"1");}
  catch{}
}

export {
  FAST_RETURN_KEY,
  cacheBungieSession,
  readCachedBungieSession,
  cacheBungieProfile,
  readCachedBungieProfile,
  cacheBungieLoadoutDetail,
  readCachedBungieLoadoutDetail,
  markGuardianFastReturn,
  openDatabase as openGuardianDatabase,
  MANIFEST_STORE_NAME
};
