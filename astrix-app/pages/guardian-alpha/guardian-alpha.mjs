const AUTH_ORIGIN=globalThis.ASTRIX_AUTH_ORIGIN||'https://auth.astrixparadox.com';
const ACCESS_CODE='PARADOX285';
const ACCESS_STORAGE_KEY='astrix-paradox-beta-access';

const form=document.getElementById('alphaAccessForm');
const input=document.getElementById('alphaAccessCode');
const submit=document.getElementById('alphaAccessSubmit');
const message=document.getElementById('alphaAccessMessage');
const popup=document.getElementById('guardianDestinationPopup');
const closeButton=document.getElementById('guardianDestinationClose');

let bungieConnected=false;

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

function openDestinationSelector(){
  popup.hidden=false;
  document.body.classList.add('selector-open');
  closeButton.focus();
}

function closeDestinationSelector(){
  popup.hidden=true;
  document.body.classList.remove('selector-open');
  submit.focus();
}

function showConnectedState(){
  bungieConnected=true;
  form.classList.add('is-connected');
  input.disabled=true;
  submit.disabled=false;
  submit.textContent='OPEN GUARDIAN TOOLS';
  message.textContent='Bungie connected. Choose where you want to go.';
}

form.addEventListener('submit',async event=>{
  event.preventDefault();

  if(bungieConnected){
    openDestinationSelector();
    return;
  }

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
    showConnectedState();
    openDestinationSelector();
    return;
  }

  message.textContent='Opening Bungie secure sign in.';
  location.assign(authStartUrl());
});

closeButton.addEventListener('click',closeDestinationSelector);
popup.addEventListener('click',event=>{
  if(event.target===popup)closeDestinationSelector();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!popup.hidden)closeDestinationSelector();
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

  const cleanUrl=new URL(location.href);
  cleanUrl.searchParams.delete('bungie');
  history.replaceState(null,'',cleanUrl.toString());
  showConnectedState();
  openDestinationSelector();
}

restoreAuthenticatedAccess();
