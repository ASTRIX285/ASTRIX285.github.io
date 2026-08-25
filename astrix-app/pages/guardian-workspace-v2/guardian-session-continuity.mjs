const SESSION_CACHE_KEY='astrix:bungie-session-cache:v1';
const SESSION_CACHE_SCHEMA=1;
const SESSION_CACHE_MAX_AGE_MS=30*60*1000;
const SESSION_EXPIRY_SKEW_MS=60*1000;

function createSessionCacheEnvelope(session,{now=Date.now()}={}){
  if(!session?.authenticated)return null;
  return {
    schemaVersion:SESSION_CACHE_SCHEMA,
    cachedAt:Number(now),
    session:{
      authenticated:true,
      bungieMembershipId:session.bungieMembershipId??null,
      destinyMemberships:Array.isArray(session.destinyMemberships)?session.destinyMemberships:[],
      primaryMembershipId:session.primaryMembershipId??null,
      activeDestinyMembership:session.activeDestinyMembership??null,
      accessExpiresAt:Number(session.accessExpiresAt??0)
    }
  };
}

function readReusableSession(raw,{now=Date.now()}={}){
  try{
    const envelope=typeof raw==='string'?JSON.parse(raw):raw;
    if(!envelope||envelope.schemaVersion!==SESSION_CACHE_SCHEMA||!envelope.session?.authenticated)return null;
    const cachedAt=Number(envelope.cachedAt);
    const accessExpiresAt=Number(envelope.session.accessExpiresAt);
    if(!Number.isFinite(cachedAt)||Number(now)-cachedAt<0||Number(now)-cachedAt>SESSION_CACHE_MAX_AGE_MS)return null;
    if(!Number.isFinite(accessExpiresAt)||accessExpiresAt<=Number(now)+SESSION_EXPIRY_SKEW_MS)return null;
    return JSON.parse(JSON.stringify(envelope.session));
  }catch{
    return null;
  }
}

function guardianReturnMode({referrer='',currentUrl='',historyLength=0}={}){
  if(Number(historyLength)<=1||!referrer||!currentUrl)return 'navigate';
  try{
    const current=new URL(currentUrl);
    const previous=new URL(referrer,current);
    const guardianPath=/\/guardian-workspace-v2\/(?:index\.html)?$/;
    return previous.origin===current.origin&&guardianPath.test(previous.pathname)?'history':'navigate';
  }catch{
    return 'navigate';
  }
}

export {SESSION_CACHE_KEY,SESSION_CACHE_MAX_AGE_MS,createSessionCacheEnvelope,readReusableSession,guardianReturnMode};
