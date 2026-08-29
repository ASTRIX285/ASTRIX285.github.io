import {getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs';

const resolving=document.getElementById('journeyResolving');
const signedOut=document.getElementById('journeySignedOut');
const dashboard=document.getElementById('journeyDashboard');
const status=document.getElementById('journeyAuthStatus');
const connectAction=document.getElementById('journeyConnectAction');

function showSignedOut(){
  resolving.hidden=true;
  dashboard.hidden=true;
  signedOut.hidden=false;
  status.textContent='BUNGIE CONNECTION REQUIRED';
  const control=document.querySelector('.bungie-auth-control');
  if(control&&connectAction&&!connectAction.contains(control))connectAction.append(control);
}

function showJourney(){
  resolving.hidden=true;
  signedOut.hidden=true;
  dashboard.hidden=false;
  status.textContent='AUTHENTICATED SCAFFOLD';
}

try{
  const session=await getBungieSession();
  const authenticated=session?.authenticated===true&&globalThis.ASTRIX_BUNGIE_SESSION?.authenticated===true;
  if(authenticated)showJourney();
  else showSignedOut();
}catch(error){
  console.info('[ASTRIX Journey] existing Bungie session unavailable',error);
  showSignedOut();
}
