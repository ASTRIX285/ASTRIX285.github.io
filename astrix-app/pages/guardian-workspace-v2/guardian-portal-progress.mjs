import {guardianManifest} from "./guardian-manifest-service.mjs";

const loader=window.AstrixLoader;
const manifestReady=guardianManifest.ready();
const set=(percent,label)=>{loader?.set(percent);if(label)loader?.status(label);};
const finishAfterPaint=async label=>{
  await manifestReady;
  set(96,label);
  requestAnimationFrame(()=>requestAnimationFrame(()=>loader?.done()));
};

set(8,'Preparing Build Forge');
document.addEventListener('astrix:manifest-progress',event=>set(Number(event.detail?.percent)||12,event.detail?.label||'Preparing Bungie manifest'));
document.addEventListener('astrix:guardian-loading',()=>set(18,'Connecting to Bungie'));
window.addEventListener('astrix:bungie-session',event=>{
  if(event.detail?.authenticated)set(32,'Bungie session ready');
  else set(8,'Bungie authentication required');
});
document.addEventListener('astrix:bungie-profile-loaded',event=>{
  if(event.detail?.pendingSelection)finishAfterPaint('Guardian selection ready');
  else set(70,'Guardian profile resolved');
});
document.addEventListener('astrix:guardian-selection-changed',()=>set(86,'Painting Guardian build'));
document.addEventListener('astrix:beta-fixture-loaded',()=>set(86,'Painting Guardian preview'));
document.addEventListener('astrix:guardian-render-complete',()=>finishAfterPaint('Guardian build rendered'),{once:true});
document.addEventListener('astrix:guardian-error',()=>finishAfterPaint('Guardian state rendered'),{once:true});

const currentSession=window.ASTRIX_BUNGIE_SESSION;
if(document.documentElement.dataset.guardianRenderComplete==='true')finishAfterPaint('Guardian build rendered');
else if(currentSession?.authenticated)set(32,'Bungie session ready');
else if(currentSession)set(8,'Bungie authentication required');
