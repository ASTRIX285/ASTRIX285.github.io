const SLOT_COUNT=20;
const host=()=>document.querySelector("#guardianLoadouts");

function hashHue(value,index){
  const numeric=Number(value);
  return Number.isFinite(numeric)?Math.abs(numeric)%360:(250+(index*19))%360;
}

function render(loadouts=[]){
  const target=host();
  if(!target)return;
  const rows=Array.isArray(loadouts)?loadouts:[];
  target.innerHTML=Array.from({length:SLOT_COUNT},(_,index)=>{
    const loadout=rows[index]||null;
    const saved=Boolean(loadout&&(loadout.items?.length||loadout.subclassOverrides?.length));
    const hue=hashHue(loadout?.colorHash,index);
    const title=saved?`Bungie in-game loadout ${index+1}`:`Empty loadout position ${index+1}`;
    return `<button type="button" class="guardian-loadout-slot ${saved?"is-saved":""}" data-loadout-slot="${index}" aria-label="${title}" title="${title}" style="--loadout-hue:${hue}"><span class="guardian-loadout-symbol" aria-hidden="true">${saved?"✦":"◇"}</span><small>${index+1}</small></button>`;
  }).join("");
  target.querySelectorAll(".is-saved").forEach(button=>button.addEventListener("click",()=>{
    const index=Number(button.dataset.loadoutSlot);
    document.dispatchEvent(new CustomEvent("astrix:loadout-selected",{detail:{index,loadout:rows[index],source:"bungie-live"}}));
  }));
}

document.addEventListener("astrix:guardian-selection-changed",event=>render(event.detail?.loadouts||[]));
document.addEventListener("astrix:beta-fixture-loaded",()=>render([]));
render([]);

export {render as renderGuardianLoadouts};
