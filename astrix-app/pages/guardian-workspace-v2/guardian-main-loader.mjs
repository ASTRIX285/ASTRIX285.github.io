import {getBungieSession} from './guardian-bungie-auth.mjs';

const gate=document.getElementById('guardianLoadingGate');
const progress=document.getElementById('guardianLoadingProgress');
const percent=document.getElementById('guardianLoadingPercent');
const stage=document.getElementById('guardianLoadingStage');
const steps=[[12,'Preparing Build Forge…'],[28,'Connecting to Bungie…'],[46,'Resolving subclass and Super…'],[64,'Loading weapons and perks…'],[82,'Loading armour and mods…']];
let value=0;
let finished=false;
function paint(next,label){value=Math.max(value,next);progress.dataset.litEdges=String(Math.min(6,Math.ceil(value/16.667)));progress.setAttribute('aria-valuenow',String(value));percent.textContent=`${value}%`;stage.textContent=label;}
for(const [i,[next,label]] of steps.entries())setTimeout(()=>paint(next,label),180+i*260);
function finish(label='Guardian build ready'){
  if(finished)return;
  finished=true;
  paint(100,label);
  setTimeout(()=>gate?.classList.add('is-launching'),260);
  setTimeout(()=>{gate?.remove();document.body.classList.remove('is-guardian-loading');},760);
}
document.addEventListener('astrix:guardian-render-complete',()=>finish('Guardian build rendered'),{once:true});
document.addEventListener('astrix:guardian-error',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>finish('Guardian data unavailable'))),{once:true});
getBungieSession().then(session=>{
  if(session?.authenticated===false)requestAnimationFrame(()=>requestAnimationFrame(()=>finish('Connect Bungie to load Guardian data')));
});
setTimeout(()=>{if(!finished)paint(92,'Waiting for Guardian content to render…');},15000);
