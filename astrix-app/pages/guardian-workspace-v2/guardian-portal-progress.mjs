import {guardianManifest} from "./guardian-manifest-service.mjs?v=20260906-page-payload-1";
import {PORTAL_TRANSITION_KEY} from "./guardian-session-cache.mjs";

const loader=window.AstrixLoader;
const manifestReady=guardianManifest.ready();
const isBuildSpace=Boolean(document.querySelector('.build-space'));
const BACKGROUND_DECODE_TIMEOUT_MS=5*1000;
let buildRenderStatus='',profileSettled=false,profileFailed=false,finishRevision=0;
const buildHeaderSettled=()=>!document.querySelector('#guardianCharacterCards .is-pending');
const maybeFinishBuild=()=>{
  if(!isBuildSpace||!buildHeaderSettled())return;
  if(buildRenderStatus==='ready')finishAfterPaint('Build Forge rendered');
  else if(buildRenderStatus==='pending'&&profileSettled)finishAfterPaint(profileFailed?'Build Forge recovery available':'Guardian selection ready');
};
const set=(percent,label)=>{loader?.set(percent);if(label)loader?.status(label);};
const sceneBackgroundUrls=()=>{
  const urls=new Set();
  const pattern=/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/g;
  document.querySelectorAll('.scene.immersive').forEach(node=>{
    const value=getComputedStyle(node).backgroundImage||'';
    for(const match of value.matchAll(pattern)){
      const path=String(match[1]||match[2]||match[3]||'').trim();
      if(path&&!path.startsWith('data:'))urls.add(new URL(path,document.baseURI).href);
    }
  });
  return [...urls];
};
const decodeBackground=url=>new Promise(resolve=>{
  const image=new Image();
  let settled=false;
  const finish=()=>{
    if(settled)return;
    settled=true;
    clearTimeout(timeout);
    resolve();
  };
  const timeout=setTimeout(finish,BACKGROUND_DECODE_TIMEOUT_MS);
  image.decoding='async';
  image.addEventListener('load',async()=>{try{await image.decode();}catch{}finish();},{once:true});
  image.addEventListener('error',finish,{once:true});
  image.src=url;
});
const sceneBackgroundReady=Promise.all(sceneBackgroundUrls().map(decodeBackground));
const finishAfterPaint=async label=>{
  const revision=++finishRevision;
  await manifestReady;
  await sceneBackgroundReady;
  if(revision!==finishRevision)return;
  set(96,label);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(revision===finishRevision)loader?.done();}));
};

try{
  const transition=JSON.parse(sessionStorage.getItem(PORTAL_TRANSITION_KEY)||'null');
  sessionStorage.removeItem(PORTAL_TRANSITION_KEY);
  if(transition&&Date.now()-Number(transition.armedAt||0)<30_000)set(0,transition.label||'Opening Build Forge');
}catch{}

set(8,'Preparing Build Forge');
document.addEventListener('astrix:manifest-progress',event=>set(Number(event.detail?.percent)||12,event.detail?.label||'Preparing Bungie manifest'));
document.addEventListener('astrix:guardian-profile-progress',event=>set(Number(event.detail?.percent)||58,event.detail?.label||'Resolving Guardian profile'));
document.addEventListener('astrix:guardian-loading',()=>{finishRevision++;profileSettled=false;profileFailed=false;set(18,'Connecting to Bungie');});
window.addEventListener('astrix:bungie-session',event=>{
  if(event.detail?.authenticated)set(32,'Bungie session ready');
  else set(8,'Bungie authentication required');
});
document.addEventListener('astrix:bungie-profile-loaded',event=>{
  profileSettled=Boolean(event.detail?.pendingSelection);queueMicrotask(maybeFinishBuild);
  if(event.detail?.pendingSelection&&!isBuildSpace)finishAfterPaint('Guardian selection ready');
  else set(70,'Guardian profile resolved');
});
document.addEventListener('astrix:guardian-selection-changed',()=>set(86,'Painting Guardian build'));
document.addEventListener('astrix:beta-fixture-loaded',()=>set(86,'Painting Guardian preview'));
document.addEventListener('astrix:guardian-render-complete',()=>{if(!isBuildSpace)finishAfterPaint('Guardian build rendered');},{once:true});
document.addEventListener('astrix:build-render-complete',event=>{
  finishRevision++;buildRenderStatus=event.detail?.status||'';
  if(buildRenderStatus==='pending')set(20,'Waiting for authenticated Guardian build');
  maybeFinishBuild();
});
document.addEventListener('astrix:bungie-character-roster',()=>queueMicrotask(maybeFinishBuild));
document.addEventListener('astrix:guardian-loadout-context',()=>{finishRevision++;profileSettled=false;});
document.addEventListener('astrix:guardian-error',()=>{profileSettled=true;profileFailed=true;if(isBuildSpace)queueMicrotask(maybeFinishBuild);else finishAfterPaint('Guardian state rendered');});

const currentSession=window.ASTRIX_BUNGIE_SESSION;
if(!isBuildSpace&&document.documentElement.dataset.guardianRenderComplete==='true')finishAfterPaint('Guardian build rendered');
else if(currentSession?.authenticated)set(32,'Bungie session ready');
else if(currentSession)set(8,'Bungie authentication required');
