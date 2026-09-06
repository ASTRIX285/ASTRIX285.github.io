import {getBungieSession} from '../guardian-workspace-v2/guardian-bungie-auth.mjs?v=20260906-tool-intro-1';
import {forgeLoaderTargetUrl,prepareForgeLoaderEntry} from '../forge-loader/forge-loader-preload.mjs?v=20260906-tool-intro-1';
import {toolIntroConfig} from './tool-intro-config.mjs?v=20260906-tool-intro-1';

const params=new URLSearchParams(location.search);
const gameId=params.get('game')||'destiny-2';
const config=toolIntroConfig(gameId);
const seenKey=`astrix_intro_seen_${gameId}`;

function safeTarget(){
  const fallback=forgeLoaderTargetUrl(location.href);
  const requested=params.get('return');
  if(!requested)return fallback;
  try{
    const target=new URL(requested,location.origin);
    return target.origin===location.origin&&target.pathname==='/astrix-app/pages/forge-loader/'?target:fallback;
  }catch{return fallback;}
}

function hasSeenIntro(){try{return localStorage.getItem(seenKey)==='1';}catch{return false;}}
function rememberIntro(){try{localStorage.setItem(seenKey,'1');}catch{}}

const target=safeTarget();
if(!config||hasSeenIntro())location.replace(target);
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

  const sessionPromise=getBungieSession();
  byId('toolIntroCta').addEventListener('click',async()=>{
    const button=byId('toolIntroCta'),status=byId('toolIntroStatus');
    rememberIntro();
    button.disabled=true;
    document.body.classList.add('is-transitioning');
    status.hidden=false;
    status.textContent=config.loadingLabel;
    const entry=await prepareForgeLoaderEntry(target,await sessionPromise);
    if(entry.kind==='authentication'){
      status.textContent='Opening Bungie account approval.';
      location.assign(entry.authUrl);
      return;
    }
    const timeout=new Promise(resolve=>setTimeout(resolve,2500));
    await Promise.race([entry.promise.catch(()=>null),timeout]);
    location.replace(target);
  },{once:true});
}
