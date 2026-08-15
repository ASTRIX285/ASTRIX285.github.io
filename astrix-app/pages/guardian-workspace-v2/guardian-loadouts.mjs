import {LOADOUT_DEFINITIONS} from "./guardian-loadout-definitions.mjs";

const SLOT_COUNT=20;
const BUNGIE_ORIGIN="https://www.bungie.net";
const host=()=>document.querySelector("#guardianLoadouts");
let activeCharacterId="";
let activeIndex=null;

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const absoluteAsset=path=>path?new URL(path,BUNGIE_ORIGIN).toString():"";
const manifestRow=(section,hash)=>LOADOUT_DEFINITIONS?.[section]?.[String(hash)]||null;

function loadoutIdentity(loadout){
  const name=manifestRow("names",loadout?.nameHash)?.name||"Saved Loadout";
  const icon=absoluteAsset(manifestRow("icons",loadout?.iconHash)?.iconImagePath);
  const color=absoluteAsset(manifestRow("colors",loadout?.colorHash)?.colorImagePath);
  return {name,icon,color};
}

function isSaved(loadout){
  return Boolean(loadout&&(loadout.items?.length||loadout.subclassOverrides?.length));
}

function renderStatus(message,state="pending"){
  const target=host();
  if(!target)return;
  target.innerHTML=`<div class="guardian-loadouts-status is-${escapeHtml(state)}" role="status">${escapeHtml(message)}</div>`;
}

function render(loadouts=[]){
  const target=host();
  if(!target)return;
  const rows=Array.isArray(loadouts)?loadouts:[];
  target.innerHTML=Array.from({length:SLOT_COUNT},(_,index)=>{
    const loadout=rows[index]||null;
    const saved=isSaved(loadout);
    if(!saved){
      const title=`Empty Bungie loadout slot ${index+1}`;
      return `<button type="button" class="guardian-loadout-slot is-empty" data-loadout-slot="${index}" aria-label="${title}" title="${title}" disabled><span class="guardian-loadout-empty-label" aria-hidden="true">EMPTY</span><small>${index+1}</small></button>`;
    }
    const identity=loadoutIdentity(loadout);
    const title=`${identity.name}, Bungie loadout slot ${index+1}`;
    const colorStyle=identity.color?` style="--loadout-color-image:url(${escapeHtml(identity.color)})"`:"";
    const icon=identity.icon?`<img class="guardian-loadout-icon" src="${escapeHtml(identity.icon)}" alt="" loading="lazy" decoding="async">`:`<span class="guardian-loadout-icon-fallback" aria-hidden="true">◆</span>`;
    return `<button type="button" class="guardian-loadout-slot is-saved ${activeIndex===index?"is-active":""}" data-loadout-slot="${index}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"${colorStyle}>${icon}<span class="guardian-loadout-name" aria-hidden="true">${escapeHtml(identity.name)}</span><small>${index+1}</small></button>`;
  }).join("");
  target.querySelectorAll(".is-saved").forEach(button=>button.addEventListener("click",()=>{
    const index=Number(button.dataset.loadoutSlot);
    activeIndex=index;
    target.querySelectorAll(".guardian-loadout-slot").forEach(slot=>slot.classList.toggle("is-active",Number(slot.dataset.loadoutSlot)===index));
    document.dispatchEvent(new CustomEvent("astrix:loadout-selected",{detail:{index,characterId:activeCharacterId,loadout:rows[index],source:"bungie-live"}}));
  }));
}

document.addEventListener("astrix:guardian-selection-changed",event=>{
  if(event.detail?.source!=="bungie-live"){
    renderStatus("Connect Bungie to load in-game slots","disconnected");
    return;
  }
  if(event.detail?.loadoutsAvailable!==true){
    renderStatus("Bungie loadout component unavailable","unavailable");
    return;
  }
  activeCharacterId=String(event.detail?.characterId||activeCharacterId||"");
  if(Number.isInteger(event.detail?.selectedLoadoutIndex))activeIndex=event.detail.selectedLoadoutIndex;
  render(event.detail?.loadouts||[]);
});
document.addEventListener("astrix:guardian-loading",()=>renderStatus("Loading Bungie loadouts…","pending"));
document.addEventListener("astrix:guardian-error",()=>renderStatus("Loadout data unavailable","unavailable"));
document.addEventListener("astrix:beta-fixture-loaded",()=>renderStatus("Connect Bungie to load in-game slots","disconnected"));
renderStatus("Connect Bungie to load in-game slots","disconnected");

export {render as renderGuardianLoadouts};
export {isSaved,loadoutIdentity,renderStatus as renderGuardianLoadoutStatus};
