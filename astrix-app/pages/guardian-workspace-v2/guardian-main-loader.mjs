const gate=document.getElementById('guardianLoadingGate');
const progress=document.getElementById('guardianLoadingProgress');
const percent=document.getElementById('guardianLoadingPercent');
const stage=document.getElementById('guardianLoadingStage');
const steps=[[12,'Preparing Build Forge…'],[28,'Connecting to Bungie…'],[46,'Resolving subclass and Super…'],[64,'Loading weapons and perks…'],[82,'Loading armour and mods…']];
let value=0;
function paint(next,label){value=Math.max(value,next);progress.dataset.litEdges=String(Math.min(6,Math.ceil(value/16.667)));progress.setAttribute('aria-valuenow',String(value));percent.textContent=`${value}%`;stage.textContent=label;}
for(const [i,[next,label]] of steps.entries())setTimeout(()=>paint(next,label),180+i*260);
function finish(){paint(100,'Guardian build ready');setTimeout(()=>gate.classList.add('is-launching'),260);setTimeout(()=>{gate.remove();document.body.classList.remove('is-guardian-loading');},760);}
window.addEventListener('load',()=>setTimeout(finish,Math.max(0,1450-performance.now())),{once:true});
setTimeout(finish,5000);
