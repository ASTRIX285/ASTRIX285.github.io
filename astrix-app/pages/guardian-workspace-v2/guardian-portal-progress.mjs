import {guardianManifest} from "./guardian-manifest-service.mjs?v=20260904-artifact-sandbox-effects-1";
import {PORTAL_TRANSITION_KEY} from "./guardian-session-cache.mjs";

const loader=window.AstrixLoader;
const manifestReady=guardianManifest.ready();
const isBuildSpace=Boolean(document.querySelector('.build-space'));
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
  const finish=()=>resolve();
  image.decoding='async';
  image.addEventListener('load',async()=>{try{await image.decode();}catch{}finish();},{once:true});
  image.addEventListener('error',finish,{once:true});
  image.src=url;
});
const sceneBackgroundReady=Promise.all(sceneBackgroundUrls().map(decodeBackground));
const finishAfterPaint=async label=>{
  await manifestReady;
  await sceneBackgroundReady;
  set(96,label);
  requestAnimationFrame(()=>requestAnimationFrame(()=>loader?.done()));
};

try{
  const transition=JSON.parse(sessionStorage.getItem(PORTAL_TRANSITION_KEY)||'null');
  sessionStorage.removeItem(PORTAL_TRANSITION_KEY);
  if(transition&&Date.now()-Number(transition.armedAt||0)<30_000)set(0,transition.label||'Opening Build Forge');
}catch{}

set(8,'Preparing Build Forge');
document.addEventListener('astrix:manifest-progress',event=>set(Number(event.detail?.percent)||12,event.detail?.label||'Preparing Bungie manifest'));
document.addEventListener('astrix:guardian-loading',()=>set(18,'Connecting to Bungie'));
window.addEventListener('astrix:bungie-session',event=>{
  if(event.detail?.authenticated)set(32,'Bungie session ready');
  else set(8,'Bungie authentication required');
});
document.addEventListener('astrix:bungie-profile-loaded',event=>{
  if(event.detail?.pendingSelection&&!isBuildSpace)finishAfterPaint('Guardian selection ready');
  else set(70,'Guardian profile resolved');
});
document.addEventListener('astrix:guardian-selection-changed',()=>set(86,'Painting Guardian build'));
document.addEventListener('astrix:beta-fixture-loaded',()=>set(86,'Painting Guardian preview'));
document.addEventListener('astrix:guardian-render-complete',()=>{if(!isBuildSpace)finishAfterPaint('Guardian build rendered');},{once:true});
document.addEventListener('astrix:build-render-complete',event=>{
  if(event.detail?.status==='ready')finishAfterPaint('Build Forge rendered');
  else if(event.detail?.status==='pending')finishAfterPaint('Build Forge recovery available');
});
document.addEventListener('astrix:guardian-error',()=>finishAfterPaint(isBuildSpace?'Build Forge state rendered':'Guardian state rendered'),{once:true});

const currentSession=window.ASTRIX_BUNGIE_SESSION;
if(!isBuildSpace&&document.documentElement.dataset.guardianRenderComplete==='true')finishAfterPaint('Guardian build rendered');
else if(currentSession?.authenticated)set(32,'Bungie session ready');
else if(currentSession)set(8,'Bungie authentication required');
