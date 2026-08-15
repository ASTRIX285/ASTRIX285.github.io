const host=()=>document.querySelector("#guardianCharacterCards");
const MAX_CHARACTERS=3;
const STAT_SYMBOLS={Weapons:"⌖",Health:"♥",Class:"⬡",Grenade:"◉",Super:"✦",Melee:"⚔"};
let characters=[];
let selectedCharacterId="";

const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const classLabel=value=>String(value||"Guardian").replace(/^./,letter=>letter.toUpperCase());

function renderStatus(message,state="disconnected"){
  const target=host();
  if(!target)return;
  target.innerHTML=`<div class="guardian-character-cards__status is-${escapeHtml(state)}" role="status">${escapeHtml(message)}</div>`;
}

function statMarkup(stats=[]){
  return stats.slice(0,6).map(([name,value])=>`<span class="guardian-character-card__stat" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)} ${Number(value||0)}"><i aria-hidden="true">${STAT_SYMBOLS[name]||"◆"}</i><b>${Number(value||0)}</b></span>`).join("");
}

function render(nextCharacters=characters,nextSelectedId=selectedCharacterId){
  const target=host();
  if(!target)return;
  characters=Array.isArray(nextCharacters)?nextCharacters.slice(0,MAX_CHARACTERS):[];
  selectedCharacterId=String(nextSelectedId||"");
  if(!characters.length){renderStatus("NO BUNGIE CHARACTERS RETURNED","unavailable");return;}
  target.innerHTML=characters.map(character=>{
    const selected=String(character.characterId)===selectedCharacterId;
    const background=character.emblem?.background?` style="--character-emblem:url('${escapeHtml(character.emblem.background)}')"`:"";
    const emblem=character.emblem?.icon?`<img src="${escapeHtml(character.emblem.icon)}" alt="" loading="eager" decoding="async">`:`<span aria-hidden="true">◆</span>`;
    const title=character.title||((character.titleHash!=null)?"TITLE DATA PENDING":"NO TITLE EQUIPPED");
    const rank=character.guardianRank==null?"—":Number(character.guardianRank);
    return `<button type="button" class="guardian-character-card${selected?" is-selected":""}" data-character-id="${escapeHtml(character.characterId)}" aria-pressed="${selected}" aria-label="Select ${escapeHtml(classLabel(character.characterClass))}, power ${escapeHtml(character.power??"unavailable")}"${background}><span class="guardian-character-card__veil" aria-hidden="true"></span><span class="guardian-character-card__head"><span class="guardian-character-card__emblem">${emblem}</span><span><strong>${escapeHtml(classLabel(character.characterClass))}</strong><small>${escapeHtml(title)}</small></span><span class="guardian-character-card__power"><i aria-hidden="true">✦</i>${escapeHtml(character.power??"—")}</span></span><span class="guardian-character-card__rank">GUARDIAN RANK <b>${rank}</b></span><span class="guardian-character-card__stats">${statMarkup(character.stats)}</span></button>`;
  }).join("");
  target.querySelectorAll("[data-character-id]").forEach(button=>button.addEventListener("click",()=>{
    const characterId=String(button.dataset.characterId||"");
    if(!characterId||characterId===selectedCharacterId)return;
    target.querySelectorAll("[data-character-id]").forEach(card=>{
      const active=String(card.dataset.characterId)===characterId;
      card.classList.toggle("is-selected",active);
      card.setAttribute("aria-pressed",String(active));
    });
    selectedCharacterId=characterId;
    document.dispatchEvent(new CustomEvent("astrix:character-selected",{detail:{characterId,source:"bungie-live"}}));
  }));
}

document.addEventListener("astrix:bungie-character-roster",event=>render(event.detail?.characters||[],event.detail?.selectedCharacterId));
document.addEventListener("astrix:guardian-selection-changed",event=>{
  if(event.detail?.source!=="bungie-live")return;
  selectedCharacterId=String(event.detail?.characterId||selectedCharacterId);
  if(characters.length)render(characters,selectedCharacterId);
});
document.addEventListener("astrix:guardian-loading",()=>renderStatus("LOADING BUNGIE CHARACTERS…","pending"));
document.addEventListener("astrix:guardian-error",()=>renderStatus("CHARACTER DATA UNAVAILABLE","unavailable"));
renderStatus("CONNECT BUNGIE TO LOAD CHARACTERS","disconnected");

export {render as renderGuardianCharacterCards,renderStatus as renderGuardianCharacterCardStatus};
