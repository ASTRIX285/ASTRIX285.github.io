import {toolIntroConfig} from './tool-intro-config.mjs?v=20260906-tool-intro-1';

const AUTH_ORIGIN=globalThis.FORGE_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const JOURNEY_URL='../journey/';
const SANDBOX_HOST='sandbox.astrixparadox.com';
const params=new URLSearchParams(location.search);
const gameId=params.get('game')||'destiny-2';
const config=toolIntroConfig(gameId);
const seenKey=`astrix_intro_seen_${gameId}`;

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

function hasSeenIntro(){try{return localStorage.getItem(seenKey)==='1';}catch{return false;}}
function rememberIntro(){try{localStorage.setItem(seenKey,'1');}catch{}}

function openJourney(){
  location.replace(JOURNEY_URL);
}

async function continueToGuardianJourney(){
  const status=document.getElementById('toolIntroStatus');
  if(status){
    status.hidden=false;
    status.textContent=config?.loadingLabel||'Forge is preparing your Guardian data and opening Journey.';
  }
  const session=await getBungieSession();
  if(session?.authenticated){
    openJourney();
    return;
  }
  if(status)status.textContent='Opening Bungie account approval.';
  location.assign(authStartUrl());
}

if(!config)location.replace('/tools/');
else{
  const byId=id=>document.getElementById(id);
  byId('toolIntroEyebrow').textContent=config.eyebrow;
  byId('toolIntroTitle').textContent=config.title;
  byId('toolIntroPurpose').textContent=config.purpose;
  byId('toolIntroLimitations').textContent=config.limitations;
  byId('toolIntroCta').textContent=config.ctaLabel;
  byId('toolIntroArt').src=config.keyArt;
  byId('toolIntroArt').alt=config.keyArtAlt;
  byId('toolIntroDeveloperLogo').src=config.developerLogo;
  byId('toolIntroDeveloperLogo').alt=config.developerLogoAlt;
  byId('toolIntroDisclaimer').textContent=config.disclaimer;

  byId('toolIntroCta').addEventListener('click',async()=>{
    const button=byId('toolIntroCta'),status=byId('toolIntroStatus');
    rememberIntro();
    button.disabled=true;
    document.body.classList.add('is-transitioning');
    status.hidden=false;
    status.textContent=config.loadingLabel;
    await continueToGuardianJourney();
  },{once:true});

  if(hasSeenIntro())void continueToGuardianJourney();
}
