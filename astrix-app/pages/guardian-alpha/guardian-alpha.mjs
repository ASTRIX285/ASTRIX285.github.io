const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const JOURNEY_URL='../journey/';

const message=document.getElementById('guardianAccessMessage');

function authReturnUrl(){
  const current=new URL(location.href);
  current.searchParams.delete('bungie');
  current.hash='';
  return current.toString();
}

function authStartUrl(){
  return `${AUTH_ORIGIN}/bungie/start?return=${encodeURIComponent(authReturnUrl())}`;
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
