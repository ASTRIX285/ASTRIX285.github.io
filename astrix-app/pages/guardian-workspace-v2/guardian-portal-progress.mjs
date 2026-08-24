const loader=window.AstrixLoader;
const set=(percent,label)=>{loader?.set(percent);if(label)loader?.status(label);};
const finishAfterPaint=label=>{
  set(96,label);
  requestAnimationFrame(()=>requestAnimationFrame(()=>loader?.done()));
};

set(8,'Preparing Build Forge');
document.addEventListener('astrix:guardian-loading',()=>set(18,'Connecting to Bungie'));
window.addEventListener('astrix:bungie-session',event=>set(event.detail?.authenticated?32:24,event.detail?.authenticated?'Bungie session ready':'Preparing Guardian access'));
document.addEventListener('astrix:bungie-profile-loaded',event=>{
  if(event.detail?.pendingSelection)finishAfterPaint('Guardian selection ready');
  else set(70,'Guardian profile resolved');
});
document.addEventListener('astrix:guardian-selection-changed',()=>set(86,'Painting Guardian build'));
document.addEventListener('astrix:beta-fixture-loaded',()=>set(86,'Painting Guardian preview'));
document.addEventListener('astrix:guardian-render-complete',()=>finishAfterPaint('Guardian build rendered'),{once:true});
document.addEventListener('astrix:guardian-error',()=>finishAfterPaint('Guardian state rendered'),{once:true});
