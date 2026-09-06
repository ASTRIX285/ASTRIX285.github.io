import {AUTH_ORIGIN,authStartUrl,getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs?v=20260906-tool-intro-1';
import {cacheBungieProfile,readCachedBungieProfile} from '../guardian-workspace-v2/guardian-session-cache.mjs?v=20260904-atomic-forge-transfer-1';

const PAGE_PATH='/astrix-app/pages/forge-loader/';
let pageRequest=null;

function forgeLoaderTargetUrl(value=location.href){
  const source=new URL(String(value),location.href);
  const target=new URL(PAGE_PATH,location.origin);
  for(const key of ['from','characterId','membershipId','membershipType','slot']){
    const entry=source.searchParams.get(key);
    if(entry)target.searchParams.set(key,entry);
  }
  return target;
}

async function requestPreparedPayload(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),60000);
  try{
    const response=await fetch(new URL('/bungie/page/loadout',AUTH_ORIGIN),{
      credentials:'include',
      headers:{Accept:'application/json'},
      signal:controller.signal
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error||`Bungie inventory request failed (${response.status}).`);
    if(payload?.pageReady?.page!=='loadout'||!payload?.profile)throw new Error('Bungie returned no prepared Forge Loader payload.');
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Bungie inventory request timed out. Refresh or reconnect Bungie.');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

async function preloadForgeLoaderPayload(session,{force=false,sharedPayload=null}={}){
  if(session?.authenticated!==true)return null;
  if(!force){
    if(sharedPayload?.pageReady?.page==='loadout'&&sharedPayload?.profile)return sharedPayload;
    const cached=await readCachedBungieProfile(session);
    if(cached?.pageReady?.page==='loadout'&&cached?.profile)return cached;
    if(pageRequest)return pageRequest;
  }
  pageRequest=(async()=>{
    const payload=await requestPreparedPayload();
    await cacheBungieProfile(session,payload);
    globalThis.FORGE_LOADER_PRELOAD_PAYLOAD=payload;
    return payload;
  })();
  globalThis.FORGE_LOADER_PRELOAD_PROMISE=pageRequest;
  try{return await pageRequest;}
  finally{pageRequest=null;}
}

async function prepareForgeLoaderEntry(target=forgeLoaderTargetUrl(),resolvedSession=null){
  const session=resolvedSession||await getBungieSession();
  if(session?.authenticated!==true)return {kind:'authentication',session,target,authUrl:authStartUrl(target)};
  return {kind:'payload',session,target,promise:preloadForgeLoaderPayload(session,{force:true})};
}

export {forgeLoaderTargetUrl,prepareForgeLoaderEntry,preloadForgeLoaderPayload};
