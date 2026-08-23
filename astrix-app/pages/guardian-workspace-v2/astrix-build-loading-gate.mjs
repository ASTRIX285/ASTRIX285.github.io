/* Shared Build Forge loading-gate event contract.
 * Event: astrix:build-load-progress
 * detail: {stage,percent,label,status:'loading'|'ready'|'error',message?,action?}
 * Progress changes only when a real application event occurs.
 */
const gate=document.getElementById('buildLoadingGate');
const value=document.getElementById('buildLoadingProgress');
const stageNode=document.getElementById('buildLoadingStage');
const messageNode=document.getElementById('buildLoadingMessage');
const actionButton=document.getElementById('buildLoadingAction');
let current=0;
let closeTimer=0;

function clampPercent(percent){const value=Number(percent);return Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):current;}
function show(){if(!gate)return;clearTimeout(closeTimer);gate.hidden=false;gate.classList.remove('is-complete');document.body.classList.add('is-build-loading');}
function update(detail={}){
  if(!gate)return;
  const status=['loading','ready','error'].includes(detail.status)?detail.status:'loading';
  let percent=clampPercent(detail.percent);
  if(status!=='error')percent=Math.max(current,percent);
  if(status==='ready')percent=100;
  current=percent;
  show();
  gate.dataset.status=status;
  gate.dataset.stage=String(detail.stage||'loading');
  gate.style.setProperty('--progress',String(percent));
  const donut=gate.querySelector('.build-loading-gate__donut');\n  donut?.style.setProperty('--progress',String(percent));\n  donut?.setAttribute('aria-valuenow',String(percent));
  if(value)value.textContent=`${percent}%`;
  if(stageNode)stageNode.textContent=detail.label||'Loading Guardian data';
  if(messageNode)messageNode.textContent=detail.message||'';
  if(actionButton){
    const action=String(detail.action||'');
    actionButton.hidden=status!=='error';
    actionButton.dataset.action=action||'reload';
    actionButton.textContent=action==='reconnect'?'Reconnect Bungie':'Try again';
  }
  if(status==='ready'){
    gate.classList.add('is-complete');
    closeTimer=window.setTimeout(()=>{gate.hidden=true;document.body.classList.remove('is-build-loading');},340);
  }
}
function publish(detail){document.dispatchEvent(new CustomEvent('astrix:build-load-progress',{detail}));}

document.addEventListener('astrix:build-load-progress',event=>update(event.detail||{}));
document.addEventListener('astrix:guardian-loading',()=>publish({stage:'profile',percent:58,label:'Loading Guardian profile',status:'loading',message:'Retrieving the selected Guardian and equipped state from Bungie.'}));
document.addEventListener('astrix:bungie-character-roster',()=>publish({stage:'manifest',percent:74,label:'Resolving Bungie identities',status:'loading',message:'Matching profile, manifest, sockets and verified equipment hashes.'}));
document.addEventListener('astrix:guardian-selection-changed',()=>requestAnimationFrame(()=>publish({stage:'render',percent:100,label:'Guardian build ready',status:'ready',message:'Verified build data rendered.'})));
document.addEventListener('astrix:guardian-error',event=>publish({stage:'error',percent:current,label:'Guardian data could not load',status:'error',message:event.detail?.message||'Refresh or reconnect Bungie, then retry.',action:'reconnect'}));
document.addEventListener('astrix:guardian-load-timeout',()=>publish({stage:'error',percent:current,label:'Bungie request timed out',status:'error',message:'Check the connection and retry the Guardian load.',action:'reload'}));
actionButton?.addEventListener('click',()=>{
  if(actionButton.dataset.action==='reconnect'){
    const connect=document.querySelector('[data-bungie-connect],#bungieConnectButton,a[href*="bungie/login"]');
    if(connect){connect.click();return;}
  }
  location.reload();
});

if(gate){
  document.body.classList.add('is-build-loading');
  update({stage:'snapshot',percent:20,label:'Preparing Build Forge',status:'loading',message:'Restoring the current workspace before Bungie data is resolved.'});
}