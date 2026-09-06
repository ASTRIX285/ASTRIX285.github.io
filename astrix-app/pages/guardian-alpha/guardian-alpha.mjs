const AUTH_ORIGIN=globalThis.FORGE_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const JOURNEY_URL='../journey/';
const SANDBOX_HOST='sandbox.astrixparadox.com';

const message=document.getElementById('guardianAccessMessage');

function authReturnUrl(){
  const current=new URL(location.href);
  current.searchParams.delete('bungie');
  current.hash='';
  return current.toString();
}

function authStartUrl(){
  const returnUrl=authReturnUrl();
  if(location.hostname===SANDBOX_HOST){
    const start=new URL('/__astrix/bungie/start',location.origin);
    start.searchParams.set('return',returnUrl);
    return start.toString();
  }
  return `${AUTH_ORIGIN}/bungie/start?return=${encodeURIComponent(returnUrl)}`;
}

async function getBungieSession(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${AUTH_ORIGIN}/session`,{
      credentials:'include',
      headers:{Accept:'application/json'},
      signal:controller.signal
    });
    if(response.status===401)return {authenticated:false};
    if(!response.ok)return {authenticated:false};
    return await response.json();
  }catch{
    return {authenticated:false};
  }finally{
    clearTimeout(timer);
  }
}

function openJourney(){
  location.replace(JOURNEY_URL);
}

async function continueToGuardianJourney(){
  message.textContent='Checking your Bungie connection.';

  const session=await getBungieSession();
  if(session?.authenticated){
    openJourney();
    return;
  }

  message.textContent='Opening Bungie secure sign in.';
  location.assign(authStartUrl());
}

continueToGuardianJourney();
