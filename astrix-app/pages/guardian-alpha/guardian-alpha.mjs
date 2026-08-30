const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const ACCESS_CODE='PARADOX285';
const ACCESS_STORAGE_KEY='astrix-paradox-beta-access';
const BUILD_FORGE_URL='../guardian-workspace-v2/paradox-build-space/';

const form=document.getElementById('alphaAccessForm');
const input=document.getElementById('alphaAccessCode');
const submit=document.getElementById('alphaAccessSubmit');
const message=document.getElementById('alphaAccessMessage');

function hasAlphaAccess(){
  try{return sessionStorage.getItem(ACCESS_STORAGE_KEY)==='granted'}catch{return false}
}

function grantAlphaAccess(){
  try{sessionStorage.setItem(ACCESS_STORAGE_KEY,'granted')}catch{}
}

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

function openBuildForge(){
  location.replace(BUILD_FORGE_URL);
}

form.addEventListener('submit',async event=>{
  event.preventDefault();

  if(input.value.trim()!==ACCESS_CODE){
    message.textContent='Access code not recognised.';
    input.select();
    return;
  }

  grantAlphaAccess();
  submit.disabled=true;
  message.textContent='Checking your Bungie connection.';

  const session=await getBungieSession();
  if(session?.authenticated){
    openBuildForge();
    return;
  }

  message.textContent='Opening Bungie secure sign in.';
  location.assign(authStartUrl());
});

async function restoreAuthenticatedAccess(){
  if(!hasAlphaAccess())return;
  const session=await getBungieSession();
  if(!session?.authenticated){
    if(new URLSearchParams(location.search).has('bungie')){
      message.textContent='Bungie connection was not completed. Enter your Alpha code to try again.';
    }
    return;
  }

  openBuildForge();
}

restoreAuthenticatedAccess();
